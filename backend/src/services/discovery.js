import cron from 'node-cron'
import db from '../db/index.js'
import { summarizeTopics } from './ai.js'
import { broadcast } from './websocket.js'
import { sendTopicDigestEmail } from './email.js'
import { searchHackerNews, getHNTopStories } from '../scrapers/hackerNews.js'
import { searchGoogleNews, getTrendingGoogleNews } from '../scrapers/googleNews.js'
import { searchReddit, getSubredditHot } from '../scrapers/reddit.js'
import { getGithubTrending } from '../scrapers/github.js'
import { getArxivPapers } from '../scrapers/arxiv.js'
import { fetchTechBlogFeeds } from '../scrapers/rss.js'
import { getTwitterTrending } from '../scrapers/twitter.js'

let discoveryTask = null

const SUBREDDIT_MAP = {
  ai: ['MachineLearning', 'artificial', 'LocalLLaMA', 'singularity'],
  programming: ['programming', 'webdev', 'learnprogramming'],
  tech: ['technology', 'tech', 'Futurology'],
  crypto: ['CryptoCurrency', 'Bitcoin', 'ethereum'],
  science: ['science', 'Physics', 'biology'],
}

function getSubreddits(domainName) {
  const lower = domainName.toLowerCase()
  for (const [key, subs] of Object.entries(SUBREDDIT_MAP)) {
    if (lower.includes(key)) return subs
  }
  return ['technology', 'tech']
}

async function gatherForDomain(domain) {
  const cfg = Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])
  )

  const tasks = []
  const name = domain.name

  if (cfg.sources_hackernews === '1') {
    tasks.push(searchHackerNews(name, 8))
    tasks.push(getHNTopStories(10))
  }
  if (cfg.sources_googlenews === '1') {
    tasks.push(searchGoogleNews(name, 10))
    tasks.push(getTrendingGoogleNews(name, 8))
  }
  if (cfg.sources_reddit === '1') {
    const subs = getSubreddits(name)
    tasks.push(...subs.slice(0, 2).map(s => getSubredditHot(s, 8)))
    tasks.push(searchReddit(name, 5))
  }
  if (cfg.sources_github === '1') tasks.push(getGithubTrending('', 'daily', 10))
  if (cfg.sources_arxiv === '1') tasks.push(getArxivPapers(name, 8))
  if (cfg.sources_twitter === '1') tasks.push(getTwitterTrending(name, 10))
  tasks.push(fetchTechBlogFeeds(5))

  const results = await Promise.allSettled(tasks)
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(item => item.title && item.url)
}

async function processDomain(domain) {
  console.log(`[Discovery] Gathering topics for domain: "${domain.name}"`)
  const rawItems = await gatherForDomain(domain)
  if (rawItems.length === 0) return

  // Deduplicate by URL
  const existingUrls = new Set(
    db.prepare(`
      SELECT url FROM topics WHERE domain_id = ?
      AND discovered_at > datetime('now', '-24 hours')
    `).all(domain.id).map(r => r.url)
  )
  const newItems = rawItems.filter(item => !existingUrls.has(item.url))
  if (newItems.length === 0) return

  // AI summarize and rank
  const processed = await summarizeTopics(domain.name, newItems)

  const insertStmt = db.prepare(`
    INSERT INTO topics (domain_id, title, summary, url, source, heat_score)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const inserted = []
  for (const topic of processed) {
    if (!topic.title || !topic.url) continue
    try {
      const id = insertStmt.run(domain.id, topic.title, topic.summary, topic.url, topic.source, topic.heat_score).lastInsertRowid
      inserted.push({ id, domain: domain.name, ...topic })
    } catch {}
  }

  if (inserted.length > 0) {
    broadcast({ type: 'topics', data: { domain: domain.name, count: inserted.length, items: inserted.slice(0, 3) } })
    broadcast({ type: 'status', data: { message: `"${domain.name}"领域发现 ${inserted.length} 条新热点` } })
    await sendTopicDigestEmail(domain.name, inserted)
  }
  console.log(`[Discovery] Inserted ${inserted.length} new topics for "${domain.name}"`)
}

export async function runDiscoveryCycle() {
  const domains = db.prepare('SELECT * FROM domains WHERE enabled = 1').all()
  if (domains.length === 0) return
  console.log(`[Discovery] Running cycle for ${domains.length} domains`)
  for (const domain of domains) {
    await processDomain(domain).catch(err => console.error(`[Discovery] Error for "${domain.name}":`, err.message))
  }
}

export function startDiscovery() {
  if (discoveryTask) discoveryTask.stop()
  discoveryTask = cron.schedule('*/30 * * * *', runDiscoveryCycle, { runOnInit: false })
  console.log('[Discovery] Topic discovery started (every 30 minutes)')
}

export function stopDiscovery() {
  if (discoveryTask) { discoveryTask.stop(); discoveryTask = null }
}
