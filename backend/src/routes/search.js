import { Router } from 'express'
import db from '../db/index.js'

const router = Router()

function clampInt(v, { min, max, fallback }) {
  const n = Number.parseInt(String(v), 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// Search previously collected hotspot info (alerts).
// GET /api/search/alerts?q=&keyword_id=&source=&unread=&from=&to=&limit=&offset=
router.get('/alerts', (req, res) => {
  const {
    q,
    keyword_id,
    source,
    unread,
    from,
    to,
  } = req.query

  const limit = clampInt(req.query.limit, { min: 1, max: 200, fallback: 30 })
  const offset = clampInt(req.query.offset, { min: 0, max: 100_000, fallback: 0 })

  const where = []
  const params = []

  if (unread === '1') where.push('a.is_read = 0')
  if (keyword_id) {
    where.push('a.keyword_id = ?')
    params.push(Number(keyword_id))
  }
  if (source?.trim()) {
    where.push('LOWER(a.source) LIKE ?')
    params.push(`%${source.trim().toLowerCase()}%`)
  }
  if (from) {
    where.push("a.triggered_at >= datetime(?)")
    params.push(String(from))
  }
  if (to) {
    where.push("a.triggered_at <= datetime(?)")
    params.push(String(to))
  }
  if (q?.trim()) {
    const like = `%${q.trim()}%`
    where.push('(a.title LIKE ? OR a.summary LIKE ? OR a.url LIKE ? OR COALESCE(k.keyword, a.keyword_text) LIKE ?)')
    params.push(like, like, like, like)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM alerts a
    LEFT JOIN keywords k ON a.keyword_id = k.id
    ${whereSql}
  `).get(...params).count

  const items = db.prepare(`
    SELECT a.*, COALESCE(k.keyword, a.keyword_text) as keyword
    FROM alerts a
    LEFT JOIN keywords k ON a.keyword_id = k.id
    ${whereSql}
    ORDER BY a.triggered_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  res.json({ total, items, limit, offset })
})

// GET /api/search/fetch-logs?keyword_id=&source=&status=&limit=&offset=
router.get('/fetch-logs', (req, res) => {
  const { keyword_id, source, status } = req.query
  const limit = clampInt(req.query.limit, { min: 1, max: 300, fallback: 100 })
  const offset = clampInt(req.query.offset, { min: 0, max: 100_000, fallback: 0 })

  const where = []
  const params = []

  if (keyword_id) {
    where.push('l.keyword_id = ?')
    params.push(Number(keyword_id))
  }
  if (source?.trim()) {
    where.push('LOWER(l.source) LIKE ?')
    params.push(`%${source.trim().toLowerCase()}%`)
  }
  if (status?.trim()) {
    where.push('l.status = ?')
    params.push(status.trim())
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM source_fetch_logs l
    ${whereSql}
  `).get(...params).count

  const items = db.prepare(`
    SELECT l.*, COALESCE(k.keyword, l.keyword_text) as keyword
    FROM source_fetch_logs l
    LEFT JOIN keywords k ON l.keyword_id = k.id
    ${whereSql}
    ORDER BY l.started_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  res.json({ total, items, limit, offset })
})

export default router

