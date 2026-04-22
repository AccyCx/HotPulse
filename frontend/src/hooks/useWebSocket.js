import { useEffect, useRef, useState } from 'react'

export function useWebSocket(onMessage) {
  const wsRef          = useRef(null)
  const reconnectTimer = useRef(null)
  const onMessageRef   = useRef(onMessage)
  const [connected, setConnected] = useState(false)

  // Keep the latest callback without re-running the connect effect
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    let cancelled = false

    function connect() {
      if (cancelled) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) { ws.close(); return }
        setConnected(true)
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current)
          reconnectTimer.current = null
        }
      }

      ws.onmessage = e => {
        try {
          const msg = JSON.parse(e.data)
          onMessageRef.current?.(msg)
        } catch {}
      }

      ws.onclose = () => {
        setConnected(false)
        if (cancelled) return
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
        reconnectTimer.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  return { connected }
}
