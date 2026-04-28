import cron from 'node-cron'
import db from '../db/index.js'
import { batchValidateAndSelect } from './ai.js'
import { broadcast } from './websocket.js'
import { sendAlertEmail } from './email.js'
import { searchHackerNews, getHNTopStories } from '../scrapers/hackerNews.js'
import { searchGoogleNews, getTrendingGoogleNews } from '../scrapers/googleNews.js'
import { searchBingNews } from '../scrapers/bingNews.js'
import { searchReddit, getSubredditHot } from '../scrapers/reddit.js'
import { searchTwitter } from '../scrapers/twitter.js'
import { searchRssFeeds } from '../scrapers/rss.js'
import { getGithubTrending } from '../scrapers/github.js'
import { getArxivPapers } from '../scrapers/arxiv.js'
import { searchDuckDuckGo } from '../scrapers/duckduckgo.js'

let monitorTask = null
const activeScans = new Map()

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

function getSettingsObject() {
  const settings = db.prepare('SELECT key, value FROM settings').all()
  return Object.fromEntries(settings.map(r => [r.key, r.value]))
}

function keywordHit(keyword, title = '', summary = '') {
  const k = String(keyword || '').trim().toLowerCase()
  if (!k) return false
  const t = String(title || '').toLowerCase()
  const s = String(summary || '').toLowerCase()
  return t.includes(k) || s.includes(k)
}

function safeJson(v) {
  try { return JSON.stringify(v ?? {}) } catch { return '{}' }
}

