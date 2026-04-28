import Parser from 'rss-parser'
import { rateLimit } from '../utils/rateLimiter.js'

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HotPulse/1.0)',
  },
})

// Bing News RSS search (no key). We keep it best-effort; if Bing changes RSS, we fail gracefully.
export async function searchBingNews(query, limit = 15) {
  await rateLimit('bing-news', 30000)
  try {
    const q = encodeURIComponent(query)
    // Common RSS endpoint used by Bing News search
    const url = `https://www.bing.com/news/search?q=${q}&format=rss`
    const feed = await parser.parseURL(url)
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

