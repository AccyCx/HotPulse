import { useState, useEffect } from 'react'
import { Tag, Plus, Trash2, RefreshCw, ExternalLink, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react'
import { keywordsApi, alertsApi } from '../lib/api'

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

function AlertItem({ alert, onRead }) {
  const score = Math.round((alert.relevance_score || 0) * 100)
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
      alert.is_read
        ? 'border-transparent'
        : 'border-blue-500/20 bg-blue-500/[0.04]'
    }`}>
      <button onClick={() => onRead(alert.id)} className="mt-0.5 cursor-pointer flex-shrink-0 transition-colors">
        <CheckCircle2 className={`w-4 h-4 ${alert.is_read ? 'text-hp-dim' : 'text-blue-400'}`} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>
            {alert.source}
          </span>
          <span className="text-[11px] font-semibold" style={{ color: '#10B981' }}>
            {score}% 相关
          </span>
          <span className="text-[11px] ml-auto" style={{ color: '#475569' }}>
            {timeAgo(alert.triggered_at)}
          </span>
        </div>
        <p className={`text-sm leading-snug ${alert.is_read ? 'text-hp-dim' : 'text-hp-text'}`}>
          {alert.title}
        </p>
        {alert.summary && (
          <p className="text-xs mt-1 line-clamp-1" style={{ color: '#64748B' }}>{alert.summary}</p>
        )}
      </div>
      {alert.url && (
        <a href={alert.url} target="_blank" rel="noopener noreferrer"
          className="text-hp-dim hover:text-hp-muted cursor-pointer flex-shrink-0 transition-colors p-1">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  )
}

function KeywordCard({ kw, onToggle, onDelete }) {
  const [expanded,      setExpanded]      = useState(false)
  const [alerts,        setAlerts]        = useState([])
  const [loadingAlerts, setLoadingAlerts] = useState(false)

  async function toggleExpand() {
    if (!expanded) {
      setLoadingAlerts(true)
      try { setAlerts(await keywordsApi.getAlerts(kw.id, { limit: 10 })) } catch {}
      finally { setLoadingAlerts(false) }
    }
    setExpanded(v => !v)
  }

  async function handleRead(id) {
    await alertsApi.markRead(id)
    setAlerts(p => p.map(a => a.id === id ? { ...a, is_read: 1 } : a))
  }

  return (
    <div className="hp-card overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        {/* Toggle */}
        <label className="hp-toggle flex-shrink-0">
          <input type="checkbox" checked={!!kw.enabled} onChange={() => onToggle(kw.id, !kw.enabled)} />
          <div className="hp-toggle-track"><div className="hp-toggle-thumb" /></div>
        </label>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{kw.keyword}</span>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: kw.enabled ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                color:      kw.enabled ? '#10B981' : '#475569',
              }}>
              {kw.enabled ? '● 监控中' : '○ 已暂停'}
            </span>
          </div>
          <div className="flex gap-3 mt-1">
            <span className="text-[11px]" style={{ color: '#475569' }}>已扫描 {kw.check_count} 次</span>
            {kw.last_checked_at && (
              <span className="text-[11px]" style={{ color: '#475569' }}>
                上次: {timeAgo(kw.last_checked_at)}
              </span>
            )}
          </div>
        </div>

        <button onClick={toggleExpand}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color:      '#94A3B8',
            border:     '1px solid rgba(255,255,255,0.08)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#E2E8F0' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94A3B8' }}
        >
          预警记录
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <button onClick={() => onDelete(kw.id)}
          className="p-2 rounded-lg cursor-pointer transition-colors"
          style={{ color: '#475569' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569' }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-1.5 animate-fade-in"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
          {loadingAlerts ? (
            <div className="flex justify-center py-6"><div className="hp-spinner" /></div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-6 text-sm" style={{ color: '#475569' }}>暂无预警记录</div>
          ) : (
            alerts.map(a => <AlertItem key={a.id} alert={a} onRead={handleRead} />)
          )}
        </div>
      )}
    </div>
  )
}

export default function Keywords() {
  const [keywords, setKeywords] = useState([])
  const [inputVal, setInputVal] = useState('')
  const [loading,  setLoading]  = useState(true)
  const [checking, setChecking] = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    keywordsApi.getAll().then(setKeywords).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!inputVal.trim()) return
    setError('')
    try {
      const kw = await keywordsApi.add(inputVal.trim())
      setKeywords(p => [kw, ...p])
      setInputVal('')
    } catch (err) { setError(String(err)) }
  }

  async function handleToggle(id, enabled) {
    const u = await keywordsApi.toggle(id, enabled)
    setKeywords(p => p.map(k => k.id === id ? u : k))
  }

  async function handleDelete(id) {
    if (!confirm('确认删除该监控词及所有预警记录？')) return
    await keywordsApi.remove(id)
    setKeywords(p => p.filter(k => k.id !== id))
  }

  async function handleCheckNow() {
    setChecking(true)
    try { await keywordsApi.checkNow() } catch {}
    setTimeout(() => setChecking(false), 2500)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Add panel */}
      <div className="hp-card p-5">
        <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
          <Tag className="w-4 h-4" style={{ color: '#06B6D4' }} />
          添加监控词
        </h2>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            className="hp-input flex-1"
            placeholder="输入关键词：Claude 4 / GPT-5 / Gemini Ultra..."
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
          />
          <button type="submit" className="hp-btn flex-shrink-0 gap-1.5">
            <Plus className="w-4 h-4" /> 添加
          </button>
        </form>
        {error && (
          <p className="flex items-center gap-1.5 text-xs mt-2" style={{ color: '#EF4444' }}>
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </p>
        )}
        <p className="text-xs mt-3" style={{ color: '#475569' }}>
          AI 会验证内容真实性，过滤误报后再推送通知
        </p>
      </div>

      {/* List header */}
      <div className="flex items-center justify-between">
        <div className="text-sm" style={{ color: '#64748B' }}>
          共 <span className="font-semibold text-white">{keywords.length}</span> 个监控词
        </div>
        <button onClick={handleCheckNow} disabled={checking} className="hp-btn-ghost text-xs py-1.5 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? '扫描中...' : '立即扫描'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="hp-spinner" /></div>
      ) : keywords.length === 0 ? (
        <div className="hp-card p-14 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <Tag className="w-6 h-6" style={{ color: '#475569' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#64748B' }}>尚未配置监控词</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keywords.map(kw => (
            <KeywordCard key={kw.id} kw={kw} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
