import { Router } from 'express'
import db from '../db/index.js'
import { runMonitorCycle, processKeyword } from '../services/monitor.js'

const router = Router()

router.get('/', (req, res) => {
  const keywords = db.prepare(`
    SELECT * FROM keywords
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `).all()
  res.json(keywords)
})

router.post('/', (req, res) => {
  const { keyword } = req.body
  if (!keyword?.trim()) return res.status(400).json({ error: '关键词不能为空' })
  try {
    const id = db.prepare('INSERT INTO keywords (keyword) VALUES (?)').run(keyword.trim()).lastInsertRowid
    const kw = db.prepare('SELECT * FROM keywords WHERE id = ?').get(id)
    res.status(201).json(kw)
    // Immediately scan for this new keyword without blocking the response.
    // Cap the initial scan at 5 alerts to avoid flooding on first entry.
    processKeyword(kw, { maxAlerts: 5 }).catch(err =>
      console.error(`[Monitor] Initial scan error for "${kw.keyword}":`, err.message)
    )
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: '关键词已存在' })
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id', (req, res) => {
  const { enabled } = req.body
  const id = Number(req.params.id)
  const kw = db.prepare('SELECT * FROM keywords WHERE id = ? AND deleted_at IS NULL').get(id)
  if (!kw) return res.status(404).json({ error: '关键词不存在或已删除' })

  db.prepare('UPDATE keywords SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)

  if (enabled) {
    // Keyword re-enabled: keep history and cancel expiry
    db.prepare(`UPDATE alerts SET expires_at = NULL WHERE keyword_id = ?`).run(id)
  } else {
    // Keyword disabled: expire existing alerts after 5 days (if not already expiring)
    db.prepare(`
      UPDATE alerts
      SET expires_at = COALESCE(expires_at, datetime('now', '+5 days'))
      WHERE keyword_id = ?
    `).run(id)
  }

  res.json(db.prepare('SELECT * FROM keywords WHERE id = ?').get(id))
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const kw = db.prepare('SELECT * FROM keywords WHERE id = ? AND deleted_at IS NULL').get(id)
  if (!kw) return res.json({ success: true })

  // Soft delete keyword: keep historical alerts, expire them in 5 days.
  db.prepare(`UPDATE keywords SET enabled = 0, deleted_at = datetime('now') WHERE id = ?`).run(id)
  db.prepare(`
    UPDATE alerts
    SET expires_at = COALESCE(expires_at, datetime('now', '+5 days'))
    WHERE keyword_id = ?
  `).run(id)
  res.json({ success: true })
})

router.get('/:id/alerts', (req, res) => {
  const { limit = 20, offset = 0 } = req.query
  const alerts = db.prepare(`
    SELECT a.*, COALESCE(k.keyword, a.keyword_text) as keyword
    FROM alerts a
    LEFT JOIN keywords k ON a.keyword_id = k.id
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
