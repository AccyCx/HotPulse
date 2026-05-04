import Parser from 'rss-parser'
import { rateLimit } from '../utils/rateLimiter.js'

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HotPulse/1.0)',
  },
})

export async function searchGoogleNews(query, limit = 15) {
  await rateLimit('google-news', 30000)
  try {
    const encodedQuery = encodeURIComponent(`${query} when:1d`)
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
    const feed = await parser.parseURL(url)
    return (feed.items || []).slice(0, limit).map(item => ({
      title: item.title?.replace(/ - .*$/, '') || '',
      summary: item.contentSnippet || item.content?.replace(/<[^>]+>/g, '').slice(0, 200) || '',
      url: item.link || '',
      source: 'googlenews',
      publishedAt: item.pubDate || '',
    }))
  } catch (err) {
    console.error('[GoogleNews] error:', err.message)
    return []
  }
}

export async function getTrendingGoogleNews(topic = 'technology', limit = 15) {
  await rateLimit('google-news', 30000)
  try {
    const topicMap = {
      technology: 'TECHNOLOGY',
      science: 'SCIENCE',
      business: 'BUSINESS',
      ai: 'TECHNOLOGY',
    }
    const section = topicMap[topic.toLowerCase()] || 'TECHNOLOGY'
    const url = `https://news.google.com/rss/headlines/section/topic/${section}?hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
    const feed = await parser.parseURL(url)
    return (feed.items || []).slice(0, limit).map(item => ({
      title: item.title?.replace(/ - .*$/, '') || '',
      summary: item.contentSnippet || '',
      url: item.link || '',
      source: 'googlenews',
      publishedAt: item.pubDate || '',
    }))
  } catch (err) {
    console.error('[GoogleNews] trending error:', err.message)
    return []
  }
}
