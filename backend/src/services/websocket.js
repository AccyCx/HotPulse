import { WebSocketServer, WebSocket } from 'ws'

let wss = null

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' })

  function heartbeat() {
    this.isAlive = true
  }

  wss.on('connection', ws => {
    ws.isAlive = true
    ws.on('error', err => console.error('[WS] client error:', err.message))
    ws.on('pong', heartbeat)
    ws.on('message', data => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
      } catch {}
    })
    ws.send(JSON.stringify({ type: 'status', data: { message: 'HotPulse 已连接' } }))
  })

  // Heartbeat interval - terminate dead connections
  const interval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) return ws.terminate()
      ws.isAlive = false
      ws.ping()
    })
  }, 30000)

  wss.on('close', () => clearInterval(interval))
  console.log('[WS] WebSocket server initialized')
  return wss
}

export function broadcast(payload) {
  if (!wss) return
  const data = JSON.stringify(payload)
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
}

export function getClientCount() {
  return wss ? wss.clients.size : 0
}
