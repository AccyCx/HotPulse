import { useState, useEffect } from 'react'
import { TrendingUp, Plus, Trash2, RefreshCw, ExternalLink, Flame, SlidersHorizontal, Radio } from 'lucide-react'
import { domainsApi, topicsApi } from '../lib/api'

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

function getPlatformLabel(source) {
  const s = (source || '').toLowerCase()
  if (s.includes('twitter') || s.includes('x.com')) return 'Twitter'
  if (s.includes('reddit'))   return 'Reddit'
  if (s.includes('github'))   return 'GitHub'
  if (s.includes('hackernews') || s.includes('hn')) return 'HN'
  if (s.includes('arxiv'))    return 'arXiv'
  return source?.slice(0, 8) || 'Web'
}

function HeatBar({ score }) {
  const pct = (score / 10) * 100
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{
          width: `${pct}%`,
          background: score >= 8
            ? 'linear-gradient(90deg,#EF4444,#F97316)'
            : score >= 5
            ? 'linear-gradient(90deg,#F59E0B,#06B6D4)'
            : '#475569',
        }} />
      </div>
      <span className="text-[11px] font-mono font-semibold w-5 text-right"
        style={{ color: score >= 8 ? '#EF4444' : score >= 5 ? '#F59E0B' : '#475569' }}>
        {score}
      </span>
    </div>
  )
}

