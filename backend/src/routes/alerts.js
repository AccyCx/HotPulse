import { Router } from 'express'
import db from '../db/index.js'
import { runCleanupNow } from '../services/cleanup.js'

const router = Router()

function clampInt(v, { min, max, fallback }) {
  const n = Number.parseInt(String(v), 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

router.get('/', (req, res) => {
  const { unread, include_total } = req.query
  const limit = clampInt(req.query.limit, { min: 1, max: 200, fallback: 30 })
  const offset = clampInt(req.query.offset, { min: 0, max: 100_000, fallback: 0 })
  const where = unread === '1' ? 'WHERE a.is_read = 0' : ''

  let query = `
    SELECT a.*, COALESCE(k.keyword, a.keyword_text) as keyword
    FROM alerts a
    LEFT JOIN keywords k ON a.keyword_id = k.id
    ${where}
    ORDER BY a.triggered_at DESC LIMIT ? OFFSET ?
  `
  const items = db.prepare(query).all(limit, offset)

  if (include_total === '1') {
    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM alerts a
      ${where}
    `).get().count
    return res.json({ total, items, limit, offset })
  }

  res.json(items)
})

router.patch('/:id/read', (req, res) => {
  db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE alerts SET is_read = 1').run()
  res.json({ success: true })
})

router.post('/cleanup', (req, res) => {
  const result = runCleanupNow({ retentionDays: req.body?.retention_days ?? 5 })
  res.json({ success: true, ...result })
})

// Legacy endpoint: previously deleted alerts (bug). Keep for compatibility,
// but only mark them as read so other pages/history remain intact.
router.delete('/', (req, res) => {
  const result = db.prepare('UPDATE alerts SET is_read = 1').run()
  res.json({ success: true, marked_read: result.changes })
})

router.get('/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM alerts').get().count
  const unread = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE is_read = 0').get().count
  const today = db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE triggered_at > datetime('now', '-24 hours')`).get().count
  res.json({ total, unread, today })
})

export default router
