import nodemailer from 'nodemailer'
import db from '../db/index.js'

function getEmailSettings() {
  const rows = db.prepare(`
    SELECT key, value FROM settings
    WHERE key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','notify_email')
  `).all()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

function createTransporter(cfg) {
  return nodemailer.createTransport({
    host: cfg.smtp_host || 'smtp.gmail.com',
    port: parseInt(cfg.smtp_port) || 587,
    secure: parseInt(cfg.smtp_port) === 465,
    auth: {
      user: cfg.smtp_user,
      pass: cfg.smtp_pass,
    },
  })
}

export async function sendAlertEmail(alert) {
  const cfg = getEmailSettings()
  if (!cfg.smtp_user || !cfg.notify_email) return

  const transporter = createTransporter(cfg)
  const html = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fffe; padding: 24px; border-radius: 12px;">
      <div style="background: linear-gradient(135deg, #0891B2, #22D3EE); padding: 20px 24px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: white; margin: 0; font-size: 20px;">HotPulse 热点提醒</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">关键词监控触发</p>
      </div>
      <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #A5F3FC;">
        <p style="color: #0E7490; font-size: 12px; font-weight: 600; text-transform: uppercase; margin: 0 0 8px;">监控关键词</p>
        <span style="background: #ECFEFF; color: #0891B2; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">${alert.keyword}</span>
        <h2 style="color: #164E63; margin: 16px 0 8px; font-size: 18px;">${alert.title}</h2>
        <p style="color: #0E7490; margin: 0 0 16px; line-height: 1.6;">${alert.summary || ''}</p>
        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 16px;">
          <span style="background: #F0FDF4; color: #16A34A; padding: 2px 8px; border-radius: 4px; font-size: 12px;">来源: ${alert.source}</span>
          <span style="color: #67E8F9; font-size: 12px;">相关度: ${Math.round((alert.relevance_score || 0) * 100)}%</span>
        </div>
        <a href="${alert.url}" style="display: inline-block; background: #0891B2; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">查看原文</a>
      </div>
      <p style="color: #94A3B8; font-size: 12px; text-align: center; margin-top: 16px;">HotPulse · 热点监控系统</p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `HotPulse <${cfg.smtp_user}>`,
      to: cfg.notify_email,
      subject: `[HotPulse] 关键词"${alert.keyword}"触发 - ${alert.title.slice(0, 40)}`,
      html,
    })
    console.log(`[Email] Alert sent for keyword: ${alert.keyword}`)
  } catch (err) {
    console.error('[Email] Send error:', err.message)
  }
}

export async function sendTopicDigestEmail(domain, topics) {
  const cfg = getEmailSettings()
  if (!cfg.smtp_user || !cfg.notify_email || topics.length === 0) return

  const topicsHtml = topics
    .map(
      t => `
      <div style="border-left: 3px solid #0891B2; padding: 12px 16px; margin: 12px 0; background: white; border-radius: 0 8px 8px 0;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h3 style="margin: 0 0 6px; color: #164E63; font-size: 15px;">${t.title}</h3>
          <span style="background: ${t.heat_score >= 8 ? '#FEF2F2' : '#F0FDF4'}; color: ${t.heat_score >= 8 ? '#DC2626' : '#16A34A'}; padding: 2px 8px; border-radius: 12px; font-size: 11px; white-space: nowrap; margin-left: 8px;">热度 ${t.heat_score}/10</span>
        </div>
        <p style="color: #0E7490; margin: 0 0 8px; font-size: 13px; line-height: 1.5;">${t.summary || ''}</p>
        <a href="${t.url}" style="color: #0891B2; font-size: 12px; text-decoration: none;">查看详情 →</a>
      </div>`
    )
    .join('')

  const html = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fffe; padding: 24px; border-radius: 12px;">
      <div style="background: linear-gradient(135deg, #0891B2, #22D3EE); padding: 20px 24px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: white; margin: 0; font-size: 20px;">HotPulse 热点摘要</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">领域：${domain} · 发现 ${topics.length} 条热点</p>
      </div>
      ${topicsHtml}
      <p style="color: #94A3B8; font-size: 12px; text-align: center; margin-top: 16px;">HotPulse · 热点监控系统</p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `HotPulse <${cfg.smtp_user}>`,
      to: cfg.notify_email,
      subject: `[HotPulse] "${domain}"领域热点摘要 - ${topics.length}条新内容`,
      html,
    })
  } catch (err) {
    console.error('[Email] Digest send error:', err.message)
  }
}

export async function testEmailConfig() {
  const cfg = getEmailSettings()
  if (!cfg.smtp_user) throw new Error('SMTP 未配置')
  const transporter = createTransporter(cfg)
  await transporter.verify()
  return { success: true, message: '邮件配置验证通过' }
}
