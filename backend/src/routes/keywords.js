import { Router } from 'express'
import db from '../db/index.js'
import { runMonitorCycle, processKeyword } from '../services/monitor.js'

const router = Router()

router.get('/', (req, res) => {
  const keywords = db.prepare('SELECT * FROM keywords ORDER BY created_at DESC').all()
  res.json(keywords)
})

router.post('/', (req, res) => {
  const { keyword } = req.body
  if (!keyword?.trim()) return res.status(400).json({ error: '关键词不能为空' })
  try {
    const id = db.prepare('INSERT INTO keywords (keyword) VALUES (?)').run(keyword.trim()).lastInsertRowid
    const kw = db.prepare('SELECT * FROM keywords WHERE id = ?').get(id)
    res.status(201).json(kw)
    // Immediately scan for this new keyword without blocking the response
    processKeyword(kw).catch(err =>
      console.error(`[Monitor] Initial scan error for "${kw.keyword}":`, err.message)
    )
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: '关键词已存在' })
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id', (req, res) => {
  const { enabled } = req.body
  db.prepare('UPDATE keywords SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id)
  res.json(db.prepare('SELECT * FROM keywords WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM keywords WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.get('/:id/alerts', (req, res) => {
  const { limit = 20, offset = 0 } = req.query
  const alerts = db.prepare(`
    SELECT a.*, k.keyword FROM alerts a
    JOIN keywords k ON a.keyword_id = k.id
    WHERE a.keyword_id = ?
    ORDER BY a.triggered_at DESC LIMIT ? OFFSET ?
  `).all(req.params.id, Number(limit), Number(offset))
  res.json(alerts)
})

// Manually trigger a monitor check
router.post('/check-now', async (req, res) => {
  res.json({ message: '已启动检查，请稍候' })
  runMonitorCycle().catch(console.error)
})

export default router
