import { Router } from 'express'
import db from '../db/index.js'
import { testEmailConfig } from '../services/email.js'
import { testAI } from '../services/ai.js'

const router = Router()

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]))
  if (!settings.dashscope_api_key && (process.env.DASHSCOPE_API_KEY || process.env.BAILIAN_API_KEY)) {
    settings.dashscope_api_key = process.env.DASHSCOPE_API_KEY || process.env.BAILIAN_API_KEY
  }
  if (!settings.dashscope_model) settings.dashscope_model = process.env.DASHSCOPE_MODEL || process.env.BAILIAN_MODEL || 'qwen-plus'
  if (!settings.dashscope_base_url) settings.dashscope_base_url = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  // Mask sensitive keys
  if (settings.smtp_pass) settings.smtp_pass = settings.smtp_pass ? '••••••••' : ''
  if (settings.dashscope_api_key) settings.dashscope_api_key = '••••••••'
  if (settings.bailian_api_key) settings.bailian_api_key = '••••••••'
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
    if ((key === 'dashscope_api_key' || key === 'bailian_api_key') && value === '••••••••') continue
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
