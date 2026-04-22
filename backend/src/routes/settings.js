import { Router } from 'express'
import db from '../db/index.js'
import { testEmailConfig } from '../services/email.js'
import { testAI } from '../services/ai.js'

const router = Router()

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]))
  // Mask sensitive keys
  if (settings.smtp_pass) settings.smtp_pass = settings.smtp_pass ? '••••••••' : ''
  res.json(settings)
})

router.post('/', (req, res) => {
  const updates = req.body
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `)
  // Don't overwrite smtp_pass if masked value sent
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'smtp_pass' && value === '••••••••') continue
    upsert.run(key, String(value))
  }
  res.json({ success: true })
})

router.post('/test-email', async (req, res) => {
  try {
    const result = await testEmailConfig()
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/test-ai', async (req, res) => {
  try {
    const result = await testAI()
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
