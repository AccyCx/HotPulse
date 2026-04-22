import { useEffect, useState } from 'react'
import { X, Bell, TrendingUp, ExternalLink } from 'lucide-react'

export default function NotificationToast({ toast, onClose }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300) }, 5500)
    return () => clearTimeout(t)
  }, [onClose])

  const isAlert  = toast.type === 'alert'
  const accent   = isAlert ? '#3B82F6' : '#10B981'
  const bgAccent = isAlert ? 'rgba(59,130,246,0.08)' : 'rgba(16,185,129,0.08)'

  return (
    <div
      className={`pointer-events-auto toast-enter p-3.5 w-full transition-all duration-300 rounded-xl
                  ${visible ? 'opacity-100' : 'opacity-0 translate-x-4'}`}
      style={{
        background:  '#111827',
        border:      `1px solid rgba(255,255,255,0.1)`,
        borderLeft:  `3px solid ${accent}`,
        boxShadow:   '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5 rounded-lg"
          style={{ background: bgAccent }}>
          {isAlert
            ? <Bell className="w-3.5 h-3.5" style={{ color: accent }} />
            : <TrendingUp className="w-3.5 h-3.5" style={{ color: accent }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white mb-0.5">{toast.title}</p>
          <p className="text-xs text-hp-muted line-clamp-2">{toast.body}</p>
          {toast.url && (
            <a href={toast.url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] flex items-center gap-1 mt-1.5 cursor-pointer hover:opacity-80 transition-opacity"
              style={{ color: accent }}>
              查看原文 <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <button onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
          className="cursor-pointer text-hp-dim hover:text-hp-muted flex-shrink-0 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
