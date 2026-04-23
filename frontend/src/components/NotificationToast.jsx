import { useEffect, useState } from 'react'
import { X, Bell, TrendingUp, ExternalLink } from 'lucide-react'

export default function NotificationToast({ toast, onClose }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300) }, 5500)
    return () => clearTimeout(t)
  }, [onClose])

  const isAlert = toast.type === 'alert'
  const accent = isAlert ? '#22d3ee' : '#34d399'
  const bgAccent = isAlert ? 'rgba(34,211,238,0.08)' : 'rgba(52,211,153,0.08)'

  return (
    <div
      className={`pointer-events-auto toast-enter w-full rounded-xl p-3.5 transition-all duration-300 ${
        visible ? 'opacity-100' : 'translate-x-2 opacity-0'
      }`}
      style={{
        background: '#18181b',
        border: '1px solid rgba(255,255,255,0.09)',
        borderLeft: `3px solid ${accent}`,
        boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: bgAccent }}>
          {isAlert
            ? <Bell className="h-3.5 w-3.5" style={{ color: accent }} />
            : <TrendingUp className="h-3.5 w-3.5" style={{ color: accent }} />
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-xs font-semibold text-white">{toast.title}</p>
          <p className="line-clamp-2 text-xs text-hp-muted">{toast.body}</p>
          {toast.url && (
            <a
              href={toast.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[11px] transition-opacity hover:opacity-80"
              style={{ color: accent }}
            >
              查看原文 <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
          className="flex-shrink-0 cursor-pointer text-hp-dim transition-colors hover:text-hp-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
