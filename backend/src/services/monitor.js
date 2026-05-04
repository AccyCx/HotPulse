import cron from 'node-cron'
import db from '../db/index.js'
import { batchValidateAndSelect } from './ai.js'
import { broadcast } from './websocket.js'
import { sendAlertEmail } from './email.js'
import { searchHackerNews, getHNTopStories } from '../scrapers/hackerNews.js'
import { searchGoogleNews, getTrendingGoogleNews } from '../scrapers/googleNews.js'
import { searchBingNews } from '../scrapers/bingNews.js'
import { searchReddit, getSubredditHot } from '../scrapers/reddit.js'
import { searchTwitter, getTwitterTrending } from '../scrapers/twitter.js'
import { searchRssFeeds } from '../scrapers/rss.js'
import { getGithubTrending } from '../scrapers/github.js'
import { getArxivPapers } from '../scrapers/arxiv.js'
import { searchDuckDuckGo } from '../scrapers/duckduckgo.js'
import {
  getAccountSearchTerm,
  isLikelyAccountQuery,
  searchBaidu,
  searchBaiduNews,
  searchBilibiliUsers,
  searchBilibiliVideos,
  searchWeibo,
  searchWeiboUsers,
  searchSogouWeixinAccounts,
  searchSogouWeixinArticles,
  searchZhihu,
  searchZhihuPeople,
} from '../scrapers/chinaSearch.js'

let monitorTask = null
const activeScans = new Map()

const FRESHNESS_WINDOW_MS = 48 * 60 * 60 * 1000
const AI_CANDIDATE_LIMIT = 30
const MIN_AI_CANDIDATES = 12

const SOURCE_CANDIDATE_BUDGETS = {
  twitter: 8,
  news: 10,
  googlenews: 8,
  hackernews: 4,
  reddit: 2,
  cn_social: 3,
  search_engine: 1,
  rss: 2,
  arxiv: 2,
  github: 1,
  account: 2,
  other: 2,
}

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

const GENERIC_KEYWORD_TOKENS = new Set([
  '发布', '最新', '新闻', '热点', '相关', '官方', '消息', '动态', '更新',
  'ai', 'the', 'and', 'for', 'with', 'new', 'news',
])

function extractKeywordTokens(keyword) {
  const text = String(keyword || '').toLowerCase()
  const latinTokens = text.match(/[a-z0-9][a-z0-9.+_-]*/g) || []
  const cjkTokens = text.match(/[\u4e00-\u9fff]{2,}/g) || []
  return [...latinTokens, ...cjkTokens]
    .map(token => token.trim())
    .filter(token => {
      if (!token || GENERIC_KEYWORD_TOKENS.has(token)) return false
      if (/\d/.test(token)) return token.length >= 2
      return token.length >= 3 || /[\u4e00-\u9fff]{2,}/.test(token)
    })
}

function hasKeywordSignal(keyword, title = '', summary = '') {
  if (keywordHit(keyword, title, summary)) return true
  const content = `${title}\n${summary}`.toLowerCase()
  const tokens = extractKeywordTokens(keyword)
  if (tokens.length === 0) return keywordHit(keyword, title, summary)
  return tokens.some(token => content.includes(token))
}

function safeJson(v) {
  try { return JSON.stringify(v ?? {}) } catch { return '{}' }
}

function toSqlTimestamp(iso) {
  return String(iso || new Date().toISOString()).replace('T', ' ').replace(/\.\d{3}Z$/, '')
}

function parsePublishedAt(value) {
  if (!value) return null
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? null : ts
}

function isFreshEnough(item) {
  const ts = parsePublishedAt(item?.publishedAt)
  if (!ts) return true
  return Date.now() - ts <= FRESHNESS_WINDOW_MS
}

function freshnessScore(item) {
  const ts = parsePublishedAt(item?.publishedAt)
  if (!ts) return 0.25
  const age = Math.max(0, Date.now() - ts)
  return clamp01(1 - age / FRESHNESS_WINDOW_MS)
}

function sourceGroup(source) {
  const s = String(source || '').toLowerCase()
  if (s.includes('twitter')) return 'twitter'
  if (s.includes('googlenews') || s.includes('bingnews') || s.includes('baidunews')) return 'news'
  if (s.includes('hackernews')) return 'hackernews'
  if (s.includes('reddit')) return 'reddit'
  if (s.includes('zhihu') || s.includes('weibo') || s.includes('bilibili') || s.includes('sogou_weixin')) return 'cn_social'
  if (s.includes('bingnews') || s.includes('baidu') || s.includes('duckduckgo')) return 'search_engine'
  if (s.includes('arxiv')) return 'arxiv'
  if (s.includes('github')) return 'github'
  if (s.includes('rss')) return 'rss'
  return 'other'
}

