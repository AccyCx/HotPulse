import { useEffect, useMemo, useState } from 'react'
import { Search, Filter, ExternalLink, RefreshCw, Tag, Clock, Flame, SlidersHorizontal } from 'lucide-react'
import { keywordsApi, searchApi } from '../lib/api'
import BorderBeam from '../components/aceternity/BorderBeam'

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

function getPlatformColor(source) {
  const s = (source || '').toLowerCase()
  if (s.includes('twitter') || s.includes('x.com')) return '#38bdf8'
  if (s.includes('reddit')) return '#fb923c'
  if (s.includes('github')) return '#e4e4e7'
  if (s.includes('hackernews') || s.includes('hn')) return '#f97316'
  if (s.includes('arxiv')) return '#f87171'
  if (s.includes('baidu')) return '#60a5fa'
  if (s.includes('zhihu')) return '#38bdf8'
  if (s.includes('weibo')) return '#fb7185'
  if (s.includes('bilibili')) return '#fb7299'
  if (s.includes('sogou_weixin')) return '#22c55e'
  return '#a1a1aa'
}

function getPlatformLabel(source) {
  const s = (source || '').toLowerCase()
  if (s.includes('twitter') || s.includes('x.com')) return 'Twitter'
  if (s.includes('reddit')) return 'Reddit'
  if (s.includes('github')) return 'GitHub'
  if (s.includes('hackernews') || s.includes('hn')) return 'HN'
  if (s.includes('arxiv')) return 'arXiv'
  if (s.includes('baidunews')) return '百度新闻'
  if (s.includes('baidu')) return '百度'
  if (s.includes('zhihu_account')) return '知乎账号'
  if (s.includes('zhihu')) return '知乎'
  if (s.includes('weibo_account')) return '微博账号'
  if (s.includes('weibo')) return '微博'
  if (s.includes('bilibili_account')) return 'B站账号'
  if (s.includes('bilibili')) return 'B站'
  if (s.includes('sogou_weixin_account')) return '公众号'
  if (s.includes('sogou_weixin')) return '微信'
  return source?.slice(0, 12) || 'Web'
}

function AlertCard({ a }) {
  const score = Math.round(((a.relevance_score || 0) * 10) * 10) / 10
  const platColor = getPlatformColor(a.source)
  const needsReview = a.review_status === 'needs_review'
  const pop = a.popularity_score

  return (
    <div className="hp-card animate-fade-in flex flex-col gap-3 p-4 transition-all duration-200">
      {/* Top row */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="hp-platform flex-shrink-0">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: platColor }} />
            {getPlatformLabel(a.source)}
          </span>
          {a.keyword && (
            <span className="hp-keyword max-w-[140px] truncate">{a.keyword}</span>
          )}
          {!a.is_read && (
            <span className="flex-shrink-0 rounded-full border border-cyan-400/22 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
              NEW
            </span>
          )}
          {needsReview && (
            <span className="flex-shrink-0 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              待确认
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {pop !== undefined && pop !== null && (
            <span className="rounded-full border border-white/[0.10] bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-zinc-200">
              热 {Math.round(Number(pop) * 100)}
            </span>
          )}
          {score >= 7 && (
            <span className="flex items-center gap-1 rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-0.5 text-[11px] font-medium text-orange-300">
              <Flame className="h-3 w-3" />
              {score.toFixed(1)}
            </span>
          )}
          {score < 7 && (
            <span className="font-mono text-[11px] font-semibold tabular-nums"
              style={{ color: score >= 5 ? '#fcd34d' : '#52525b' }}>
              {score.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold leading-snug text-white">{a.title}</h3>

      {/* Summary */}
      {a.summary && (
        <p className="line-clamp-2 text-xs leading-relaxed text-hp-muted">
          <span className="font-medium text-cyan-400/75">摘要 </span>{a.summary}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 text-[11px] text-hp-dim">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(a.triggered_at)}
        </span>
        {a.url && (
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-white/[0.06] hover:text-hp-muted"
          >
            查看原文 <ExternalLink className="h-3 w-3" />
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

  const params = useMemo(() => ({
    q: q.trim() || undefined,
    keyword_id: keywordId || undefined,
    source: source.trim() || undefined,
    unread: unread ? 1 : undefined,
    from: from || undefined,
    to: to || undefined,
    limit: 60,
    offset: 0,
  }), [q, keywordId, source, unread, from, to])

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

  useEffect(() => { load() }, [])

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Page Header ── */}
      <div>
        <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400/70">
          <Search className="h-3.5 w-3.5" />
          历史检索
        </p>
        <h1 className="hp-font-display text-2xl font-bold text-white">搜索热点信息</h1>
        <p className="mt-1.5 text-sm text-hp-dim">在所有已抓取的热点数据中全文检索</p>
      </div>

      {/* ── Search Panel ── */}
      <BorderBeam>
        <div className="p-6">
          {/* Main search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-hp-dim" />
            <input
              className="hp-input w-full py-3 pl-10 text-sm"
              placeholder="输入关键词 / 标题 / URL 进行全文搜索..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') load() }}
            />
          </div>

          {/* Filter row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Keyword filter */}
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 flex-shrink-0 text-hp-dim" />
              <select
                className="hp-input w-full"
                value={keywordId}
                onChange={e => setKeywordId(e.target.value)}
              >
                <option value="">全部监控词</option>
                {keywords.map(k => (
                  <option key={k.id} value={k.id}>{k.keyword}</option>
                ))}
              </select>
            </div>

            {/* Source filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 flex-shrink-0 text-hp-dim" />
              <input
                className="hp-input w-full"
                placeholder="来源：reddit / hn / github..."
                value={source}
                onChange={e => setSource(e.target.value)}
              />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <input className="hp-input" type="date" value={from} onChange={e => setFrom(e.target.value)} title="起始日期" />
              <input className="hp-input" type="date" value={to} onChange={e => setTo(e.target.value)} title="结束日期" />
            </div>

            {/* Unread toggle + actions */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="hp-toggle">
                  <input type="checkbox" checked={unread} onChange={() => setUnread(v => !v)} />
                  <div className="hp-toggle-track"><div className="hp-toggle-thumb" /></div>
                </label>
                <span className="text-xs text-hp-dim">只看未读</span>
              </div>
              <button type="button" onClick={load} disabled={loading}
                className="hp-btn-ghost flex-shrink-0 cursor-pointer gap-1.5 text-xs disabled:opacity-50">
                <RefreshCw className="h-3.5 w-3.5" style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                刷新
              </button>
            </div>
          </div>

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

          {/* Footer row */}
          <div className="mt-5 flex items-center justify-between">
            <span className="text-xs text-hp-dim">
              共 <span className="font-semibold text-white">{total}</span> 条结果
            </span>
            <button type="button" onClick={load} className="hp-btn gap-1.5">
              <Search className="h-4 w-4" />
              搜索
            </button>
          </div>
        </div>
      </BorderBeam>

      {/* ── Results ── */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="hp-spinner" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.1] bg-hp-surface/40 p-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04]">
            <Search className="h-7 w-7 text-hp-dim" />
          </div>
          <p className="text-base font-medium text-hp-muted">未找到匹配结果</p>
          <p className="mt-1.5 text-sm text-hp-dim">尝试更换关键词或放宽筛选条件</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-hp-dim">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            找到 <span className="font-semibold text-white">{total}</span> 条，显示前 {items.length} 条
          </div>
          <div className="grid gap-3">
            {items.map(a => <AlertCard key={a.id} a={a} />)}
          </div>
        </>
      )}
    </div>
  )
}
