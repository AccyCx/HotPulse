import axios from 'axios'
import db from '../db/index.js'

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

async function callOpenRouter(prompt, settings) {
  const { openrouter_api_key, openrouter_model } = settings
  if (!openrouter_api_key) throw new Error('OpenRouter API Key 未配置')

  const res = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: openrouter_model || 'google/gemini-flash-1.5',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${openrouter_api_key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'HotPulse',
      },
      timeout: 30000,
    }
  )

  const content = res.data.choices[0].message.content
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
  if (!settings.openrouter_api_key) {
    return { relevant: true, confidence: 0.8, reason: 'AI未配置，默认通过' }
  }

  const prompt = `判断以下内容是否与关键词"${keyword}"真实相关（不是广告或无关内容）。

标题：${title}
摘要：${summary.slice(0, 300)}

请返回 JSON：{"relevant": true或false, "confidence": 0到1之间的数字, "reason": "简短说明"}`

  try {
    const result = await callOpenRouter(prompt, settings)
    return {
      relevant: result.relevant ?? true,
      confidence: result.confidence ?? 0.5,
      reason: result.reason ?? '',
    }
  } catch (err) {
    console.error('[AI] validateRelevance error:', err.message)
    return { relevant: true, confidence: 0.8, reason: 'AI调用失败，默认通过' }
  }
}

// Summarize and rank hot topics for a domain
export async function summarizeTopics(domain, rawItems) {
  const settings = getSettings()
  if (!settings.openrouter_api_key || rawItems.length === 0) {
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
    const result = await callOpenRouter(prompt, settings)
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

// Test AI connection
export async function testAI() {
  const settings = getSettings()
  const result = await callOpenRouter(
    '请返回 JSON: {"status": "ok", "message": "AI连接正常"}',
    settings
  )
  return result
}
