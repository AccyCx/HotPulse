import cron from 'node-cron'
import db from '../db/index.js'
import { validateRelevance } from './ai.js'
import { broadcast } from './websocket.js'
import { sendAlertEmail } from './email.js'
import { searchHackerNews } from '../scrapers/hackerNews.js'
import { searchGoogleNews } from '../scrapers/googleNews.js'
import { searchReddit } from '../scrapers/reddit.js'
import { searchTwitter } from '../scrapers/twitter.js'
import { searchRssFeeds } from '../scrapers/rss.js'

let monitorTask = null

async function fetchFromAllSources(keyword) {
  const settings = db.prepare('SELECT key, value FROM settings').all()
  const cfg = Object.fromEntries(settings.map(r => [r.key, r.value]))

  const tasks = []
  if (cfg.sources_hackernews === '1') tasks.push(searchHackerNews(keyword, 5))
  if (cfg.sources_googlenews === '1') tasks.push(searchGoogleNews(keyword, 8))
  if (cfg.sources_reddit === '1') tasks.push(searchReddit(keyword, 5))
  if (cfg.sources_twitter === '1') tasks.push(searchTwitter(keyword, 10))
  tasks.push(searchRssFeeds(keyword, 5))

  const results = await Promise.allSettled(tasks)
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(item => item.title && item.url)
}

async function processKeyword(kw) {
  console.log(`[Monitor] Checking keyword: "${kw.keyword}"`)
  const items = await fetchFromAllSources(kw.keyword)

  // Deduplicate by URL against existing alerts
  const existingUrls = new Set(
    db.prepare('SELECT url FROM alerts WHERE keyword_id = ?').all(kw.id).map(r => r.url)
  )
  const newItems = items.filter(item => item.url && !existingUrls.has(item.url))

  for (const item of newItems.slice(0, 5)) {
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

    console.log(`[Monitor] Alert triggered: "${kw.keyword}" → ${item.title.slice(0, 50)}`)
  }

  // Update last checked time
  db.prepare('UPDATE keywords SET last_checked_at = datetime("now"), check_count = check_count + 1 WHERE id = ?').run(kw.id)
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
