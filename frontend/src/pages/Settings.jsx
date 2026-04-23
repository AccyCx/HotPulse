import { useState, useEffect } from 'react'
import {
  Key, Mail, Database, CheckCircle2, XCircle, Loader,
  Eye, EyeOff, Save, Cpu, Settings as SettingsIcon, Shield,
} from 'lucide-react'
import { settingsApi } from '../lib/api'
import BorderBeam from '../components/aceternity/BorderBeam'

/* ── Section ── */
function Section({ icon: Icon, title, description, accent = '#22d3ee', children }) {
  return (
    <div className="hp-card overflow-hidden">
      {/* Section header */}
      <div
        className="flex items-center gap-3 border-b border-white/[0.07] px-6 py-4"
        style={{ background: `${accent}07` }}
      >
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${accent}15`, border: `1px solid ${accent}28` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
        <div>
          <h3 className="hp-font-display text-sm font-semibold text-white">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-hp-dim">{description}</p>}
        </div>
        {/* Accent top border */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }} />
      </div>
      <div className="space-y-5 p-6">{children}</div>
    </div>
  )
}

/* ── Field ── */
function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-hp-muted">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-hp-dim">{hint}</p>}
    </div>
  )
}

/* ── Source Toggle row ── */
function SourceToggle({ label, settingKey, value, onChange }) {
  const on = value === '1'
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/[0.1]">
      <span className="text-sm text-hp-muted">{label}</span>
      <label className="hp-toggle">
        <input type="checkbox" checked={on} onChange={() => onChange(settingKey, on ? '0' : '1')} />
        <div className="hp-toggle-track"><div className="hp-toggle-thumb" /></div>
      </label>
    </div>
  )
}

/* ── Test Button ── */
function TestBtn({ label, onTest, accent = '#22d3ee' }) {
  const [st, setSt] = useState(null)
  const [msg, setMsg] = useState('')

  async function run() {
    setSt('loading')
    try { const r = await onTest(); setSt('ok'); setMsg(r?.message || '测试通过') }
    catch (e) { setSt('err'); setMsg(String(e)) }
    setTimeout(() => setSt(null), 4000)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={st === 'loading'}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-all disabled:opacity-50"
        style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}28` }}>
        {st === 'loading' && <Loader className="h-3.5 w-3.5" style={{ animation: 'spin 1s linear infinite' }} />}
        {label}
      </button>
      {st === 'ok' && (
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />{msg}
        </span>
      )}
      {st === 'err' && (
        <span className="flex items-center gap-1 text-xs font-medium text-red-400">
          <XCircle className="h-3.5 w-3.5" />{msg}
        </span>
      )}
    </div>
  )
}

