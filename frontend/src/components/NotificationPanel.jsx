import { useEffect, useRef } from 'react'
import { Bell, CheckCheck, ExternalLink, Inbox } from 'lucide-react'

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return '刚刚'
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
      className="absolute right-0 top-[calc(100%+8px)] z-[100] flex max-h-[520px] w-[360px] animate-fade-in flex-col overflow-hidden rounded-xl"
      style={{
        background: 'rgba(14,14,17,0.97)',
        border: '1px solid rgba(34,211,238,0.14)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">预警通知</span>
          {alerts.length > 0 && (
            <span className="rounded border border-cyan-400/18 bg-cyan-400/8 px-1.5 py-0.5 text-[11px] font-medium text-cyan-300">
              {alerts.length}
            </span>
          )}
        </div>
        {alerts.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-hp-muted transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            全部已读
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.03]">
              <Inbox className="h-5 w-5 text-hp-dim" />
            </div>
            <p className="text-xs font-medium text-hp-dim">暂无新预警</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {alerts.map(a => (
              <li
                key={a.id}
                className="p-3.5 transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-400/10">
                    <Bell className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-cyan-300">{a.keyword}</span>
                      {a.source && (
                        <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-hp-muted">{a.source}</span>
                      )}
                      <span className="ml-auto text-[11px] text-hp-dim">
                        {timeAgo(a.triggered_at || a.receivedAt)}
                      </span>
                    </div>
                    <p className="mb-1 line-clamp-2 text-xs leading-snug text-white">{a.title}</p>
                    {a.url && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-cyan-400 transition-colors hover:text-cyan-300"
                        onClick={e => e.stopPropagation()}
                      >
                        查看原文 <ExternalLink className="h-3 w-3" />
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
