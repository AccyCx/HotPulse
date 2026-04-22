import { useState, useEffect } from 'react'
import { Key, Mail, Database, CheckCircle2, XCircle, Loader, Eye, EyeOff, Save, Cpu, Settings as SettingsIcon } from 'lucide-react'
import { settingsApi } from '../lib/api'

function Section({ icon: Icon, title, accent = '#3B82F6', children }) {
  return (
    <div className="hp-card p-5">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#94A3B8' }}>{label}</label>
      {children}
      {hint && <p className="text-xs mt-1.5" style={{ color: '#475569' }}>{hint}</p>}
    </div>
  )
}

function Toggle({ label, settingKey, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0"
      style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <span className="text-sm" style={{ color: '#94A3B8' }}>{label}</span>
      <label className="hp-toggle">
        <input type="checkbox" checked={value === '1'} onChange={() => onChange(settingKey, value === '1' ? '0' : '1')} />
        <div className="hp-toggle-track"><div className="hp-toggle-thumb" /></div>
      </label>
    </div>
  )
}

function TestBtn({ label, onTest, accent = '#3B82F6' }) {
  const [st,  setSt]  = useState(null)
  const [msg, setMsg] = useState('')

  async function run() {
    setSt('loading')
    try { const r = await onTest(); setSt('ok'); setMsg(r?.message || '测试通过') }
    catch (e) { setSt('err'); setMsg(String(e)) }
    setTimeout(() => setSt(null), 4000)
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={run} disabled={st === 'loading'}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
        style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>
        {st === 'loading' && <Loader className="w-3.5 h-3.5 animate-spin" />}
        {label}
      </button>
      {st === 'ok'  && <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#10B981' }}><CheckCircle2 className="w-3.5 h-3.5" />{msg}</span>}
      {st === 'err' && <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#EF4444' }}><XCircle className="w-3.5 h-3.5" />{msg}</span>}
    </div>
  )
}

export default function Settings() {
  const [form,    setForm]    = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [show,    setShow]    = useState({ openrouter: false, twitter: false, smtp: false })

  useEffect(() => {
    settingsApi.get().then(d => { setForm(d); setLoading(false) }).catch(console.error)
  }, [])

  function set(key, value) { setForm(p => ({ ...p, [key]: value })) }
  function toggleShow(k)   { setShow(p => ({ ...p, [k]: !p[k] })) }

  async function handleSave() {
    setSaving(true)
    try { await settingsApi.save(form); setSaved(true); setTimeout(() => setSaved(false), 2500) }
    catch (e) { alert('保存失败: ' + e) }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64"><div className="hp-spinner" /></div>
  )

  const pwInput = (field, showKey, placeholder) => (
    <div className="relative">
      <input type={show[showKey] ? 'text' : 'password'} className="hp-input pr-10"
        placeholder={placeholder} value={form[field] || ''} onChange={e => set(field, e.target.value)} />
      <button onClick={() => toggleShow(showKey)}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transition-colors"
        style={{ color: '#475569' }}>
        {show[showKey] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in pb-8">
      <div className="flex items-center gap-2 mb-2">
        <SettingsIcon className="w-5 h-5" style={{ color: '#94A3B8' }} />
        <h1 className="text-lg font-semibold text-white">系统配置</h1>
      </div>

      {/* AI Config */}
      <Section icon={Cpu} title="AI 配置" accent="#8B5CF6">
        <Field label="OpenRouter API Key" hint="访问 openrouter.ai — 有免费额度">
          {pwInput('openrouter_api_key', 'openrouter', 'sk-or-...')}
        </Field>
        <Field label="模型选择">
          <select className="hp-input" value={form.openrouter_model || 'google/gemini-flash-1.5'} onChange={e => set('openrouter_model', e.target.value)}>
            <option value="google/gemini-flash-1.5">google/gemini-flash-1.5（推荐）</option>
            <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
            <option value="anthropic/claude-3-haiku">anthropic/claude-3-haiku</option>
            <option value="google/gemini-2.0-flash-001">google/gemini-2.0-flash-001</option>
          </select>
        </Field>
        <TestBtn label="测试 AI" onTest={settingsApi.testAI} accent="#A78BFF" />
      </Section>

      {/* Twitter / X */}
      <Section icon={Key} title="Twitter / X API" accent="#06B6D4">
        <Field label="twitterapi.io API Key" hint="访问 twitterapi.io — $0.1 免费额度，无需信用卡">
          {pwInput('twitter_api_key', 'twitter', 'your_api_key_here')}
        </Field>
      </Section>

      {/* Email */}
      <Section icon={Mail} title="邮件通知" accent="#10B981">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="SMTP 服务器" hint="如 smtp.gmail.com">
            <input className="hp-input" placeholder="smtp.gmail.com" value={form.smtp_host || ''} onChange={e => set('smtp_host', e.target.value)} />
          </Field>
          <Field label="端口">
            <input className="hp-input" placeholder="587" type="number" value={form.smtp_port || ''} onChange={e => set('smtp_port', e.target.value)} />
          </Field>
          <Field label="发件人邮箱">
            <input className="hp-input" placeholder="you@gmail.com" type="email" value={form.smtp_user || ''} onChange={e => set('smtp_user', e.target.value)} />
          </Field>
          <Field label="应用密码" hint="Gmail 需使用应用专用密码">
            {pwInput('smtp_pass', 'smtp', '••••••••')}
          </Field>
        </div>
        <Field label="通知接收邮箱">
          <input className="hp-input" placeholder="alerts@example.com" type="email" value={form.notify_email || ''} onChange={e => set('notify_email', e.target.value)} />
        </Field>
        <TestBtn label="测试邮件" onTest={settingsApi.testEmail} accent="#10B981" />
      </Section>

      {/* Data Sources */}
      <Section icon={Database} title="数据来源" accent="#F59E0B">
        <Toggle label="Twitter / X（twitterapi.io）" settingKey="sources_twitter" value={form.sources_twitter} onChange={set} />
        <Toggle label="Google 新闻 RSS"              settingKey="sources_googlenews" value={form.sources_googlenews} onChange={set} />
        <Toggle label="Hacker News"                  settingKey="sources_hackernews" value={form.sources_hackernews} onChange={set} />
        <Toggle label="Reddit"                       settingKey="sources_reddit" value={form.sources_reddit} onChange={set} />
        <Toggle label="GitHub Trending"              settingKey="sources_github" value={form.sources_github} onChange={set} />
        <Toggle label="arXiv 论文"                   settingKey="sources_arxiv" value={form.sources_arxiv} onChange={set} />
      </Section>

      {/* Save */}
      <div className="flex items-center justify-end gap-4">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#10B981' }}>
            <CheckCircle2 className="w-4 h-4" /> 已保存
          </span>
        )}
        <button onClick={handleSave} disabled={saving} className="hp-btn px-6 disabled:opacity-50">
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? '保存中...' : '保存配置'}
        </button>
      </div>
    </div>
  )
}
