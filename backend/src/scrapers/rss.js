import Parser from 'rss-parser'
import { rateLimit } from '../utils/rateLimiter.js'

const parser = new Parser({ timeout: 15000 })

const TECH_FEEDS = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', domain: 'techcrunch.com' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', domain: 'theverge.com' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', domain: 'wired.com' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', domain: 'technologyreview.com' },
]

export async function fetchRssFeed(url, domain, limit = 10) {
  await rateLimit(domain, 15000)
  try {
    const feed = await parser.parseURL(url)
    return (feed.items || []).slice(0, limit).map(item => ({
      title: item.title || '',
      summary: item.contentSnippet?.slice(0, 300) || item.content?.replace(/<[^>]+>/g, '').slice(0, 300) || '',
      url: item.link || '',
      source: feed.title || domain,
      publishedAt: item.pubDate || '',
    }))
  } catch (err) {
    console.error(`[RSS] ${domain} error:`, err.message)
    return []
  }
}

export async function fetchTechBlogFeeds(limit = 8) {
  const results = await Promise.allSettled(
    TECH_FEEDS.map(feed => fetchRssFeed(feed.url, feed.domain, limit))
  )
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
}

export async function searchRssFeeds(query, limit = 5) {
  const allItems = await fetchTechBlogFeeds(limit)
  const q = query.toLowerCase()
  return allItems.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.summary.toLowerCase().includes(q)
  )
}
