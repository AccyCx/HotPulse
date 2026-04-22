import { useCallback, useEffect, useRef } from 'react'

export function useBrowserNotification() {
  const permissionRef = useRef(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )

  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => { permissionRef.current = p })
    }
  }, [])

  const notify = useCallback((title, body, url) => {
    if (permissionRef.current !== 'granted') return
    const n = new Notification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    })
    if (url) n.onclick = () => { window.focus(); window.open(url, '_blank') }
  }, [])

  return { notify }
}
