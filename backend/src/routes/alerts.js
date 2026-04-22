import { Router } from 'express'
import db from '../db/index.js'

const router = Router()

router.get('/', (req, res) => {
  const { limit = 30, offset = 0, unread } = req.query
  let query = `
    SELECT a.*, k.keyword FROM alerts a
    JOIN keywords k ON a.keyword_id = k.id
  `
  if (unread === '1') query += ' WHERE a.is_read = 0'
  query += ' ORDER BY a.triggered_at DESC LIMIT ? OFFSET ?'
  res.json(db.prepare(query).all(Number(limit), Number(offset)))
})

router.patch('/:id/read', (req, res) => {
  db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE alerts SET is_read = 1').run()
  res.json({ success: true })
})

// Delete all alerts (used by bell panel's "全部已读" button)
router.delete('/', (req, res) => {
  const result = db.prepare('DELETE FROM alerts').run()
  res.json({ success: true, deleted: result.changes })
})

router.get('/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM alerts').get().count
  const unread = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE is_read = 0').get().count
  const today = db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE triggered_at > datetime('now', '-24 hours')`).get().count
  res.json({ total, unread, today })
})

export default router
