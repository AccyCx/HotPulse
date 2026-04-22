import { useState, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router'
import { TrendingUp, Tag, Search, Bell, RefreshCw, Zap, Radio } from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useBrowserNotification } from '../hooks/useNotification'
import NotificationToast from './NotificationToast'

const navItems = [
  { to: '/',         icon: TrendingUp, label: '热点雷达' },
  { to: '/keywords', icon: Tag,        label: '监控词'   },
  { to: '/topics',   icon: Radio,      label: '热点域'   },
]

export default function Layout({ children }) {
  const [toasts, setToasts]         = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const { notify } = useBrowserNotification()
  const location   = useLocation()

  const handleMessage = useCallback(msg => {
    if (msg.type === 'alert') {
      const a = msg.data
      setUnreadCount(c => c + 1)
      setToasts(p => [{ id: Date.now(), type: 'alert', title: `新预警 · ${a.keyword}`, body: a.title, url: a.url }, ...p].slice(0, 4))
      notify(`HotPulse: ${a.keyword}`, a.title, a.url)
    } else if (msg.type === 'topics') {
      setToasts(p => [{ id: Date.now(), type: 'topic', title: `热点更新 · ${msg.data.domain}`, body: `发现 ${msg.data.count} 条新内容` }, ...p].slice(0, 4))
    }
  }, [notify])

  const { connected } = useWebSocket(handleMessage)
  const removeToast   = id => setToasts(p => p.filter(t => t.id !== id))
  const clearUnread   = () => setUnreadCount(0)

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

            {/* Notification bell */}
            <button
              onClick={clearUnread}
              className="relative p-2 rounded-lg cursor-pointer transition-colors"
              style={{ color: '#94A3B8' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
