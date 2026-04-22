import cron from 'node-cron'
import db from '../db/index.js'
import { validateRelevance } from './ai.js'
import { broadcast } from './websocket.js'
import { sendAlertEmail } from './email.js'
import { searchHackerNews, getHNTopStories } from '../scrapers/hackerNews.js'
import { searchGoogleNews, getTrendingGoogleNews } from '../scrapers/googleNews.js'
import { searchReddit, getSubredditHot } from '../scrapers/reddit.js'
import { searchTwitter } from '../scrapers/twitter.js'
import { searchRssFeeds, fetchTechBlogFeeds } from '../scrapers/rss.js'

let monitorTask = null

const KEYWORD_SUBREDDIT_MAP = {
  ai: ['MachineLearning', 'artificial', 'LocalLLaMA'],
  gpt: ['MachineLearning', 'ChatGPT', 'artificial'],
  llm: ['MachineLearning', 'LocalLLaMA'],
  crypto: ['CryptoCurrency', 'Bitcoin'],
  programming: ['programming', 'webdev'],
}

function getKeywordSubreddits(keyword) {
  const lower = keyword.toLowerCase()
  for (const [key, subs] of Object.entries(KEYWORD_SUBREDDIT_MAP)) {
    if (lower.includes(key)) return subs.slice(0, 2)
  }
  return []
}

async function fetchFromAllSources(keyword) {
  const settings = db.prepare('SELECT key, value FROM settings').all()
  const cfg = Object.fromEntries(settings.map(r => [r.key, r.value]))

  const tasks = []

  if (cfg.sources_hackernews === '1') {
    tasks.push(searchHackerNews(keyword, 10))
    tasks.push(getHNTopStories(20))
  }
  if (cfg.sources_googlenews === '1') {
    tasks.push(searchGoogleNews(keyword, 10))
    tasks.push(getTrendingGoogleNews(keyword, 8))
  }
  if (cfg.sources_reddit === '1') {
    tasks.push(searchReddit(keyword, 10))
    const subs = getKeywordSubreddits(keyword)
    tasks.push(...subs.map(s => getSubredditHot(s, 8)))
  }
  if (cfg.sources_twitter === '1') tasks.push(searchTwitter(keyword, 10))

  // RSS: always fetch all tech blogs + keyword-filtered results
  tasks.push(fetchTechBlogFeeds(10))
  tasks.push(searchRssFeeds(keyword, 10))

  const results = await Promise.allSettled(tasks)
  const allItems = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(item => item.title && item.url)

  // Deduplicate by URL within this fetch batch
  const seen = new Set()
  return allItems.filter(item => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

export async function processKeyword(kw, { maxAlerts = Infinity } = {}) {
  // Re-read enabled state in case the user toggled it between schedule and execution
  const latest = db.prepare('SELECT enabled FROM keywords WHERE id = ?').get(kw.id)
  if (!latest || !latest.enabled) {
    console.log(`[Monitor] Skip "${kw.keyword}" (disabled or deleted)`)
    return
  }

  console.log(`[Monitor] Checking keyword: "${kw.keyword}" (maxAlerts=${maxAlerts})`)
  const items = await fetchFromAllSources(kw.keyword)
  console.log(`[Monitor] Fetched ${items.length} items for "${kw.keyword}"`)

  // Deduplicate by URL against existing alerts
  const existingUrls = new Set(
    db.prepare('SELECT url FROM alerts WHERE keyword_id = ?').all(kw.id).map(r => r.url)
  )
  const newItems = items.filter(item => item.url && !existingUrls.has(item.url))

  // Pre-filter: prioritise items whose title/summary contains the keyword, then append the rest
  const kwLower = kw.keyword.toLowerCase()
  const directHits = newItems.filter(item =>
    item.title.toLowerCase().includes(kwLower) ||
    (item.summary || '').toLowerCase().includes(kwLower)
  )
  const indirect = newItems.filter(item =>
    !item.title.toLowerCase().includes(kwLower) &&
    !(item.summary || '').toLowerCase().includes(kwLower)
  )
  // Process direct hits first (up to 20), then indirect hits as supplementary (up to 10)
  const candidates = [...directHits.slice(0, 20), ...indirect.slice(0, 10)]

  console.log(`[Monitor] ${candidates.length} candidates (${directHits.length} direct / ${indirect.length} indirect) for "${kw.keyword}"`)

  let emitted = 0
  for (const item of candidates) {
    if (emitted >= maxAlerts) break
    const { relevant, confidence } = await validateRelevance(kw.keyword, item.title, item.summary)
    if (!relevant || confidence < 0.6) continue

    const alertId = db.prepare(`
      INSERT INTO alerts (keyword_id, title, summary, url, source, relevance_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(kw.id, item.title, item.summary || '', item.url, item.source, confidence).lastInsertRowid

    const alert = { id: alertId, keyword: kw.keyword, ...item, relevance_score: confidence }

    // Broadcast via WebSocket
    broadcast({ type: 'alert', data: alert })

    // Send email notification
    await sendAlertEmail(alert)

    // Record notification
    db.prepare(`INSERT INTO notifications (type, ref_id, channel, status) VALUES ('alert', ?, 'websocket', 'sent')`).run(alertId)
    db.prepare(`INSERT INTO notifications (type, ref_id, channel, status) VALUES ('alert', ?, 'email', 'sent')`).run(alertId)

    emitted++
    console.log(`[Monitor] Alert triggered (${emitted}/${maxAlerts === Infinity ? '∞' : maxAlerts}): "${kw.keyword}" → ${item.title.slice(0, 50)}`)
  }

  // Update last checked time
  db.prepare("UPDATE keywords SET last_checked_at = datetime('now'), check_count = check_count + 1 WHERE id = ?").run(kw.id)
}

export async function runMonitorCycle() {
  const keywords = db.prepare('SELECT * FROM keywords WHERE enabled = 1').all()
  if (keywords.length === 0) return
  console.log(`[Monitor] Running cycle for ${keywords.length} keywords`)
  for (const kw of keywords) {
    await processKeyword(kw).catch(err => console.error(`[Monitor] Error for "${kw.keyword}":`, err.message))
  }
  broadcast({ type: 'status', data: { message: `关键词检查完成，共检查 ${keywords.length} 个关键词` } })
}

export function startMonitor() {
  if (monitorTask) monitorTask.stop()
  // Every 30 minutes
  monitorTask = cron.schedule('*/30 * * * *', runMonitorCycle, { runOnInit: false })
  console.log('[Monitor] Keyword monitor started (every 30 minutes)')
}

export function stopMonitor() {
  if (monitorTask) { monitorTask.stop(); monitorTask = null }
}
