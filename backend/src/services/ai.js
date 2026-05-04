import db from '../db/index.js'

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    ...settings,
    dashscope_api_key: settings.dashscope_api_key || process.env.DASHSCOPE_API_KEY || process.env.BAILIAN_API_KEY || '',
    dashscope_model: settings.dashscope_model || process.env.DASHSCOPE_MODEL || process.env.BAILIAN_MODEL || DEFAULT_DASHSCOPE_MODEL,
    dashscope_base_url: settings.dashscope_base_url || process.env.DASHSCOPE_BASE_URL || DEFAULT_DASHSCOPE_BASE_URL,
  }
}

const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_DASHSCOPE_MODEL = 'qwen-plus'

async function callDashScope(prompt, settings) {
  const apiKey = settings.dashscope_api_key || settings.bailian_api_key
  const model = settings.dashscope_model || settings.bailian_model || DEFAULT_DASHSCOPE_MODEL
  const baseUrl = (settings.dashscope_base_url || settings.bailian_base_url || DEFAULT_DASHSCOPE_BASE_URL).replace(/\/$/, '')
  if (!apiKey) throw new Error('阿里云百炼 API Key 未配置')

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 30000)
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  }).finally(() => clearTimeout(t))

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`阿里云百炼 HTTP ${res.status}${text ? `: ${text.slice(0, 240)}` : ''}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('阿里云百炼返回内容为空')
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
    throw new Error('AI 返回格式无效')
  }
}

// Validate whether an article is genuinely related to a keyword
export async function validateRelevance(keyword, title, summary = '') {
  const settings = getSettings()
  if (!settings.dashscope_api_key && !settings.bailian_api_key) {
    return { relevant: false, confidence: 0, reason: 'AI未配置', ai_used: false, unavailable: true }
  }

  const prompt = `判断以下内容是否与关键词"${keyword}"真实相关（不是广告或无关内容）。

标题：${title}
摘要：${summary.slice(0, 300)}

请返回 JSON：{"relevant": true或false, "confidence": 0到1之间的数字, "reason": "简短说明"}`

  try {
    const result = await callDashScope(prompt, settings)
    return {
      relevant: result.relevant ?? true,
      confidence: result.confidence ?? 0.5,
      reason: result.reason ?? '',
      ai_used: true,
      unavailable: false,
    }
  } catch (err) {
    console.error('[AI] validateRelevance error:', err.message)
    return { relevant: false, confidence: 0, reason: `AI调用失败: ${err.message}`, ai_used: false, unavailable: true }
  }
}

// Summarize and rank hot topics for a domain
export async function summarizeTopics(domain, rawItems) {
  const settings = getSettings()
  if ((!settings.dashscope_api_key && !settings.bailian_api_key) || rawItems.length === 0) {
    return rawItems.slice(0, 10).map(item => ({
      title: item.title,
      summary: item.summary || item.title,
      url: item.url,
      source: item.source,
      heat_score: 5,
    }))
  }

  const itemsText = rawItems
    .slice(0, 30)
    .map((item, i) => `${i + 1}. 标题：${item.title}\n   来源：${item.source}\n   摘要：${(item.summary || '').slice(0, 150)}`)
    .join('\n\n')

  const prompt = `以下是关于"${domain}"领域的最新内容列表，请：
1. 筛选出最重要的热点（最多8条）
2. 为每条生成简洁的中文摘要（80字以内）
3. 评估热度分（0-10，10最热）
4. 去除重复或相似内容

内容列表：
${itemsText}

返回 JSON 数组（保留原始 url 和 source）：
[{"title":"...","summary":"...","url":"...","source":"...","heat_score":数字}]`

  try {
    const result = await callDashScope(prompt, settings)
    const arr = Array.isArray(result) ? result : result.topics || result.items || []
    return arr.map(item => ({
      title: item.title || '',
      summary: item.summary || '',
      url: item.url || '',
      source: item.source || '',
      heat_score: Number(item.heat_score) || 5,
    }))
  } catch (err) {
    console.error('[AI] summarizeTopics error:', err.message)
    return rawItems.slice(0, 8).map(item => ({
      title: item.title,
      summary: item.summary || item.title,
      url: item.url,
      source: item.source,
      heat_score: 5,
    }))
  }
}

// Batch validate and select top N relevant items from a list of candidates.
// Single AI call replaces the old per-item sequential loop.
// Returns items with `ai_confidence`, `review_status` fields added.
export async function batchValidateAndSelect(keyword, candidates, targetCount = 7) {
  if (candidates.length === 0) return []

  const settings = getSettings()
  const aiAvailable = !!(settings.dashscope_api_key || settings.bailian_api_key)

  if (!aiAvailable) {
    // No AI configured: return top candidates by current order (popularity-sorted) as needs_review
    return candidates.slice(0, targetCount).map(item => ({
      ...item,
      ai_confidence: 0,
      review_status: 'needs_review',
    }))
  }

  const MAX_BATCH = Math.min(candidates.length, 30)
  const batch = candidates.slice(0, MAX_BATCH)
  const actual = Math.min(targetCount, batch.length)

  const itemsText = batch
    .map((item, i) => `[${i + 1}] 来源: ${item.source || 'unknown'}${item.publishedAt ? `\n    发布时间: ${item.publishedAt}` : ''}\n    标题: ${item.title}\n    摘要: ${(item.summary || '').slice(0, 120)}`)
    .join('\n\n')

  const prompt = `你是内容相关性评估专家。从以下${MAX_BATCH}条内容中，筛选出与关键词"${keyword}"最相关的内容（最多${actual}条）。

${itemsText}

筛选标准：
1. 内容确实涉及或讨论"${keyword}"相关话题
2. 优先选择最近 24 小时内的新动态、权威媒体报道、官方公告、头部账号或核心从业者讨论
3. 优先选择有传播量、讨论量或明确新闻价值的内容
4. 排除普通个人吐槽、低互动评论、无名账号帖子、广告、明显无关、过时汇总页或与关键词完全不相关的内容

返回JSON数组（按相关度从高到低排序，最多${actual}条，index为1-based序号）：
[{"index":1,"confidence":0.9,"reason":"直接报道相关最新动态"}]`

  try {
    const result = await callDashScope(prompt, settings)
    const arr = Array.isArray(result) ? result : (result.items || result.results || [])

    const selected = arr
      .filter(r => Number(r.confidence ?? 0) >= 0.4)
      .sort((a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0))
      .slice(0, actual)
      .map(r => {
        const idx = Number(r.index) - 1
        if (idx < 0 || idx >= batch.length) return null
        return {
          ...batch[idx],
          ai_confidence: Number(r.confidence) || 0.5,
          ai_reason: r.reason || '',
          review_status: 'approved',
        }
      })
      .filter(Boolean)

    console.log(`[AI] batchValidateAndSelect: ${selected.length}/${actual} items approved for "${keyword}"`)
    return selected
  } catch (err) {
    console.error('[AI] batchValidateAndSelect error:', err.message)
    // Fallback: return top candidates as needs_review so we always have something
    return candidates.slice(0, targetCount).map(item => ({
      ...item,
      ai_confidence: 0,
      review_status: 'needs_review',
    }))
  }
}

// Test AI connection
export async function testAI() {
  const settings = getSettings()
  const result = await callDashScope(
    '请返回 JSON: {"status": "ok", "message": "AI连接正常"}',
    settings
  )
  return result
}
