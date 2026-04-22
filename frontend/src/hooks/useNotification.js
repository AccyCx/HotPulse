import { useEffect, useRef } from 'react'

export function useBrowserNotification() {
  const permissionRef = useRef(Notification.permission)

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => { permissionRef.current = p })
    }
  }, [])

  const notify = (title, body, url) => {
    if (permissionRef.current !== 'granted') return
    const n = new Notification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    })
    if (url) n.onclick = () => { window.focus(); window.open(url, '_blank') }
  }

  return { notify }
}
