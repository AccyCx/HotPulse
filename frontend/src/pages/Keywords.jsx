import { useState, useEffect } from 'react'
import { Tag, Plus, Trash2, RefreshCw, AlertCircle, Activity } from 'lucide-react'
import { keywordsApi } from '../lib/api'

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
  return (
    <div className="hp-card">
      <div className="flex items-center gap-3 p-4">
        <label className="hp-toggle flex-shrink-0">
          <input type="checkbox" checked={!!kw.enabled} onChange={() => onToggle(kw.id, !kw.enabled)} />
          <div className="hp-toggle-track"><div className="hp-toggle-thumb" /></div>
        </label>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="hp-font-display text-sm font-semibold text-white">{kw.keyword}</span>
            <span className="rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                background: kw.enabled ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)',
                color: kw.enabled ? '#22d3ee' : '#52525b',
              }}>
              {kw.enabled ? '● 监控中' : '○ 已暂停'}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-[11px] text-hp-dim">已扫描 {kw.check_count} 次</span>
            {kw.last_checked_at && (
              <span className="text-[11px] text-hp-dim">上次: {timeAgo(kw.last_checked_at)}</span>
            )}
            {isInitialScanning && (
              <span className="flex items-center gap-1 rounded border border-cyan-400/18 bg-cyan-400/8 px-1.5 py-0.5 text-[11px] font-medium text-cyan-300">
                <RefreshCw className="h-2.5 w-2.5 motion-safe:animate-spin" />
                首次扫描中
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDelete(kw.id)}
          className="cursor-pointer rounded-lg p-2 text-hp-dim transition-colors hover:bg-red-500/10 hover:text-red-400"
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
    keywordsApi.getAll().then(setKeywords).catch(e => setError(String(e))).finally(() => setLoading(false))
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
        setScanningIds(prev => { const next = new Set(prev); next.delete(kw.id); return next })
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

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-5">
      <div className="hp-card p-5">
        <h2 className="hp-font-display mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <Tag className="h-4 w-4 text-cyan-400" />
          添加监控词
        </h2>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            className="hp-input flex-1"
            placeholder="输入关键词：Claude 4 / GPT-5 / Gemini Ultra..."
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            disabled={adding}
          />
          <button type="submit" disabled={adding} className="hp-btn flex-shrink-0 disabled:opacity-60">
            {adding
              ? <><RefreshCw className="h-4 w-4 motion-safe:animate-spin" /> 扫描中...</>
              : <><Plus className="h-4 w-4" /> 添加</>
            }
          </button>
        </form>
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </p>
        )}
        <p className="mt-3 text-xs text-hp-dim">
          AI 会验证内容真实性，过滤误报后再推送通知
        </p>
      </div>

      <div className="text-sm text-hp-dim">
        共 <span className="font-semibold text-white">{keywords.length}</span> 个监控词
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="hp-spinner" /></div>
      ) : keywords.length === 0 ? (
        <div className="hp-card p-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02]">
            <Activity className="h-6 w-6 text-hp-dim" />
          </div>
          <p className="text-sm font-medium text-hp-muted">尚未配置监控词</p>
          <p className="mt-1 text-xs text-hp-dim">添加后每 30 分钟自动全网扫描</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keywords.map(kw => (
            <KeywordCard key={kw.id} kw={kw} onToggle={handleToggle} onDelete={handleDelete}
              isInitialScanning={scanningIds.has(kw.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