function sourcePriority(source) {
  const group = sourceGroup(source)
  return {
    news: 100,
    twitter: 80,
    googlenews: 70,
    hackernews: 60,
    reddit: 45,
    rss: 45,
    arxiv: 40,
    cn_social: 35,
    search_engine: 15,
    github: 20,
    other: 10,
  }[group] ?? 10
}

function selectCandidatesForAi(items, limit = AI_CANDIDATE_LIMIT) {
  const selected = []
  const counts = new Map()

  for (const item of items) {
    if (selected.length >= limit) break
    const group = item.raw_metrics?.account_direct ? 'account' : sourceGroup(item.source)
    const budget = SOURCE_CANDIDATE_BUDGETS[group] ?? SOURCE_CANDIDATE_BUDGETS.other
    const used = counts.get(group) || 0
    if (used >= budget) continue
    selected.push(item)
    counts.set(group, used + 1)
  }

  // If strict per-source budgets leave the AI batch too small, fill a few extra
  // by the same global ranking rather than starving validation.
  if (selected.length < Math.min(MIN_AI_CANDIDATES, limit)) {
    const seen = new Set(selected.map(item => item.url))
    for (const item of items) {
      if (selected.length >= Math.min(MIN_AI_CANDIDATES, limit)) break
      if (seen.has(item.url)) continue
      selected.push(item)
      seen.add(item.url)
    }
  }

  return selected
}

