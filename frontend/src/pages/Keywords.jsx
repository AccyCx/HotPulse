import { useState, useEffect } from 'react'
import { Tag, Plus, Trash2, RefreshCw, AlertCircle, Radar, CheckCircle2, Clock } from 'lucide-react'
import { keywordsApi } from '../lib/api'
import BorderBeam from '../components/aceternity/BorderBeam'
import Sparkles from '../components/aceternity/Sparkles'

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

function KeywordCard({ kw, onToggle, onDelete, isInitialScanning }) {
  const isActive = !!kw.enabled

  return (
    <div
      className="hp-card group relative cursor-default overflow-hidden p-4 transition-all duration-200"
      style={isActive ? {
        borderColor: 'rgba(34,211,238,0.18)',
        boxShadow: '0 0 0 1px rgba(34,211,238,0.06)',
      } : {}}
    >
      {/* Active glow line */}
      {isActive && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      )}

      <div className="flex items-center gap-4">
        {/* Toggle */}
        <label className="hp-toggle flex-shrink-0">
          <input type="checkbox" checked={isActive} onChange={() => onToggle(kw.id, !kw.enabled)} />
          <div className="hp-toggle-track"><div className="hp-toggle-thumb" /></div>
        </label>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="hp-font-display text-sm font-semibold text-white">{kw.keyword}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                background: isActive ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)',
                color: isActive ? '#22d3ee' : '#52525b',
                border: `1px solid ${isActive ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {isActive ? '● 监控中' : '○ 已暂停'}
            </span>
            {isInitialScanning && (
              <span className="flex items-center gap-1 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                <RefreshCw className="h-2.5 w-2.5" style={{ animation: 'spin 1s linear infinite' }} />
                首次扫描中
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-4 text-[11px] text-hp-dim">
            <span className="flex items-center gap-1">
              <Radar className="h-3 w-3" />
              已扫描 {kw.check_count ?? 0} 次
            </span>
            {kw.last_checked_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                上次扫描 {timeAgo(kw.last_checked_at)}
              </span>
            )}
          </div>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(kw.id)}
          className="flex-shrink-0 cursor-pointer rounded-lg p-2 text-hp-dim opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
          title="删除监控词"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function Keywords() {
  const [keywords, setKeywords] = useState([])
  const [inputVal, setInputVal] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [scanningIds, setScanningIds] = useState(new Set())

  useEffect(() => {
    keywordsApi.getAll()
      .then(setKeywords)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!inputVal.trim() || adding) return
    setError('')
    setAdding(true)
    window.dispatchEvent(new CustomEvent('hp:keyword-scanning', { detail: { active: true } }))
    try {
      const kw = await keywordsApi.add(inputVal.trim())
      setKeywords(p => [kw, ...p])
      setInputVal('')
      setScanningIds(prev => new Set(prev).add(kw.id))
      setTimeout(() => {
        setScanningIds(prev => { const n = new Set(prev); n.delete(kw.id); return n })
      }, 60_000)
    } catch (err) {
      setError(String(err))
    } finally {
      setAdding(false)
      window.dispatchEvent(new CustomEvent('hp:keyword-scanning', { detail: { active: false } }))
    }
  }

  async function handleToggle(id, enabled) {
    const u = await keywordsApi.toggle(id, enabled)
    setKeywords(p => p.map(k => k.id === id ? u : k))
  }

  async function handleDelete(id) {
    if (!confirm('确认删除该监控词？历史热点将保留 5 天后自动清理。')) return
    await keywordsApi.remove(id)
    setKeywords(p => p.filter(k => k.id !== id))
  }

  const activeCount = keywords.filter(k => k.enabled).length

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400/70">
            <Radar className="h-3.5 w-3.5" />
            关键词监控
          </p>
          <h1 className="hp-font-display text-2xl font-bold text-white">监控词管理</h1>
          <p className="mt-1.5 text-sm text-hp-dim">
            添加关键词后，AI 每 30 分钟自动全网扫描并验证内容真实性
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-hp-dim">
          <span>共 <span className="font-semibold text-white">{keywords.length}</span> 个</span>
          <span className="text-hp-faint">|</span>
          <span>监控中 <span className="font-semibold text-cyan-300">{activeCount}</span> 个</span>
        </div>
      </div>

      {/* ── Add Keyword Panel ── */}
      <BorderBeam>
        <div className="p-6">
          <h2 className="hp-font-display mb-4 flex items-center gap-2 text-base font-semibold text-white">
            <Tag className="h-4 w-4 text-cyan-400" />
            添加新监控词
          </h2>
          <form onSubmit={handleAdd} className="flex gap-3">
            <input
              className="hp-input flex-1 text-sm"
              placeholder="输入关键词：Claude 4 / GPT-5 / Sora / 量子计算..."
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              disabled={adding}
            />
            <button type="submit" disabled={adding} className="hp-btn flex-shrink-0 disabled:opacity-60">
              {adding
                ? <><RefreshCw className="h-4 w-4" style={{ animation: 'spin 1s linear infinite' }} />扫描中...</>
                : <><Plus className="h-4 w-4" />添加</>
              }
            </button>
          </form>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5" />{error}
            </p>
          )}
          <p className="mt-3 text-xs text-hp-dim">
            添加后立即触发首次扫描 · AI 智能验真，过滤低质量内容
          </p>
        </div>
      </BorderBeam>

      {/* ── Keyword List ── */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="hp-spinner" /></div>
      ) : keywords.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/[0.1] bg-hp-surface/50 p-16 text-center">
          <Sparkles
            id="empty-sparkles"
            className="absolute inset-0"
            particleColor="#22d3ee"
            particleDensity={25}
            speed={0.4}
            maxSize={1.0}
          />
          <div className="relative z-[1]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04]">
              <Tag className="h-7 w-7 text-hp-dim" />
            </div>
            <p className="text-base font-medium text-hp-muted">尚未添加任何监控词</p>
            <p className="mt-1.5 text-sm text-hp-dim">在上方输入框添加第一个关键词，开始捕捉热点信号</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {keywords.map(kw => (
            <KeywordCard
              key={kw.id}
              kw={kw}
              onToggle={handleToggle}
              onDelete={handleDelete}
              isInitialScanning={scanningIds.has(kw.id)}
            />
          ))}
        </div>
      )}

      {/* ── Tips ── */}
      {keywords.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-hp-surface/50 px-5 py-4 text-xs text-hp-dim">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400/60" />
          <span>
            关闭开关暂停该词的监控，历史热点数据保留。删除监控词后历史热点保留 5 天自动清理。
          </span>
        </div>
      )}
    </div>
  )
}
