import { useState, useCallback, useEffect, useRef } from 'react'
import { NavLink } from 'react-router'
import {
  TrendingUp, Tag, Search, Bell, BellOff, BellRing,
  RefreshCw, Zap, Settings,
} from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useBrowserNotification } from '../hooks/useNotification'
import { alertsApi } from '../lib/api'
import NotificationToast from './NotificationToast'
import NotificationPanel from './NotificationPanel'
import GridBackground from './aceternity/GridBackground'

const navItems = [
  { to: '/', label: '热点雷达', icon: TrendingUp },
  { to: '/keywords', label: '监控词', icon: Tag },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/settings', label: '设置', icon: Settings },
]

export default function Layout({ children }) {
  const [toasts, setToasts] = useState([])
  const [alertsList, setAlertsList] = useState([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [keywordScanning, setKeywordScanning] = useState(false)
  const [popupEnabled, setPopupEnabled] = useState(() => {
    const saved = localStorage.getItem('hp-system-notify-enabled')
    return saved == null ? true : saved === 'true'
  })
  const seenAlertKeysRef = useRef(new Set())
  const { notify } = useBrowserNotification()

  useEffect(() => {
    alertsApi.getAll({ unread: 1, limit: 50 })
      .then(list => {
        const alerts = list || []
        alerts.forEach(a => {
          seenAlertKeysRef.current.add(a.id ?? `${a.keyword}:${a.url || a.title}`)
        })
        setAlertsList(alerts)
      }).catch(() => {})
  }, [])

  useEffect(() => {
    const h = e => setKeywordScanning(e.detail.active)
    window.addEventListener('hp:keyword-scanning', h)
    return () => window.removeEventListener('hp:keyword-scanning', h)
  }, [])

  useEffect(() => {
    localStorage.setItem('hp-system-notify-enabled', String(popupEnabled))
  }, [popupEnabled])

  const handleMessage = useCallback(msg => {
    if (msg.type !== 'alert') return
    const a = msg.data
    const key = a.id ?? `${a.keyword}:${a.url || a.title}`
    if (seenAlertKeysRef.current.has(key)) return
    seenAlertKeysRef.current.add(key)
    setAlertsList(prev => [{ ...a, receivedAt: new Date().toISOString() }, ...prev].slice(0, 50))
    setToasts(p => [{ id: Date.now(), type: 'alert', title: `新预警 · ${a.keyword}`, body: a.title, url: a.url }, ...p].slice(0, 4))
    if (popupEnabled) notify(`HotPulse: ${a.keyword}`, a.title, a.url)
  }, [notify, popupEnabled])

  const { connected } = useWebSocket(handleMessage)
  const removeToast = id => setToasts(p => p.filter(t => t.id !== id))
  const togglePanel = () => setPanelOpen(v => !v)
  const closePanel = useCallback(() => setPanelOpen(false), [])
  const togglePopup = useCallback(() => setPopupEnabled(p => !p), [])
  const handleClearAll = useCallback(async () => {
    setAlertsList([])
    seenAlertKeysRef.current.clear()
    setPanelOpen(false)
    try { await alertsApi.clearAll() } catch {}
  }, [])

  const unreadCount = alertsList.length

  return (
    <div className="relative min-h-screen text-hp-text" style={{ backgroundColor: '#09090b' }}>
      <GridBackground />

      {/* ─────────── Top Nav ─────────── */}
      <header
        className="sticky top-0 z-50 w-full"
        style={{
          background: 'rgba(9,9,11,0.85)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Cyan accent underline */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" />

        <div className="relative z-[1] flex h-[58px] w-full items-center gap-3 px-6">
          {/* Logo */}
          <div className="mr-4 flex flex-shrink-0 items-center gap-2.5">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
              style={{
                background: 'linear-gradient(135deg,#22d3ee 0%,#818cf8 100%)',
                boxShadow: '0 0 18px rgba(34,211,238,0.32)',
              }}
            >
              <Zap className="h-4 w-4 text-neutral-950" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="hp-font-display text-sm font-semibold tracking-tight text-white">HotPulse</div>
              <div className="text-[10px] uppercase tracking-widest text-hp-dim">AI 热点雷达</div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-0.5">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to} to={to} end={to === '/'}
                className={({ isActive }) => `hp-nav-link${isActive ? ' hp-nav-link-active' : ''}`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2">
            <div className={`hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              connected
                ? 'border-cyan-400/20 bg-cyan-400/8 text-cyan-300'
                : 'border-white/[0.07] bg-white/[0.03] text-hp-dim'
            }`}>
              {connected
                ? <><span className="hp-dot-live" /> 实时链路</>
                : <><span className="h-2 w-2 rounded-full bg-hp-dim/50" /> 已离线</>
              }
            </div>

            {keywordScanning && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/8 px-2.5 py-1.5 text-xs font-medium text-cyan-300">
                <RefreshCw className="h-3 w-3 motion-safe:animate-spin" />
                扫描中
              </div>
            )}

            <button type="button" onClick={togglePopup}
              className={`hidden sm:flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                popupEnabled
                  ? 'border-emerald-400/20 bg-emerald-400/8 text-emerald-300'
                  : 'border-white/[0.07] bg-white/[0.03] text-hp-dim hover:text-hp-muted'
              }`}>
              {popupEnabled ? <BellRing className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              {popupEnabled ? '通知已开' : '通知关闭'}
            </button>

            <div className="relative">
              <button type="button" onClick={togglePanel}
                className={`relative cursor-pointer rounded-lg p-2 transition-colors ${
                  panelOpen ? 'bg-white/[0.07] text-hp-text' : 'text-hp-dim hover:bg-white/[0.05] hover:text-hp-muted'
                }`}>
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-neutral-950"
                    style={{ background: 'linear-gradient(135deg,#fb923c,#f87171)' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationPanel open={panelOpen} onClose={closePanel} alerts={alertsList} onClearAll={handleClearAll} />
            </div>
          </div>
        </div>
      </header>

      {/* ─────────── Page Content ─────────── */}
      <main className="relative z-[1] mx-auto w-full max-w-[1320px] px-6 py-8">
        {children}
      </main>

      {/* Toast stack */}
      <div className="pointer-events-none fixed right-4 top-[70px] z-50 flex w-80 flex-col gap-2">
        {toasts.map(t => (
          <NotificationToast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </div>
  )
}
