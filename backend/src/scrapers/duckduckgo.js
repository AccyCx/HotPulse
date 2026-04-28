import axios from 'axios'
import * as cheerio from 'cheerio'
import { rateLimit } from '../utils/rateLimiter.js'
import { randomUA } from '../utils/userAgents.js'

function normalizeUrl(href) {
  if (!href) return ''
  try {
    // DuckDuckGo uses redirect links like /l/?uddg=...
    const u = new URL(href, 'https://duckduckgo.com')
    const uddg = u.searchParams.get('uddg')
    if (uddg) return decodeURIComponent(uddg)
    return u.href
  } catch {
    return String(href)
  }
}

// DuckDuckGo HTML results (no key). Strictly rate-limited and best-effort.
export async function searchDuckDuckGo(query, limit = 10) {
  await rateLimit('duckduckgo', 5000)
  try {
    const url = 'https://duckduckgo.com/html/'
    const res = await axios.get(url, {
      params: { q: query, kl: 'cn-zh' },
      headers: { 'User-Agent': randomUA() },
      timeout: 15000,
    })
    const $ = cheerio.load(res.data)
    const out = []
    $('.result').each((i, el) => {
      if (out.length >= limit) return false
      const a = $(el).find('.result__a').first()
      const snippet = $(el).find('.result__snippet').first()
      const title = a.text().trim()
      const link = normalizeUrl(a.attr('href'))
      const summary = snippet.text().trim()
      if (!title || !link) return
      out.push({
        title,
        summary: summary.slice(0, 260),
        url: link,
        source: 'duckduckgo',
        metrics: {},
      })
    })
    return out
  } catch (err) {
    console.error('[DuckDuckGo] error:', err.message)
    return []
  }
}

