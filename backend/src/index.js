import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { initWebSocket } from './services/websocket.js'
import { startMonitor } from './services/monitor.js'
import { startDiscovery } from './services/discovery.js'
import keywordsRouter from './routes/keywords.js'
import domainsRouter from './routes/domains.js'
import topicsRouter from './routes/topics.js'
import alertsRouter from './routes/alerts.js'
import settingsRouter from './routes/settings.js'

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 3001

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3001'] }))
app.use(express.json())

// Routes
app.use('/api/keywords', keywordsRouter)
app.use('/api/domains', domainsRouter)
app.use('/api/topics', topicsRouter)
app.use('/api/alerts', alertsRouter)
app.use('/api/settings', settingsRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('[Express] Error:', err.message)
  res.status(err.status || 500).json({ error: err.message })
})

// Initialize WebSocket
initWebSocket(server)

// Start scheduled services
startMonitor()
startDiscovery()

server.listen(PORT, () => {
  console.log(`\n🚀 HotPulse Backend running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket ready at ws://localhost:${PORT}/ws`)
  console.log(`⏰ Monitors scheduled every 30 minutes\n`)
})
