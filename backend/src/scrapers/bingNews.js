import Parser from 'rss-parser'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { rateLimit } from '../utils/rateLimiter.js'
import { randomUA } from '../utils/userAgents.js'

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HotPulse/1.0)',
  },
})

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function isXmlFeed(value) {
  const body = String(value || '').trim()
  return body.startsWith('<?xml') || body.startsWith('<rss') || body.startsWith('<feed')
}

function normalizeBingUrl(href) {
  if (!href) return ''
  try {
    return new URL(href, 'https://www.bing.com').href
  } catch {
    return String(href)
  }
}

function recentDate(days = 1) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

async function searchBingHtml(query, limit) {
  const res = await axios.get('https://www.bing.com/search', {
    params: { q: `${query} news after:${recentDate(1)}`, count: limit },
    headers: {
      'User-Agent': randomUA(),
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
    },
    timeout: 15000,
  })

  const $ = cheerio.load(res.data)
  const items = []
  $('li.b_algo').each((_, el) => {
    if (items.length >= limit) return false
    const linkEl = $(el).find('h2 a').first()
    const title = cleanText(linkEl.text())
    const url = normalizeBingUrl(linkEl.attr('href'))
    const summary = cleanText($(el).find('.b_caption p').first().text()).slice(0, 240)
    if (!title || !url) return
    items.push({
      title,
      summary,
      url,
      source: 'bingnews',
      publishedAt: '',
      metrics: {},
    })
  })
  return items
}

// Bing News is best-effort. Bing sometimes returns a localized HTML shell for
// its old RSS endpoint, so validate before parsing and fall back to HTML search.
export async function searchBingNews(query, limit = 15) {
  await rateLimit('bing-news', 30000)
  try {
    const res = await axios.get('https://www.bing.com/news/search', {
      params: { q: `${query} after:${recentDate(1)}`, format: 'RSS' },
      headers: {
        'User-Agent': randomUA(),
        Accept: 'application/rss+xml,application/xml,text/xml,text/html,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
      },
      timeout: 15000,
    })

    if (!isXmlFeed(res.data)) {
      return searchBingHtml(query, limit)
    }

    const feed = await parser.parseString(res.data)
    return (feed.items || []).slice(0, limit).map(item => ({
      title: item.title || '',
      summary: item.contentSnippet || item.content?.replace(/<[^>]+>/g, '').slice(0, 240) || '',
      url: item.link || '',
      source: 'bingnews',
      publishedAt: item.pubDate || '',
      metrics: {},
    }))
  } catch (err) {
    console.error('[BingNews] error:', err.message)
    return []
  }
}

