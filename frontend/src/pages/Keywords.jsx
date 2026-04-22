import { useState, useEffect } from 'react'
import { Tag, Plus, Trash2, RefreshCw, AlertCircle } from 'lucide-react'
import { keywordsApi } from '../lib/api'

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

function KeywordCard({ kw, onToggle, onDelete, isInitialScanning }) {
  return (
    <div className="hp-card">
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
          <div className="flex gap-3 mt-1 items-center">
            <span className="text-[11px]" style={{ color: '#475569' }}>已扫描 {kw.check_count} 次</span>
            {kw.last_checked_at && (
              <span className="text-[11px]" style={{ color: '#475569' }}>
                上次: {timeAgo(kw.last_checked_at)}
              </span>
            )}
            {isInitialScanning && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(6,182,212,0.12)', color: '#06B6D4' }}>
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                首次扫描中
              </span>
            )}
          </div>
        </div>

        <button onClick={() => onDelete(kw.id)}
          className="p-2 rounded-lg cursor-pointer transition-colors"
          style={{ color: '#475569' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569' }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function Keywords() {
  const [keywords,    setKeywords]    = useState([])
  const [inputVal,    setInputVal]    = useState('')
  const [loading,     setLoading]     = useState(true)
  const [adding,      setAdding]      = useState(false)
  const [error,       setError]       = useState('')
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
      // Mark this keyword as initially scanning; auto-clear after ~60s
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
    if (!confirm('确认删除该监控词及所有预警记录？')) return
    await keywordsApi.remove(id)
    setKeywords(p => p.filter(k => k.id !== id))
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
            disabled={adding}
          />
          <button type="submit" disabled={adding} className="hp-btn flex-shrink-0 gap-1.5 disabled:opacity-60">
            {adding
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> 扫描中...</>
              : <><Plus className="w-4 h-4" /> 添加</>
            }
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
      <div className="text-sm" style={{ color: '#64748B' }}>
        共 <span className="font-semibold text-white">{keywords.length}</span> 个监控词
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
            <KeywordCard key={kw.id} kw={kw} onToggle={handleToggle} onDelete={handleDelete}
              isInitialScanning={scanningIds.has(kw.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