function logSourceFetch({ keyword, source, status, itemCount = 0, durationMs = 0, error = null, startedAt, finishedAt }) {
  try {
    db.prepare(`
      INSERT INTO source_fetch_logs
        (keyword_id, keyword_text, source, status, item_count, duration_ms, error, started_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      keyword?.id ?? null,
      keyword?.keyword ?? '',
      source,
      status,
      itemCount,
      durationMs,
      error ? String(error).slice(0, 500) : null,
      toSqlTimestamp(startedAt),
      toSqlTimestamp(finishedAt)
    )
  } catch (err) {
    console.error('[Monitor] Failed to write source fetch log:', err.message)
  }
}

async function fetchWithLog(keyword, source, fn) {
  const startedAt = new Date().toISOString()
  const start = Date.now()
  try {
    const value = await fn()
    const items = Array.isArray(value) ? value : []
    logSourceFetch({
      keyword,
      source,
      status: items.length > 0 ? 'success' : 'empty',
      itemCount: items.length,
      durationMs: Date.now() - start,
      startedAt,
      finishedAt: new Date().toISOString(),
    })
    return items
  } catch (err) {
    logSourceFetch({
      keyword,
      source,
      status: 'failed',
      itemCount: 0,
      durationMs: Date.now() - start,
      error: err.message,
      startedAt,
      finishedAt: new Date().toISOString(),
    })
    console.error(`[Monitor] ${source} fetch failed for "${keyword?.keyword}":`, err.message)
    return []
  }
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
  if (source.includes('zhihu')) {
    const votes = logScore(m.voteup_count ?? 0)
    const comments = logScore(m.comment_count ?? 0)
    const followers = logScore(m.follower_count ?? 0)
    return clamp01((votes + 0.8 * comments + 0.5 * followers) / 10)
  }
  if (source.includes('weibo')) {
    const reposts = logScore(m.reposts ?? 0)
    const comments = logScore(m.comments ?? 0)
    const likes = logScore(m.attitudes ?? 0)
    const followers = logScore(m.followers ?? 0)
    return clamp01((1.4 * reposts + comments + likes + 0.4 * followers) / 10)
  }
  if (source.includes('bilibili')) {
    const views = logScore(m.views ?? 0)
    const danmaku = logScore(m.danmaku ?? 0)
    const fans = logScore(m.fans ?? 0)
    return clamp01((views + 0.7 * danmaku + 0.5 * fans) / 10)
  }
  if (source.includes('sogou_weixin')) {
    return m.account_direct ? 0.2 : 0.45
  }

  // Search/news/blog sources: fallback on mild quality signals (avoid treating them as "hot" purely by default)
  const titleLen = String(item.title || '').trim().length
  const sumLen = String(item.summary || '').trim().length
  const q = clamp01((Math.min(titleLen, 120) / 120) * 0.35 + (Math.min(sumLen, 240) / 240) * 0.35)
  const base = source.includes('googlenews') || source.includes('bingnews') || source.includes('baidunews') ? 0.45 : 0.15
  return clamp01(base + q)
}


async function fetchFromAllSources(kw) {
  const cfg = getSettingsObject()
  const keyword = kw.keyword
  const accountLike = isLikelyAccountQuery(keyword)
  const accountTerm = getAccountSearchTerm(keyword)

  const tasks = []

  if (cfg.sources_hackernews === '1') {
    tasks.push(fetchWithLog(kw, 'hackernews', () => searchHackerNews(keyword, 10)))
    tasks.push(fetchWithLog(kw, 'hackernews/top', () => getHNTopStories(20)))
  }
  if (cfg.sources_googlenews === '1') {
    tasks.push(fetchWithLog(kw, 'googlenews', () => searchGoogleNews(keyword, 10)))
    tasks.push(fetchWithLog(kw, 'googlenews/trending', () => getTrendingGoogleNews(keyword, 8)))
  }
  if (cfg.sources_bingnews === '1') {
    tasks.push(fetchWithLog(kw, 'bingnews', () => searchBingNews(keyword, 10)))
  }
  if (cfg.sources_baidu === '1') {
    tasks.push(fetchWithLog(kw, 'baidu', () => searchBaidu(keyword, 10)))
  }
  if (cfg.sources_baidunews === '1') {
    tasks.push(fetchWithLog(kw, 'baidunews', () => searchBaiduNews(keyword, 10)))
  }
  if (cfg.sources_zhihu === '1') {
    tasks.push(fetchWithLog(kw, 'zhihu', () => searchZhihu(keyword, 10)))
  }
  if (accountLike && cfg.sources_zhihu_accounts === '1') {
    tasks.push(fetchWithLog(kw, 'zhihu_account', () => searchZhihuPeople(accountTerm, accountLike ? 8 : 5)))
  }
  if (cfg.sources_weibo === '1') {
    tasks.push(fetchWithLog(kw, 'weibo', () => searchWeibo(keyword, 10)))
  }
  if (accountLike && cfg.sources_weibo_accounts === '1') {
    tasks.push(fetchWithLog(kw, 'weibo_account', () => searchWeiboUsers(accountTerm, accountLike ? 8 : 5)))
  }
  if (cfg.sources_bilibili === '1') {
    tasks.push(fetchWithLog(kw, 'bilibili', () => searchBilibiliVideos(keyword, 10)))
  }
  if (accountLike && cfg.sources_bilibili_accounts === '1') {
    tasks.push(fetchWithLog(kw, 'bilibili_account', () => searchBilibiliUsers(accountTerm, accountLike ? 8 : 5)))
  }
  if (cfg.sources_sogou_weixin === '1') {
    tasks.push(fetchWithLog(kw, 'sogou_weixin', () => searchSogouWeixinArticles(keyword, 10)))
  }
  if (accountLike && cfg.sources_sogou_weixin_accounts === '1') {
    tasks.push(fetchWithLog(kw, 'sogou_weixin_account', () => searchSogouWeixinAccounts(accountTerm, accountLike ? 8 : 5)))
  }
  if (cfg.sources_reddit === '1') {
    tasks.push(fetchWithLog(kw, 'reddit', () => searchReddit(keyword, 10)))
    const subs = getKeywordSubreddits(keyword)
    tasks.push(...subs.map(s => fetchWithLog(kw, `reddit/hot/r/${s}`, () => getSubredditHot(s, 8))))
  }
  if (cfg.sources_twitter === '1') {
    tasks.push(fetchWithLog(kw, 'twitter/latest', () => searchTwitter(keyword, 25)))
    tasks.push(fetchWithLog(kw, 'twitter/top', () => getTwitterTrending(keyword, 15)))
  }

  if (cfg.sources_github === '1') tasks.push(fetchWithLog(kw, 'github/trending', () => getGithubTrending('', 'daily', 10)))
  if (cfg.sources_arxiv === '1') tasks.push(fetchWithLog(kw, 'arxiv', () => getArxivPapers(keyword, 8)))
  if (cfg.sources_duckduckgo === '1') tasks.push(fetchWithLog(kw, 'duckduckgo', () => searchDuckDuckGo(keyword, 10)))

  // RSS: enabled switch; fetch keyword-filtered results only (avoid flooding irrelevant items)
  if (cfg.sources_rss !== '0') {
    tasks.push(fetchWithLog(kw, 'rss', () => searchRssFeeds(keyword, 10)))
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
  const items = await fetchFromAllSources(kw)
  console.log(`[Monitor] Fetched ${items.length} items for "${kw.keyword}"`)

  // Deduplicate by URL against existing alerts
  const existingUrls = new Set(
    db.prepare('SELECT url FROM alerts WHERE keyword_id = ?').all(kw.id).map(r => r.url)
  )
  const newItems = items.filter(item => item.url && !existingUrls.has(item.url))

  const cfg = getSettingsObject()
  const minPopularity = Number(cfg.min_popularity ?? 0.15) || 0.15

  function isAuthoritativeSource(src) {
    const s = String(src || '').toLowerCase()
    return (
      s.includes('googlenews') ||    // Google News RSS search
      s.includes('bingnews') ||      // Bing News RSS search
      s.includes('baidunews') ||     // Baidu News
      s.includes('sogou_weixin') ||  // WeChat articles are publisher-based
      s.includes('arxiv')            // arXiv keyword query
    )
  }

  const rankedCandidates = newItems
    .map(item => ({
      ...item,
      popularity_score: computePopularity(item),
      freshness_score: freshnessScore(item),
      raw_metrics: item.metrics ?? {},
    }))
    .filter(item => {
      if (!item?.title || !item?.url) return false
      if (String(item.url).startsWith('javascript:')) return false
      if (String(item.title).trim().length < 6) return false
      if (!isFreshEnough(item)) return false

      const src = String(item.source || '').toLowerCase()

      if (isAuthoritativeSource(src)) return hasKeywordSignal(kw.keyword, item.title, item.summary)

      // Community/social/generic search sources must show actual heat signals.
      // This keeps HotPulse focused on hotspots instead of becoming a raw search engine.
      if (item.popularity_score < minPopularity) return false
      if (src.includes('twitter') || src.includes('reddit') || src.includes('hackernews')) {
        return hasKeywordSignal(kw.keyword, item.title, item.summary)
      }
      return keywordHit(kw.keyword, item.title, item.summary)
    })
    // Sort for freshness-first monitoring: Twitter and recent items get first
    // chance, while generic search engines are capped later by source budget.
    .sort((a, b) => {
      const aa = a.raw_metrics?.account_direct ? 1 : 0
      const ba = b.raw_metrics?.account_direct ? 1 : 0
      if (ba !== aa) return ba - aa
      const sp = sourcePriority(b.source) - sourcePriority(a.source)
      if (sp !== 0) return sp
      const fresh = (b.freshness_score || 0) - (a.freshness_score || 0)
      if (fresh !== 0) return fresh
      const ah = keywordHit(kw.keyword, a.title, a.summary) ? 1 : 0
      const bh = keywordHit(kw.keyword, b.title, b.summary) ? 1 : 0
      if (bh !== ah) return bh - ah
      return (b.popularity_score || 0) - (a.popularity_score || 0)
    })
  const candidates = selectCandidatesForAi(rankedCandidates, AI_CANDIDATE_LIMIT)

  console.log(`[Monitor] ${candidates.length}/${rankedCandidates.length} candidates after freshness/source-budget filter for "${kw.keyword}"`)

  if (candidates.length > 0) {
    // Batch AI validation: single call selects top 5-7 items instead of per-item sequential calls.
    // If AI is unavailable the function returns top-popularity items marked as needs_review.
    const targetCount = maxAlerts === Infinity ? 7 : Math.min(maxAlerts, 7)
    const minAiConfidence = Number(cfg.min_ai_confidence ?? 0.6) || 0.6
    const validatedItems = (await batchValidateAndSelect(kw.keyword, candidates, targetCount))
      .filter(item => item.review_status !== 'approved' || (item.ai_confidence || 0) >= minAiConfidence)

    console.log(`[Monitor] AI returned ${validatedItems.length} items for "${kw.keyword}"`)

    for (const item of validatedItems) {
      if (emitted >= maxAlerts) break

      const reviewStatus = item.review_status || 'needs_review'
      const confidence = item.ai_confidence || 0

      const alertId = db.prepare(`
        INSERT INTO alerts (keyword_id, keyword_text, title, summary, url, source, relevance_score, popularity_score, review_status, raw_metrics, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+5 days'))
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
