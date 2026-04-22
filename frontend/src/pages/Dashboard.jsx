import { useState, useEffect } from 'react'
import {
  TrendingUp, Tag, Bell, RefreshCw, ExternalLink,
  ChevronDown, ChevronUp, Clock, Zap, AlertTriangle, SlidersHorizontal, Radio,
  RotateCcw, Flame,
} from 'lucide-react'
import { alertsApi, keywordsApi } from '../lib/api'

/* ── helpers ────────────────────────────────────────── */

function fmtNum(n) {
  if (n === undefined || n === null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K'
  return String(n)
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

function getPlatformInfo(source) {
  const s = (source || '').toLowerCase()
  if (s.includes('twitter') || s.includes('x.com')) return { label: 'Twitter', color: '#1DA1F2' }
  if (s.includes('reddit'))   return { label: 'Reddit',      color: '#FF4500' }
  if (s.includes('github'))   return { label: 'GitHub',      color: '#E2E8F0' }
  if (s.includes('hackernews') || s.includes('hn')) return { label: 'HackerNews', color: '#FF6600' }
  if (s.includes('arxiv'))    return { label: 'arXiv',       color: '#B31B1B' }
  if (s.includes('weibo'))    return { label: '微博',         color: '#E6162D' }
  if (s.includes('zhihu'))    return { label: '知乎',         color: '#0084FF' }
  return { label: source || 'Web', color: '#94A3B8' }
}

function getPriority(score) {
  if (score >= 8) return { label: 'HIGH',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   dot: '#EF4444' }
  if (score >= 5) return { label: 'MEDIUM', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  dot: '#F59E0B' }
  return              { label: 'LOW',    color: '#64748B', bg: 'rgba(100,116,139,0.12)', dot: '#64748B' }
}

/* ── Stat Card ──────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, accent, alert: isAlert }) {
  return (
    <div className="hp-stat-card" style={isAlert ? { borderColor: 'rgba(239,68,68,0.2)' } : {}}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
          <Icon className="w-4.5 h-4.5" style={{ color: accent }} />
        </div>
        {sub !== undefined && (
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8' }}>
            {sub}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight mb-0.5" style={{ color: accent }}>{value}</div>
      <div className="text-xs font-medium" style={{ color: '#64748B' }}>{label}</div>
    </div>
  )
}

/* ── Platform icon ──────────────────────────────────── */
function PlatformBadge({ source }) {
  const { label, color } = getPlatformInfo(source)
  return (
    <span className="hp-platform">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  )
}

/* ── Hot Topic Card ─────────────────────────────────── */
function HotCard({ item, type }) {
  const [expanded, setExpanded] = useState(false)

  const score    = (item.relevance_score || 0) * 10
  const priority = getPriority(score)
  const keyword  = item.keyword
  const time     = item.triggered_at
  const isUnread = !item.is_read

  return (
    <div className="hp-card p-5 animate-fade-in" style={isUnread ? { borderColor: 'rgba(59,130,246,0.25)' } : {}}>
      {/* ── Header badges row ── */}
      <div className="flex items-center flex-wrap gap-2 mb-3">
        {/* Priority badge */}
        <span className="hp-priority"
          style={{ background: priority.bg, color: priority.color, border: `1px solid ${priority.color}30` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: priority.dot }} />
          {priority.label}
        </span>

        {/* Platform */}
        <PlatformBadge source={item.source} />

        {/* Keyword/domain tag */}
        {keyword && <span className="hp-keyword">{keyword}</span>}

        {/* Status badges (right side) */}
        <div className="ml-auto flex items-center gap-1.5">
          {(item.relevance_score >= 0.7 || score >= 6) && (
            <span className="hp-badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
              可信
            </span>
          )}
          {type === 'alert' && (
            <span className="hp-badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFF', border: '1px solid rgba(139,92,246,0.2)' }}>
              直接提及
            </span>
          )}
          {score >= 8 && (
            <span className="hp-badge flex items-center gap-1" style={{ background: 'rgba(249,115,22,0.12)', color: '#FB923C', border: '1px solid rgba(249,115,22,0.2)' }}>
              <Flame className="w-3 h-3" />
              爆 {Math.round(score * 12)}
            </span>
          )}
        </div>
      </div>

      {/* ── Title ── */}
      <h3 className="text-base font-semibold leading-snug mb-2" style={{ color: '#E2E8F0' }}>
        {item.title}
      </h3>

      {/* ── AI summary ── */}
      {item.summary && (
        <p className="text-sm leading-relaxed mb-3" style={{ color: '#94A3B8' }}>
          <span className="font-medium" style={{ color: '#06B6D4' }}>AI 摘要:</span>{' '}
          {item.summary}
        </p>
      )}

      {/* ── Heat score bar ── */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(score / 10) * 100}%`,
              background: score >= 8
                ? 'linear-gradient(90deg,#EF4444,#F97316)'
                : score >= 5
                ? 'linear-gradient(90deg,#F59E0B,#06B6D4)'
                : '#475569',
            }} />
        </div>
        <span className="text-[11px] font-mono font-semibold w-6 text-right"
          style={{ color: score >= 8 ? '#EF4444' : score >= 5 ? '#F59E0B' : '#475569' }}>
          {score.toFixed(1)}
        </span>
      </div>

      {/* ── Footer: time + actions ── */}
      <div className="flex items-center gap-3 text-xs" style={{ color: '#475569' }}>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(time)}
        </span>
        {isUnread && (
          <span className="flex items-center gap-1 font-medium" style={{ color: '#3B82F6' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            未读
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors hover:text-white"
              style={{ color: '#64748B' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ExternalLink className="w-3.5 h-3.5" />
              查看原文
            </a>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="hp-expand-btn px-2 py-1 rounded-md"
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            AI 分析理由
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Expandable AI reason ── */}
      {expanded && (
        <div className="mt-3 p-3 rounded-lg text-sm leading-relaxed animate-fade-in"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#94A3B8' }}>
          <div className="text-xs font-semibold mb-1.5" style={{ color: '#06B6D4' }}>AI 分析理由</div>
          {item.summary
            ? `该内容与关键词「${keyword || '监控目标'}」高度相关，热度评分 ${score.toFixed(1)}/10。${item.summary}`
            : `内容与监控目标匹配，热度评分 ${score.toFixed(1)}/10，建议关注后续动态。`
          }
        </div>
      )}
    </div>
  )
}

/* ── Sort tabs ──────────────────────────────────────── */
const SORT_OPTIONS = [
  { key: 'latest',    label: '最新发现'  },
  { key: 'heat',      label: '热度综合'  },
  { key: 'relevance', label: '相关性'    },
]

/* ── Main Dashboard ─────────────────────────────────── */
export default function Dashboard() {
  const [feedItems,    setFeedItems]    = useState([])
  const [kwCount,      setKwCount]      = useState(0)
  const [alertStats,   setAlertStats]   = useState({ total: 0, unread: 0, today: 0 })
  const [loading,      setLoading]      = useState(true)
  const [sortBy,       setSortBy]       = useState('heat')
  const [refreshing,   setRefreshing]   = useState(false)

  async function load(showSpin = true) {
    if (showSpin) setLoading(true)
    else setRefreshing(true)
    try {
      const [as, alerts, kws] = await Promise.all([
        alertsApi.getStats(),
        alertsApi.getAll({ limit: 40 }),
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
    if (sortBy === 'latest') {
      const at = a.triggered_at
      const bt = b.triggered_at
      return new Date(bt) - new Date(at)
    }
    if (sortBy === 'heat') {
      const as = (a.relevance_score || 0) * 10
      const bs = (b.relevance_score || 0) * 10
      return bs - as
    }
    if (sortBy === 'relevance') {
      const ar = (a.relevance_score || 0)
      const br = (b.relevance_score || 0)
      return br - ar
    }
    return 0
  })

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="hp-spinner" />
      <span className="text-sm font-medium" style={{ color: '#475569' }}>正在加载热点数据...</span>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={TrendingUp}
          label="总热点"
          value={alertStats.total}
          sub={`+${alertStats.today} 今日`}
          accent="#06B6D4"
        />
        <StatCard
          icon={Bell}
          label="今日新增"
          value={alertStats.today}
          sub={`共 ${feedItems.length} 条`}
          accent="#3B82F6"
        />
        <StatCard
          icon={AlertTriangle}
          label="紧急热点"
          value={feedItems.filter(i => {
            const s = i._type === 'topic' ? i.heat_score : (i.relevance_score || 0) * 10
            return s >= 8
          }).length}
          accent="#EF4444"
          alert={alertStats.unread > 0}
        />
        <StatCard
          icon={Tag}
          label="监控词"
          value={kwCount}
          sub={`未读 ${alertStats.unread}`}
          accent="#10B981"
        />
      </div>

      {/* ── Hot feed section ── */}
      <div>
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Flame className="w-5 h-5" style={{ color: '#F97316' }} />
              实时热点流
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>每 30 分钟自动更新</p>
          </div>
          <button
            onClick={() => load(false)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color:      '#94A3B8',
              border:     '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* Sort + filter tabs */}
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <SlidersHorizontal className="w-4 h-4 flex-shrink-0" style={{ color: '#475569' }} />
          {SORT_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => setSortBy(opt.key)}
              className={`hp-tab${sortBy === opt.key ? ' hp-tab-active' : ''}`}>
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => { setSortBy('heat') }}
            className="hp-tab ml-auto"
            title="重置筛选">
            <RotateCcw className="w-3.5 h-3.5" />
            重置
          </button>
        </div>

        {/* Feed list */}
        {sorted.length === 0 ? (
          <div className="hp-card p-16 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <Radio className="w-6 h-6" style={{ color: '#475569' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: '#64748B' }}>暂无热点数据</p>
            <p className="text-xs mt-1" style={{ color: '#334155' }}>
              添加监控词开始收集内容
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(item => (
              <HotCard
                key={`${item._type}-${item.id}`}
                item={item}
                type={item._type}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom status bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs" style={{ background: '#0D1221', border: '1px solid rgba(255,255,255,0.06)', color: '#475569' }}>
        <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#3B82F6' }} />
        <span>
          下次扫描约 30 分钟后 &nbsp;·&nbsp; {kwCount} 监控词
        </span>
        <span className="ml-auto font-medium" style={{ color: '#334155' }}>
          共 {sorted.length} 条
        </span>
      </div>
    </div>
  )
}