/* ── Password Input ── */
function PwInput({ value, placeholder, onChange, showKey, show, onToggleShow }) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className="hp-input pr-10"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-hp-dim transition-colors hover:text-hp-muted"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function Settings() {
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [show, setShow] = useState({ openrouter: false, twitter: false, smtp: false })

  useEffect(() => {
    settingsApi.get().then(d => { setForm(d); setLoading(false) }).catch(console.error)
  }, [])

  const set = (key, value) => setForm(p => ({ ...p, [key]: value }))
  const toggleShow = k => setShow(p => ({ ...p, [k]: !p[k] }))

  async function handleSave() {
    setSaving(true)
    try { await settingsApi.save(form); setSaved(true); setTimeout(() => setSaved(false), 2500) }
    catch (e) { alert('保存失败: ' + e) }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center"><div className="hp-spinner" /></div>
  )

  return (
    <div className="animate-fade-in space-y-6 pb-10">

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400/70">
            <SettingsIcon className="h-3.5 w-3.5" />
            系统配置
          </p>
          <h1 className="hp-font-display text-2xl font-bold text-white">设置</h1>
          <p className="mt-1.5 text-sm text-hp-dim">配置 API 密钥、通知方式和数据来源</p>
        </div>
        {/* Save button top */}
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />已保存
            </span>
          )}
          <button type="button" onClick={handleSave} disabled={saving} className="hp-btn disabled:opacity-50">
            {saving ? <Loader className="h-4 w-4" style={{ animation: 'spin 1s linear infinite' }} /> : <Save className="h-4 w-4" />}
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {/* ── Two-column layout on wide screens ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">

        {/* Left column */}
        <div className="space-y-5">

          {/* AI Config */}
          <div className="relative">
            <Section
              icon={Cpu}
              title="AI 配置"
              description="驱动内容分析与摘要生成"
              accent="#818cf8"
            >
              <Field label="OpenRouter API Key" hint="访问 openrouter.ai 注册，有免费额度">
                <PwInput
                  value={form.openrouter_api_key || ''}
                  placeholder="sk-or-..."
                  onChange={e => set('openrouter_api_key', e.target.value)}
                  show={show.openrouter}
                  onToggleShow={() => toggleShow('openrouter')}
                />
              </Field>
              <Field label="模型选择">
                <select className="hp-input" value={form.openrouter_model || 'google/gemini-flash-1.5'}
                  onChange={e => set('openrouter_model', e.target.value)}>
                  <option value="google/gemini-flash-1.5">google/gemini-flash-1.5（推荐）</option>
                  <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                  <option value="anthropic/claude-3-haiku">anthropic/claude-3-haiku</option>
                  <option value="google/gemini-2.0-flash-001">google/gemini-2.0-flash-001</option>
                </select>
              </Field>
              <TestBtn label="测试 AI 连接" onTest={settingsApi.testAI} accent="#818cf8" />
            </Section>
          </div>

          {/* Email */}
          <Section
            icon={Mail}
            title="邮件通知"
            description="触发热点时发送邮件提醒"
            accent="#34d399"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SMTP 服务器" hint="如 smtp.gmail.com">
                <input className="hp-input" placeholder="smtp.gmail.com"
                  value={form.smtp_host || ''} onChange={e => set('smtp_host', e.target.value)} />
              </Field>
              <Field label="SMTP 端口">
                <input className="hp-input" placeholder="587" type="number"
                  value={form.smtp_port || ''} onChange={e => set('smtp_port', e.target.value)} />
              </Field>
              <Field label="发件人邮箱">
                <input className="hp-input" placeholder="you@gmail.com" type="email"
                  value={form.smtp_user || ''} onChange={e => set('smtp_user', e.target.value)} />
              </Field>
              <Field label="应用密码" hint="Gmail 需使用应用专用密码">
                <PwInput
                  value={form.smtp_pass || ''}
                  placeholder="••••••••"
                  onChange={e => set('smtp_pass', e.target.value)}
                  show={show.smtp}
                  onToggleShow={() => toggleShow('smtp')}
                />
              </Field>
            </div>
            <Field label="通知接收邮箱">
              <input className="hp-input" placeholder="alerts@example.com" type="email"
                value={form.notify_email || ''} onChange={e => set('notify_email', e.target.value)} />
            </Field>
            <TestBtn label="发送测试邮件" onTest={settingsApi.testEmail} accent="#34d399" />
          </Section>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Twitter */}
          <Section
            icon={Key}
            title="Twitter / X API"
            description="抓取 X 平台实时内容"
            accent="#38bdf8"
          >
            <Field label="twitterapi.io API Key" hint="访问 twitterapi.io，$0.1 免费额度，无需信用卡">
              <PwInput
                value={form.twitter_api_key || ''}
                placeholder="your_api_key_here"
                onChange={e => set('twitter_api_key', e.target.value)}
                show={show.twitter}
                onToggleShow={() => toggleShow('twitter')}
              />
            </Field>
          </Section>

          {/* Data Sources */}
          <Section
            icon={Database}
            title="数据来源"
            description="选择启用的信息源"
            accent="#fbbf24"
          >
            <div className="space-y-2">
              <SourceToggle label="Twitter / X（twitterapi.io）" settingKey="sources_twitter"     value={form.sources_twitter}     onChange={set} />
              <SourceToggle label="Google 新闻 RSS"              settingKey="sources_googlenews"  value={form.sources_googlenews}  onChange={set} />
              <SourceToggle label="Hacker News"                  settingKey="sources_hackernews"  value={form.sources_hackernews}  onChange={set} />
              <SourceToggle label="Reddit"                       settingKey="sources_reddit"      value={form.sources_reddit}      onChange={set} />
              <SourceToggle label="GitHub Trending"              settingKey="sources_github"      value={form.sources_github}      onChange={set} />
              <SourceToggle label="arXiv 论文"                   settingKey="sources_arxiv"       value={form.sources_arxiv}       onChange={set} />
            </div>
          </Section>

          {/* Security hint */}
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-hp-surface/50 px-4 py-4 text-xs text-hp-dim">
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400/50" />
            <span>所有 API Key 加密存储于本地 SQLite，不上传任何第三方服务器。</span>
          </div>
        </div>
      </div>

      {/* ── Bottom save ── */}
      <div className="flex items-center justify-end gap-4 border-t border-white/[0.07] pt-5">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />已保存
          </span>
        )}
        <button type="button" onClick={handleSave} disabled={saving} className="hp-btn px-8 disabled:opacity-50">
          {saving ? <Loader className="h-4 w-4" style={{ animation: 'spin 1s linear infinite' }} /> : <Save className="h-4 w-4" />}
          {saving ? '保存中...' : '保存所有配置'}
        </button>
      </div>
    </div>
  )
}
