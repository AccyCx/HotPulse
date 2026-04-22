import { useEffect, useRef } from 'react'
import { Bell, CheckCheck, ExternalLink, Inbox } from 'lucide-react'

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

export default function NotificationPanel({ open, onClose, alerts, onClearAll }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    const esc = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-[calc(100%+8px)] w-[380px] max-h-[520px] rounded-xl animate-fade-in overflow-hidden flex flex-col"
      style={{
        background:  '#0F1629',
        border:      '1px solid rgba(255,255,255,0.1)',
        boxShadow:   '0 16px 48px rgba(0,0,0,0.6)',
        zIndex:      100,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: '#06B6D4' }} />
          <span className="text-sm font-semibold text-white">新预警</span>
          {alerts.length > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}>
              {alerts.length}
            </span>
          )}
        </div>
        {alerts.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded cursor-pointer transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E2E8F0' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            全部已读
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <Inbox className="w-5 h-5" style={{ color: '#475569' }} />
            </div>
            <p className="text-xs font-medium" style={{ color: '#64748B' }}>暂无新预警</p>
          </div>
        ) : (
          <ul className="divide-y" style={{ '--tw-divide-opacity': 1, borderColor: 'rgba(255,255,255,0.05)' }}>
            {alerts.map(a => (
              <li key={a.id} className="p-3.5 transition-colors"
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(59,130,246,0.1)' }}>
                    <Bell className="w-3.5 h-3.5" style={{ color: '#60A5FA' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] font-semibold" style={{ color: '#06B6D4' }}>
                        {a.keyword}
                      </span>
                      {a.source && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8' }}>
                          {a.source}
                        </span>
                      )}
                      <span className="text-[11px] ml-auto" style={{ color: '#475569' }}>
                        {timeAgo(a.triggered_at || a.receivedAt)}
                      </span>
                    </div>
                    <p className="text-xs leading-snug text-white mb-1 line-clamp-2">{a.title}</p>
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ color: '#60A5FA' }}
                        onClick={e => e.stopPropagation()}>
                        查看原文 <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
