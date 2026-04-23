import { useState, useEffect } from 'react'
import {
  TrendingUp, Tag, Bell, RefreshCw, ExternalLink,
  ChevronDown, ChevronUp, Clock, Zap, AlertTriangle,
  SlidersHorizontal, Radio, RotateCcw, Flame, Activity,
} from 'lucide-react'
import { alertsApi, keywordsApi } from '../lib/api'
import AuroraBackground from '../components/aceternity/AuroraBackground'
import Meteors from '../components/aceternity/Meteors'
import Sparkles from '../components/aceternity/Sparkles'
import BorderBeam from '../components/aceternity/BorderBeam'

/* ── helpers ── */
function fmtNum(n) {
  if (n === undefined || n === null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K'
  return String(n)
}
function timeAgo(d) {
  if (!d) return ''
  const m = Math.floor((Date.now() - new Date(d)) / 60_000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}
function getPlatform(source) {
  const s = (source || '').toLowerCase()
  if (s.includes('twitter') || s.includes('x.com')) return { label: 'Twitter', color: '#38bdf8' }
  if (s.includes('reddit')) return { label: 'Reddit', color: '#fb923c' }
  if (s.includes('github')) return { label: 'GitHub', color: '#e4e4e7' }
  if (s.includes('hackernews') || s.includes('hn')) return { label: 'HN', color: '#f97316' }
  if (s.includes('arxiv')) return { label: 'arXiv', color: '#f87171' }
  if (s.includes('weibo')) return { label: '微博', color: '#fb7185' }
  if (s.includes('zhihu')) return { label: '知乎', color: '#38bdf8' }
  return { label: source?.slice(0, 10) || 'Web', color: '#a1a1aa' }
}
function getPriority(score) {
  if (score >= 8) return { label: 'HIGH', color: '#fca5a5', bg: 'rgba(248,113,113,0.1)', dot: '#f87171' }
  if (score >= 5) return { label: 'MED', color: '#fcd34d', bg: 'rgba(251,191,36,0.1)', dot: '#fbbf24' }
  return { label: 'LOW', color: '#71717a', bg: 'rgba(113,113,122,0.1)', dot: '#52525b' }
}

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, sub, accent, alert: isAlert }) {
  return (
    <div className="hp-stat-card" style={isAlert ? { borderColor: 'rgba(248,113,113,0.22)' } : {}}>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${accent}14`, border: `1px solid ${accent}28` }}>
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
        {sub !== undefined && (
          <span className="rounded px-1.5 py-0.5 text-[11px] text-hp-dim" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {sub}
          </span>
        )}
      </div>
      <div className="hp-font-display mb-0.5 text-3xl font-bold tracking-tight" style={{ color: accent }}>
        {fmtNum(value)}
      </div>
      <div className="text-xs text-hp-dim">{label}</div>
    </div>
  )
}

/* ── Hot Card ── */
function HotCard({ item }) {
  const [expanded, setExpanded] = useState(false)
  const score = (item.relevance_score || 0) * 10
  const priority = getPriority(score)
  const { label: platLabel, color: platColor } = getPlatform(item.source)
  const isUnread = !item.is_read

  return (
    <div className="hp-card animate-fade-in p-4 sm:p-5"
      style={isUnread ? {
        borderColor: 'rgba(34,211,238,0.2)',
        boxShadow: '0 0 0 1px rgba(34,211,238,0.07), 0 6px 20px rgba(0,0,0,0.35)',
      } : {}}>
      {/* badges */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="hp-priority"
          style={{ background: priority.bg, color: priority.color, border: `1px solid ${priority.color}25` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: priority.dot }} />
          {priority.label}
        </span>
        <span className="hp-platform">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: platColor }} />
          {platLabel}
        </span>
        {item.keyword && <span className="hp-keyword">{item.keyword}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {(item.relevance_score >= 0.7 || score >= 6) && (
            <span className="hp-badge" style={{ background: 'rgba(52,211,153,0.1)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.18)' }}>可信</span>
          )}
          {score >= 8 && (
            <span className="hp-badge flex items-center gap-1" style={{ background: 'rgba(251,146,60,0.1)', color: '#fdba74', border: '1px solid rgba(251,146,60,0.2)' }}>
              <Flame className="h-3 w-3" />爆 {Math.round(score * 12)}
            </span>
          )}
          {isUnread && (
            <span className="hp-badge" style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.18)' }}>NEW</span>
          )}
        </div>
      </div>

      <h3 className="mb-2 text-sm font-semibold leading-snug text-white sm:text-[15px]">{item.title}</h3>

      {item.summary && (
        <p className="mb-3 text-xs leading-relaxed text-hp-muted sm:text-sm">
          <span className="font-medium text-cyan-400/80">摘要 </span>{item.summary}
        </p>
      )}

      {/* Heat bar */}
      <div className="mb-3 flex items-center gap-2">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${(score / 10) * 100}%`,
              background: score >= 8 ? 'linear-gradient(90deg,#f87171,#fb923c)' : score >= 5 ? 'linear-gradient(90deg,#fbbf24,#22d3ee)' : '#3f3f46',
            }} />
        </div>
        <span className="w-8 text-right font-mono text-[11px] font-semibold tabular-nums"
          style={{ color: score >= 8 ? '#fca5a5' : score >= 5 ? '#fcd34d' : '#52525b' }}>
          {score.toFixed(1)}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-hp-dim">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(item.triggered_at)}</span>
        <div className="ml-auto flex items-center gap-1">
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-white/[0.06] hover:text-hp-muted">
              <ExternalLink className="h-3 w-3" />原文
            </a>
          )}
          <button type="button" onClick={() => setExpanded(v => !v)}
            className="hp-expand-btn cursor-pointer rounded-md px-2 py-1 hover:bg-white/[0.04]">
            AI 理由{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="animate-fade-in mt-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 text-xs leading-relaxed text-hp-muted">
          <div className="mb-1 font-semibold text-cyan-400/80">AI 分析</div>
          {item.summary
            ? `该内容与关键词「${item.keyword || '监控目标'}」高度相关，热度评分 ${score.toFixed(1)}/10。${item.summary}`
            : `内容与监控目标匹配，热度评分 ${score.toFixed(1)}/10，建议关注后续动态。`}
        </div>
      )}
    </div>
  )
}