function clamp01(x) {
  const n = Number(x)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function logScore(x) {
  const n = Number(x) || 0
  return Math.log1p(Math.max(0, n))
}

function computePopularity(item) {
  const source = String(item.source || '').toLowerCase()
  const m = item.metrics || {}

  // Community sources: rely on engagement metrics
  if (source.includes('reddit')) {
    const score = logScore(m.score ?? item.score ?? 0)
    const comments = logScore(m.comments ?? 0)
    return clamp01((score + 0.8 * comments) / 10)
  }
  if (source.includes('hackernews')) {
    const points = logScore(m.points ?? item.score ?? 0)
    const comments = logScore(m.comments ?? 0)
    return clamp01((points + 0.7 * comments) / 10)
  }
  if (source.includes('twitter')) {
    const likes = logScore(m.likes ?? 0)
    const rts = logScore(m.retweets ?? 0)
    const replies = logScore(m.replies ?? 0)
    return clamp01((likes + 1.4 * rts + 0.9 * replies) / 10)
  }

  // Search/news/blog sources: fallback on mild quality signals (avoid treating them as "hot" purely by default)
  const titleLen = String(item.title || '').trim().length
  const sumLen = String(item.summary || '').trim().length
  const q = clamp01((Math.min(titleLen, 120) / 120) * 0.35 + (Math.min(sumLen, 240) / 240) * 0.35)
  const base = source.includes('googlenews') || source.includes('bingnews') ? 0.35 : 0.2
  return clamp01(base + q)
}


async function fetchFromAllSources(keyword) {
  const cfg = getSettingsObject()

  const tasks = []

  if (cfg.sources_hackernews === '1') {
    tasks.push(searchHackerNews(keyword, 10))
    tasks.push(getHNTopStories(20))
  }
  if (cfg.sources_googlenews === '1') {
    tasks.push(searchGoogleNews(keyword, 10))
    tasks.push(getTrendingGoogleNews(keyword, 8))
  }
  if (cfg.sources_bingnews === '1') {
    tasks.push(searchBingNews(keyword, 10))
  }
  if (cfg.sources_reddit === '1') {
    tasks.push(searchReddit(keyword, 10))
    const subs = getKeywordSubreddits(keyword)
    tasks.push(...subs.map(s => getSubredditHot(s, 8)))
  }
  if (cfg.sources_twitter === '1') tasks.push(searchTwitter(keyword, 10))

  if (cfg.sources_github === '1') tasks.push(getGithubTrending('', 'daily', 10))
  if (cfg.sources_arxiv === '1') tasks.push(getArxivPapers(keyword, 8))
  if (cfg.sources_duckduckgo === '1') tasks.push(searchDuckDuckGo(keyword, 10))

  // RSS: enabled switch; fetch keyword-filtered results only (avoid flooding irrelevant items)
  if (cfg.sources_rss !== '0') {
    tasks.push(searchRssFeeds(keyword, 10))
  }

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
  // Re-read enabled/deleted state in case the user toggled it between schedule and execution
  const latest = db.prepare('SELECT enabled, deleted_at FROM keywords WHERE id = ?').get(kw.id)
  if (!latest || !latest.enabled || latest.deleted_at) {
    console.log(`[Monitor] Skip "${kw.keyword}" (disabled or deleted)`)
    return
  }

  const scanStartedAt = new Date().toISOString()
  activeScans.set(kw.id, {
    keyword_id: kw.id,
    keyword: kw.keyword,
    started_at: scanStartedAt,
  })
  broadcast({
    type: 'scan_started',
    data: { keyword_id: kw.id, keyword: kw.keyword, started_at: scanStartedAt },
  })

  let emitted = 0
  let scanError = null
  try {
  console.log(`[Monitor] Checking keyword: "${kw.keyword}" (maxAlerts=${maxAlerts})`)
  const items = await fetchFromAllSources(kw.keyword)
  console.log(`[Monitor] Fetched ${items.length} items for "${kw.keyword}"`)

  // Deduplicate by URL against existing alerts
  const existingUrls = new Set(
    db.prepare('SELECT url FROM alerts WHERE keyword_id = ?').all(kw.id).map(r => r.url)
  )
  const newItems = items.filter(item => item.url && !existingUrls.has(item.url))

  const cfg = getSettingsObject()
  const minPopularity = Number(cfg.min_popularity ?? 0.15) || 0.15

  // Classify sources: keyword-search sources already queried by keyword so we trust
  // their results without requiring an exact keyword hit in scraped title/summary.
  // (HN Algolia / Reddit search / Twitter search may return URL-only posts where
  //  story_text is empty — the keyword appeared in full content, not the snippet.)
  function isKeywordSearchSource(src) {
    const s = String(src || '').toLowerCase()
    return (
      s === 'hackernews' ||          // Algolia keyword search
      s === 'reddit' ||              // Reddit /search.json
      s === 'twitter' ||             // twitterapi.io search
      s.includes('googlenews') ||    // Google News RSS search
      s.includes('bingnews') ||      // Bing News RSS search
      s.includes('duckduckgo') ||    // DuckDuckGo HTML search
      s.includes('arxiv')            // arXiv keyword query
    )
  }

  const candidates = newItems
    .map(item => ({
      ...item,
      popularity_score: computePopularity(item),
      raw_metrics: item.metrics ?? {},
    }))
    .filter(item => {
      if (!item?.title || !item?.url) return false
      if (String(item.url).startsWith('javascript:')) return false
      if (String(item.title).trim().length < 6) return false

      const src = String(item.source || '').toLowerCase()

      // Keyword-search sources: already filtered by keyword query at the API level.
      // Skip popularity and keyword-hit checks — let AI handle final relevance.
      if (isKeywordSearchSource(src)) return true

      // Trending / hot / generic sources (HN top, Reddit /hot, GitHub trending, RSS blogs):
      // require minimum engagement AND must mention the keyword in title/summary.
      if (item.popularity_score < minPopularity) return false
      return keywordHit(kw.keyword, item.title, item.summary)
    })
    // Sort: direct keyword hits first, then by popularity score
    .sort((a, b) => {
      const ah = keywordHit(kw.keyword, a.title, a.summary) ? 1 : 0
      const bh = keywordHit(kw.keyword, b.title, b.summary) ? 1 : 0
      if (bh !== ah) return bh - ah
      return (b.popularity_score || 0) - (a.popularity_score || 0)
    })
    .slice(0, 30)

  console.log(`[Monitor] ${candidates.length} candidates after filter for "${kw.keyword}"`)

  if (candidates.length > 0) {
    // Batch AI validation: single call selects top 5-7 items instead of per-item sequential calls.
    // If AI is unavailable the function returns top-popularity items marked as needs_review.
    const targetCount = maxAlerts === Infinity ? 7 : Math.min(maxAlerts, 7)
    const validatedItems = await batchValidateAndSelect(kw.keyword, candidates, targetCount)

    console.log(`[Monitor] AI returned ${validatedItems.length} items for "${kw.keyword}"`)

    for (const item of validatedItems) {
      if (emitted >= maxAlerts) break

      const reviewStatus = item.review_status || 'needs_review'
      const confidence = item.ai_confidence || 0

      const alertId = db.prepare(`
        INSERT INTO alerts (keyword_id, keyword_text, title, summary, url, source, relevance_score, popularity_score, review_status, raw_metrics)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        kw.id,
        kw.keyword,
        item.title,
        item.summary || '',
        item.url,
        item.source,
        confidence,
        item.popularity_score || 0,
        reviewStatus,
        safeJson(item.raw_metrics)
      ).lastInsertRowid

      const alert = {
        id: alertId,
        keyword: kw.keyword,
        ...item,
        relevance_score: confidence,
        popularity_score: item.popularity_score || 0,
        review_status: reviewStatus,
      }

      // needs_review items are stored but not broadcasted/emailed (await manual review).
      if (reviewStatus === 'approved') {
        broadcast({ type: 'alert', data: alert })
        await sendAlertEmail(alert)
        db.prepare(`INSERT INTO notifications (type, ref_id, channel, status) VALUES ('alert', ?, 'websocket', 'sent')`).run(alertId)
        db.prepare(`INSERT INTO notifications (type, ref_id, channel, status) VALUES ('alert', ?, 'email', 'sent')`).run(alertId)
      }

      emitted++
      console.log(`[Monitor] Alert stored (${emitted}/${maxAlerts === Infinity ? '∞' : maxAlerts}, status=${reviewStatus}): "${kw.keyword}" → ${item.title.slice(0, 60)}`)
    }
  }

  // Update last checked time
  db.prepare("UPDATE keywords SET last_checked_at = datetime('now'), check_count = check_count + 1 WHERE id = ?").run(kw.id)
  } catch (err) {
    scanError = err
    throw err
  } finally {
    activeScans.delete(kw.id)
    broadcast({
      type: 'scan_finished',
      data: {
        keyword_id: kw.id,
        keyword: kw.keyword,
        emitted,
        error: scanError ? scanError.message : null,
        finished_at: new Date().toISOString(),
      },
    })
  }
}

export function getActiveScans() {
  return Array.from(activeScans.values())
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