function TopicCard({ topic }) {
  const score = Math.round(topic.heat_score)
  const isHot = score >= 8
  return (
    <div className="hp-card p-4 flex flex-col gap-3 animate-fade-in"
      style={isHot ? { borderColor: 'rgba(239,68,68,0.2)' } : {}}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="hp-platform">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#94A3B8' }} />
          {getPlatformLabel(topic.source)}
        </span>
        {isHot && (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Flame className="w-3 h-3" /> 爆热
          </span>
        )}
        {topic.url && (
          <a href={topic.url} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-hp-dim hover:text-hp-muted cursor-pointer transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold leading-snug text-white line-clamp-2">{topic.title}</h3>

      {/* Summary */}
      {topic.summary && (
        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#94A3B8' }}>
          <span className="font-medium" style={{ color: '#06B6D4' }}>AI 摘要:</span> {topic.summary}
        </p>
      )}

      {/* Heat + time */}
      <HeatBar score={score} />
      <div className="text-[11px]" style={{ color: '#475569' }}>发现于 {timeAgo(topic.discovered_at)}</div>
    </div>
  )
}

function DomainChip({ domain, active, onClick, onDelete }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border"
      style={active ? {
        background:   'rgba(6,182,212,0.15)',
        borderColor:  'rgba(6,182,212,0.4)',
        color:        '#06B6D4',
      } : {
        background:   'rgba(255,255,255,0.04)',
        borderColor:  'rgba(255,255,255,0.1)',
        color:        '#64748B',
      }}
      onClick={onClick}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#94A3B8' }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#64748B' }}}
    >
      {domain.name}
      <button
        onClick={e => { e.stopPropagation(); onDelete(domain.id) }}
        className="cursor-pointer rounded transition-colors p-0.5 hover:text-red-400 ml-0.5"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

export default function Topics() {
  const [domains,      setDomains]      = useState([])
  const [topics,       setTopics]       = useState([])
  const [activeDomain, setActiveDomain] = useState(null)
  const [nameVal,      setNameVal]      = useState('')
  const [loading,      setLoading]      = useState(false)
  const [refreshing,   setRefreshing]   = useState(false)
  const [sortBy,       setSortBy]       = useState('heat')
  const [showForm,     setShowForm]     = useState(false)

  async function loadDomains() {
    const data = await domainsApi.getAll()
    setDomains(data)
    if (!activeDomain && data.length > 0) setActiveDomain(data[0].id)
  }

  async function loadTopics(domainId) {
    setLoading(true)
    try {
      const data = await topicsApi.getAll(domainId ? { domain_id: domainId, limit: 60 } : { limit: 60 })
      setTopics(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadDomains() }, [])
  useEffect(() => { loadTopics(activeDomain) }, [activeDomain])

  async function handleAdd(e) {
    e.preventDefault()
    if (!nameVal.trim()) return
    try {
      const d = await domainsApi.add(nameVal.trim())
      setDomains(p => [d, ...p])
      setActiveDomain(d.id)
      setNameVal(''); setShowForm(false)
    } catch (err) { alert(String(err)) }
  }

  async function handleDelete(id) {
    if (!confirm('删除该热点域及所有热点数据？')) return
    await domainsApi.remove(id)
    setDomains(p => p.filter(d => d.id !== id))
    if (activeDomain === id) setActiveDomain(domains.find(d => d.id !== id)?.id || null)
  }

  async function handleRefresh() {
    setRefreshing(true)
    try { await domainsApi.refresh() } catch {}
    setTimeout(() => { setRefreshing(false); loadTopics(activeDomain) }, 3000)
  }

  const sorted = [...topics].sort((a, b) =>
    sortBy === 'heat' ? b.heat_score - a.heat_score : new Date(b.discovered_at) - new Date(a.discovered_at)
  )

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* Domain panel */}
      <div className="hp-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Radio className="w-4 h-4" style={{ color: '#06B6D4' }} />
            热点域管理
          </h2>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
            style={{
              background: 'rgba(139,92,246,0.12)',
              color:      '#A78BFF',
              border:     '1px solid rgba(139,92,246,0.25)',
            }}>
            <Plus className="w-3.5 h-3.5" /> 添加域
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="mb-4 flex gap-2 p-3 rounded-lg border animate-fade-in"
            style={{ background: 'rgba(139,92,246,0.04)', borderColor: 'rgba(139,92,246,0.15)' }}>
            <input className="hp-input flex-1"
              placeholder="域名：AI 编程 / 量子计算 / 前端技术..."
              value={nameVal} onChange={e => setNameVal(e.target.value)} />
            <button type="submit" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer flex-shrink-0 transition-colors"
              style={{ background: 'rgba(139,92,246,0.2)', color: '#A78BFF', border: '1px solid rgba(139,92,246,0.3)' }}>
              确认
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          <div
            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border"
            style={activeDomain === null ? {
              background: 'rgba(6,182,212,0.15)', borderColor: 'rgba(6,182,212,0.4)', color: '#06B6D4'
            } : {
              background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#64748B'
            }}
            onClick={() => setActiveDomain(null)}
          >
            全部
          </div>
          {domains.map(d => (
            <DomainChip key={d.id} domain={d} active={activeDomain === d.id}
              onClick={() => setActiveDomain(d.id)} onDelete={handleDelete} />
          ))}
          {domains.length === 0 && (
            <span className="text-xs py-1" style={{ color: '#475569' }}>添加热点域开始监控</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-4 h-4" style={{ color: '#475569' }} />
          {[{ k: 'heat', l: '热度排序' }, { k: 'time', l: '时间排序' }].map(s => (
            <button key={s.k} onClick={() => setSortBy(s.k)}
              className={`hp-tab${sortBy === s.k ? ' hp-tab-active' : ''}`}>
              {s.l}
            </button>
          ))}
        </div>
        <span className="text-xs ml-auto" style={{ color: '#475569' }}>
          {topics.length} 条热点
        </span>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
          style={{
            background: 'rgba(16,185,129,0.12)',
            color:      '#10B981',
            border:     '1px solid rgba(16,185,129,0.25)',
          }}>
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? '抓取中...' : '立即扫描'}
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="hp-spinner" />
          <span className="text-sm" style={{ color: '#475569' }}>正在扫描热点信号...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="hp-card p-16 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <TrendingUp className="w-6 h-6" style={{ color: '#475569' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#64748B' }}>未检测到热点信号</p>
          <p className="text-xs mt-1" style={{ color: '#334155' }}>点击立即扫描或等待下次自动抓取</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sorted.map(t => <TopicCard key={t.id} topic={t} />)}
        </div>
      )}
    </div>
  )
}