const SORT_OPTIONS = [
  { key: 'heat', label: '热度优先' },
  { key: 'latest', label: '最新发现' },
  { key: 'relevance', label: '相关性' },
]

/* ── Main ── */
export default function Dashboard() {
  const [feedItems, setFeedItems] = useState([])
  const [kwCount, setKwCount] = useState(0)
  const [alertStats, setAlertStats] = useState({ total: 0, unread: 0, today: 0 })
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('heat')
  const [refreshing, setRefreshing] = useState(false)

  async function load(showSpin = true) {
    if (showSpin) setLoading(true)
    else setRefreshing(true)
    try {
      const [as, alerts, kws] = await Promise.all([
        alertsApi.getStats(),
        alertsApi.getAll({ limit: 60 }),
        keywordsApi.getAll(),
      ])
      setAlertStats(as)
      setKwCount(kws.length)
      setFeedItems((alerts || []).map(a => ({ ...a, _type: 'alert' })))
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  const sorted = [...feedItems].sort((a, b) => {
    if (sortBy === 'latest') return new Date(b.triggered_at) - new Date(a.triggered_at)
    return (b.relevance_score || 0) - (a.relevance_score || 0)
  })

  if (loading) return (
    <div className="flex h-64 flex-col items-center justify-center gap-3">
      <div className="hp-spinner" />
      <span className="text-sm text-hp-dim">正在加载热点数据...</span>
    </div>
  )

  return (
    <div className="animate-fade-in space-y-6">

      {/* ══════════════════════════════════════════
          HERO — Aurora + Meteors + Sparkles
      ══════════════════════════════════════════ */}
      <AuroraBackground
        className="w-full rounded-2xl border border-white/[0.08]"
        showRadialGradient
      >
        {/* Meteors — absolute 在 aurora 内部，随机斜飞 */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
          style={{ zIndex: 2 }}
        >
          <Meteors number={16} />
        </div>

        {/* Sparkles — canvas 粒子层 */}
        <Sparkles
          id="hero-sparkles"
          className="absolute inset-0 rounded-2xl"
          particleColor="#22d3ee"
          particleDensity={60}
          speed={0.7}
          minSize={0.4}
          maxSize={1.5}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col gap-5 px-7 py-9 sm:flex-row sm:items-end sm:justify-between sm:py-11 sm:px-10">
          <div>
            <p className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
              <Activity className="h-3.5 w-3.5" />
              创作者信号台 · AI 实时监控
            </p>
            <h1 className="hp-font-display text-3xl font-bold tracking-tight text-white drop-shadow-lg sm:text-4xl">
              别做第二个<br />转发的人。
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-300/75">
              噪声已过滤，AI 验真完毕——每一条预警，都是值得
              <span className="font-semibold text-cyan-300"> 首发 </span>
              给社区的信号。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
            <span className="rounded-full border border-white/[0.12] bg-white/[0.07] px-3.5 py-1.5 text-[11px] font-medium text-zinc-200 backdrop-blur-sm">
              ⏱ 30 分钟全网扫描
            </span>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3.5 py-1.5 text-[11px] font-medium text-cyan-200 backdrop-blur-sm">
              ⚡ WebSocket 实时推送
            </span>
            <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3.5 py-1.5 text-[11px] font-medium text-indigo-200 backdrop-blur-sm">
              🤖 AI 智能验真
            </span>
          </div>
        </div>
      </AuroraBackground>

      {/* ══════════════════════════════════════════
          STATS — 4 cards full width
      ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="总热点" value={alertStats.total}
          sub={`今日 +${alertStats.today}`} accent="#22d3ee" />
        <StatCard icon={Bell} label="今日新增" value={alertStats.today}
          sub={`共 ${feedItems.length} 条`} accent="#818cf8" />
        <StatCard icon={AlertTriangle} label="紧急热点"
          value={feedItems.filter(i => (i.relevance_score || 0) * 10 >= 8).length}
          accent="#fb923c" alert={alertStats.unread > 0} />
        <StatCard icon={Tag} label="监控词" value={kwCount}
          sub={`未读 ${alertStats.unread}`} accent="#34d399" />
      </div>

      {/* ══════════════════════════════════════════
          HOT FEED — BorderBeam full width
      ══════════════════════════════════════════ */}
      <BorderBeam>
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="hp-font-display flex items-center gap-2 text-lg font-semibold text-white">
                <Flame className="h-5 w-5 text-orange-400" />
                实时热点流
              </h2>
              <p className="mt-0.5 text-xs text-hp-dim">每 30 分钟自动更新 · 按热度锁定最值得首发的内容</p>
            </div>
            <button type="button" onClick={() => load(false)} disabled={refreshing}
              className="hp-btn-ghost cursor-pointer gap-1.5 text-xs disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'motion-safe:animate-spin' : ''}`} />
              刷新
            </button>
          </div>

          {/* Sort tabs */}
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            <SlidersHorizontal className="h-4 w-4 flex-shrink-0 text-hp-dim" />
            {SORT_OPTIONS.map(opt => (
              <button key={opt.key} type="button" onClick={() => setSortBy(opt.key)}
                className={`hp-tab${sortBy === opt.key ? ' hp-tab-active' : ''}`}>
                {opt.label}
              </button>
            ))}
            <button type="button" onClick={() => setSortBy('heat')}
              className="hp-tab ml-auto" title="重置"><RotateCcw className="h-3.5 w-3.5" /></button>
          </div>

          {/* Feed grid — 1 col on mobile, 2 cols on xl+ */}
          {sorted.length === 0 ? (
            <div className="hp-card p-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02]">
                <Radio className="h-6 w-6 text-hp-dim" />
              </div>
              <p className="text-sm font-medium text-hp-muted">暂无热点数据</p>
              <p className="mt-1 text-xs text-hp-dim">前往「监控词」页面添加关键词，开启全网扫描</p>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {sorted.map(item => (
                <HotCard key={`${item._type}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </div>
      </BorderBeam>

      {/* Status bar */}
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-hp-surface/60 px-4 py-3 text-xs text-hp-dim backdrop-blur-sm">
        <Zap className="h-3.5 w-3.5 flex-shrink-0 text-cyan-400/60" />
        <span>下次扫描约 30 分钟后 · {kwCount} 个监控词在线</span>
        <span className="ml-auto font-mono text-[11px] text-hp-dim/60">{sorted.length} 条</span>
      </div>
    </div>
  )
}
