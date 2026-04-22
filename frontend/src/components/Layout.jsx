import { useState, useCallback, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router'
import { TrendingUp, Tag, Search, Bell, BellOff, BellRing, RefreshCw, Zap, Radio } from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useBrowserNotification } from '../hooks/useNotification'
import { alertsApi } from '../lib/api'
import NotificationToast from './NotificationToast'
import NotificationPanel from './NotificationPanel'

const navItems = [
  { to: '/',         icon: TrendingUp, label: '热点雷达' },
  { to: '/keywords', icon: Tag,        label: '监控词'   },
  { to: '/topics',   icon: Radio,      label: '热点域'   },
]

export default function Layout({ children }) {
  const [toasts,          setToasts]          = useState([])
  const [alertsList,      setAlertsList]      = useState([])
  const [panelOpen,       setPanelOpen]       = useState(false)
  const [keywordScanning, setKeywordScanning] = useState(false)
  const [popupEnabled,    setPopupEnabled]    = useState(() => {
    const saved = localStorage.getItem('hp-system-notify-enabled')
    return saved == null ? true : saved === 'true'
  })
  const seenAlertKeysRef = useRef(new Set())
  const { notify } = useBrowserNotification()
  const location   = useLocation()

  // Load existing unread alerts on mount so the bell shows the real count
  useEffect(() => {
    alertsApi.getAll({ unread: 1, limit: 50 })
      .then(list => {
        const alerts = list || []
        alerts.forEach(a => {
          const key = a.id ?? `${a.keyword}:${a.url || a.title}`
          seenAlertKeysRef.current.add(key)
        })
        setAlertsList(alerts)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = e => setKeywordScanning(e.detail.active)
    window.addEventListener('hp:keyword-scanning', handler)
    return () => window.removeEventListener('hp:keyword-scanning', handler)
  }, [])

  useEffect(() => {
    localStorage.setItem('hp-system-notify-enabled', String(popupEnabled))
  }, [popupEnabled])

  const handleMessage = useCallback(msg => {
    if (msg.type === 'alert') {
      const a = msg.data
      const alertKey = a.id ?? `${a.keyword}:${a.url || a.title}`
      if (seenAlertKeysRef.current.has(alertKey)) return
      seenAlertKeysRef.current.add(alertKey)

      setAlertsList(prev => {
        return [{ ...a, receivedAt: new Date().toISOString() }, ...prev].slice(0, 50)
      })
      setToasts(p => [{ id: Date.now(), type: 'alert', title: `新预警 · ${a.keyword}`, body: a.title, url: a.url }, ...p].slice(0, 4))
      if (popupEnabled) notify(`HotPulse: ${a.keyword}`, a.title, a.url)
    } else if (msg.type === 'topics') {
      setToasts(p => [{ id: Date.now(), type: 'topic', title: `热点更新 · ${msg.data.domain}`, body: `发现 ${msg.data.count} 条新内容` }, ...p].slice(0, 4))
    }
  }, [notify, popupEnabled])

  const { connected } = useWebSocket(handleMessage)
  const removeToast   = id => setToasts(p => p.filter(t => t.id !== id))

  const togglePanel = () => setPanelOpen(v => !v)
  const closePanel  = useCallback(() => setPanelOpen(false), [])
  const togglePopupEnabled = useCallback(() => {
    setPopupEnabled(prev => !prev)
  }, [])

  const handleClearAll = useCallback(async () => {
    setAlertsList([])
    seenAlertKeysRef.current.clear()
    setPanelOpen(false)
    try { await alertsApi.clearAll() } catch {}
  }, [])

  const unreadCount = alertsList.length

  return (
    <div className="min-h-screen" style={{ background: '#080C18' }}>
      {/* ── Top Nav ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background:    'rgba(8,12,24,0.92)',
          backdropFilter: 'blur(16px)',
          borderColor:   'rgba(255,255,255,0.07)',
        }}
      >
        <div className="max-w-7xl mx-auto px-5 h-[60px] flex items-center gap-3">

          {/* Logo */}
          <div className="flex items-center gap-2.5 mr-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)' }}>
              <Zap className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-white text-sm tracking-tight">HotPulse</div>
              <div className="text-[10px] font-medium" style={{ color: '#475569' }}>AI 热点雷达</div>
            </div>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `hp-nav-link${isActive ? ' hp-nav-link-active' : ''}`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2.5">
            {/* Connection status + Scan button */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              style={{
                background: connected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                color:      connected ? '#60A5FA' : '#475569',
                border:    `1px solid ${connected ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connected ? 'animate-spin-slow' : ''}`} />
              {connected ? '扫描中' : '已离线'}
            </div>

            {/* Keyword scanning indicator */}
            {keywordScanning && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: 'rgba(6,182,212,0.15)',
                  color:      '#06B6D4',
                  border:     '1px solid rgba(6,182,212,0.3)',
                }}
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                扫描中
              </div>
            )}

            {/* System notification toggle */}
            <button
              onClick={togglePopupEnabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              style={{
                background: popupEnabled ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.05)',
                color:      popupEnabled ? '#10B981' : '#94A3B8',
                border:     `1px solid ${popupEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {popupEnabled ? <BellRing className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              {popupEnabled ? '系统通知已开' : '系统通知已关'}
            </button>

            {/* Notification bell + dropdown panel */}
            <div className="relative">
              <button
                onClick={togglePanel}
                className="relative p-2 rounded-lg cursor-pointer transition-colors"
                style={{
                  color:      panelOpen ? '#E2E8F0' : '#94A3B8',
                  background: panelOpen ? 'rgba(255,255,255,0.06)' : 'transparent',
                }}
                onMouseEnter={e => { if (!panelOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (!panelOpen) e.currentTarget.style.background = 'transparent' }}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full
                               text-[9px] font-bold text-white flex items-center justify-center px-1"
                    style={{ background: '#EF4444' }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <NotificationPanel
                open={panelOpen}
                onClose={closePanel}
                alerts={alertsList}
                onClearAll={handleClearAll}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="max-w-7xl mx-auto px-5 py-6">
        {children}
      </main>

      {/* ── Toast stack ── */}
      <div className="fixed top-[72px] right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
        {toasts.map(t => (
          <NotificationToast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </div>
  )
}
