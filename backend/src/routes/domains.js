import { Router } from 'express'
import db from '../db/index.js'
import { runDiscoveryCycle } from '../services/discovery.js'

const router = Router()

router.get('/', (req, res) => {
  const domains = db.prepare('SELECT * FROM domains ORDER BY created_at DESC').all()
  res.json(domains)
})

router.post('/', (req, res) => {
  const { name, description } = req.body
  if (!name?.trim()) return res.status(400).json({ error: '领域名称不能为空' })
  try {
    const id = db.prepare('INSERT INTO domains (name, description) VALUES (?, ?)').run(name.trim(), description || '').lastInsertRowid
    res.status(201).json(db.prepare('SELECT * FROM domains WHERE id = ?').get(id))
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: '领域已存在' })
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id', (req, res) => {
  const { enabled } = req.body
  db.prepare('UPDATE domains SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id)
  res.json(db.prepare('SELECT * FROM domains WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM domains WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.post('/refresh', async (req, res) => {
  res.json({ message: '已启动热点采集，请稍候' })
  runDiscoveryCycle().catch(console.error)
})

export default router
