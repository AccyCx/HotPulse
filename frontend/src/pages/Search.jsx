import { useEffect, useMemo, useState } from 'react'
import { Search, Filter, ExternalLink, RefreshCw, Tag } from 'lucide-react'
import { keywordsApi, searchApi } from '../lib/api'

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

function getPlatformLabel(source) {
  const s = (source || '').toLowerCase()
  if (s.includes('twitter') || s.includes('x.com')) return 'Twitter'
  if (s.includes('reddit')) return 'Reddit'
  if (s.includes('github')) return 'GitHub'
  if (s.includes('hackernews') || s.includes('hn')) return 'HN'
  if (s.includes('arxiv')) return 'arXiv'
  return source?.slice(0, 12) || 'Web'
}

function AlertCard({ a }) {
  const score = Math.round(((a.relevance_score || 0) * 10) * 10) / 10
  return (
    <div className="hp-card p-4 flex flex-col gap-2 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="hp-platform">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#94A3B8' }} />
          {getPlatformLabel(a.source)}
        </span>
        {a.keyword && <span className="hp-keyword">{a.keyword}</span>}
        {!a.is_read && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)' }}>
            未读
          </span>
        )}
        <span className="ml-auto text-[11px] font-mono font-semibold"
          style={{ color: score >= 7 ? '#EF4444' : score >= 5 ? '#F59E0B' : '#64748B' }}>
          {score.toFixed(1)}
        </span>
      </div>

      <div className="text-sm font-semibold leading-snug text-white">
        {a.title}
      </div>

      {a.summary && (
        <div className="text-xs leading-relaxed line-clamp-2" style={{ color: '#94A3B8' }}>
          {a.summary}
        </div>
      )}

      <div className="flex items-center gap-3 text-[11px]" style={{ color: '#475569' }}>
        <span>发现于 {timeAgo(a.triggered_at)}</span>
        {a.url && (
          <a href={a.url} target="_blank" rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 hover:text-hp-muted transition-colors"
            style={{ color: '#64748B' }}>
            查看 <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  const [keywords, setKeywords] = useState([])

  const [q, setQ] = useState('')
  const [keywordId, setKeywordId] = useState('')
  const [source, setSource] = useState('')
  const [unread, setUnread] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')

  const params = useMemo(() => {
    const p = {
      q: q.trim() || undefined,
      keyword_id: keywordId || undefined,
      source: source.trim() || undefined,
      unread: unread ? 1 : undefined,
      from: from || undefined,
      to: to || undefined,
      limit: 50,
      offset: 0,
    }
    return p
  }, [q, keywordId, source, unread, from, to])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [kws, result] = await Promise.all([
        keywords.length ? Promise.resolve(keywords) : keywordsApi.getAll(),
        searchApi.searchAlerts(params),
      ])
      if (!keywords.length) setKeywords(kws || [])
      setItems(result.items || [])
      setTotal(result.total || 0)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // initial

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="hp-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4" style={{ color: '#06B6D4' }} />
          <h2 className="text-base font-semibold text-white">搜索热点信息</h2>
          <button onClick={load} disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <input
              className="hp-input w-full"
              placeholder="输入关键词/标题/摘要/URL 进行搜索..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') load() }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4" style={{ color: '#475569' }} />
            <select className="hp-input w-full" value={keywordId} onChange={e => setKeywordId(e.target.value)}>
              <option value="">全部监控词</option>
              {keywords.map(k => (
                <option key={k.id} value={k.id}>{k.keyword}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" style={{ color: '#475569' }} />
            <input
              className="hp-input w-full"
              placeholder="来源筛选：reddit / hn / github..."
              value={source}
              onChange={e => setSource(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="hp-toggle">
              <input type="checkbox" checked={unread} onChange={() => setUnread(v => !v)} />
              <div className="hp-toggle-track"><div className="hp-toggle-thumb" /></div>
            </label>
            <span className="text-xs" style={{ color: '#64748B' }}>只看未读</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input className="hp-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <input className="hp-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        {error && (
          <div className="mt-3 text-xs" style={{ color: '#EF4444' }}>
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs" style={{ color: '#475569' }}>
            共 <span className="font-semibold text-white">{total}</span> 条结果
          </span>
          <button onClick={load}
            className="ml-auto hp-btn gap-1.5">
            <Search className="w-4 h-4" />
            搜索
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="hp-spinner" /></div>
      ) : items.length === 0 ? (
        <div className="hp-card p-14 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <Search className="w-6 h-6" style={{ color: '#475569' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#64748B' }}>未找到匹配结果</p>
          <p className="text-xs mt-1" style={{ color: '#334155' }}>尝试更换关键词或放宽筛选条件</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map(a => <AlertCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}

