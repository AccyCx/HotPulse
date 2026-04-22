import { Router } from 'express'
import db from '../db/index.js'

const router = Router()

router.get('/', (req, res) => {
  const { domain_id, limit = 30, offset = 0 } = req.query
  let query = `
    SELECT t.*, d.name as domain_name FROM topics t
    LEFT JOIN domains d ON t.domain_id = d.id
  `
  const params = []
  if (domain_id) { query += ' WHERE t.domain_id = ?'; params.push(Number(domain_id)) }
  query += ' ORDER BY t.heat_score DESC, t.discovered_at DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))
  res.json(db.prepare(query).all(...params))
})

router.get('/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM topics').get().count
  const today = db.prepare(`SELECT COUNT(*) as count FROM topics WHERE discovered_at > datetime('now', '-24 hours')`).get().count
  const byDomain = db.prepare(`
    SELECT d.name, COUNT(t.id) as count FROM domains d
    LEFT JOIN topics t ON t.domain_id = d.id
    GROUP BY d.id ORDER BY count DESC
  `).all()
  res.json({ total, today, byDomain })
})

export default router
