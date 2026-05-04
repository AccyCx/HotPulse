import axios from 'axios'
import * as cheerio from 'cheerio'
import { rateLimit } from '../utils/rateLimiter.js'
import { randomUA } from '../utils/userAgents.js'

const ACCOUNT_HINT_RE = /(^@|博主|up主|官方|账号|账户|公众号|作者|创作者|主播|频道|channel|account|official|blogger)/i
const warnedSources = new Set()

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function stripHtml(value) {
  return cleanText(String(value || '').replace(/<\/?[^>]+>/g, ''))
}

function stripAccountHints(query) {
  return cleanText(query)
    .replace(/^@+/, '')
    .replace(/(的)?(官方账号|官方帐号|官方|账号|帐号|账户|公众号|博主|up主|作者|创作者|主播|频道)$/i, '')
    .trim()
}

function absoluteUrl(href, base) {
  if (!href) return ''
  try { return new URL(href, base).href } catch { return String(href) }
}

function browserHeaders(referer) {
  return {
    'User-Agent': randomUA(),
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
    Referer: referer || 'https://www.baidu.com/',
  }
}

function bilibiliCookie() {
  const rand = Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32).toUpperCase()
  return `buvid3=${rand}; b_nut=${Math.floor(Date.now() / 1000)}`
}

function bilibiliHeaders(referer = 'https://search.bilibili.com/') {
  return {
    ...browserHeaders(referer),
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://search.bilibili.com',
    Cookie: bilibiliCookie(),
  }
}

function isSinaVisitorPage(data) {
  return typeof data === 'string' && data.includes('Sina Visitor System')
}

function describeHttpError(err) {
  return err.response?.status ? `HTTP ${err.response.status}` : err.message
}

function warnOnce(key, ...args) {
  if (warnedSources.has(key)) return
  warnedSources.add(key)
  console.warn(...args)
}

async function searchBingSiteResults(query, limit, source, options = {}) {
  const { urlIncludes = [], titleSuffix = '', metrics = {} } = options
  await rateLimit(`bing-fallback-${source}`, 5000)
  try {
    const res = await axios.get('https://www.bing.com/search', {
      params: { q: query, count: limit },
      headers: browserHeaders('https://www.bing.com/'),
      timeout: 15000,
    })
    const $ = cheerio.load(res.data)
    const out = []
    $('li.b_algo').each((_, el) => {
      if (out.length >= limit) return false
      const linkEl = $(el).find('h2 a').first()
      const title = cleanText(linkEl.text())
      const url = absoluteUrl(linkEl.attr('href'), 'https://www.bing.com')
      if (!title || !url) return
      if (urlIncludes.length && !urlIncludes.some(part => url.includes(part))) return
      out.push({
        title: titleSuffix ? `${title}${titleSuffix}` : title,
        summary: cleanText($(el).find('.b_caption p').first().text()).slice(0, 260),
        url,
        source,
        metrics: { ...metrics },
      })
    })
    return out
  } catch (err) {
    warnOnce(`${source}:fallback`, `[${source}] fallback search unavailable:`, describeHttpError(err))
    return []
  }
}

export function isLikelyAccountQuery(query) {
  return ACCOUNT_HINT_RE.test(String(query || '').trim())
}

export function getAccountSearchTerm(query) {
  return stripAccountHints(query) || cleanText(query)
}

export async function searchBaidu(query, limit = 10) {
  await rateLimit('baidu-search', 5000)
  try {
    const res = await axios.get('https://www.baidu.com/s', {
      params: { wd: query, rn: limit },
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
      },
      timeout: 15000,
      maxRedirects: 5,
    })

    const $ = cheerio.load(res.data)
    const out = []
    $('.result, .result-op').each((_, el) => {
      if (out.length >= limit) return false
      const titleEl = $(el).find('h3 a, .c-title a').first()
      const title = cleanText(titleEl.text())
      const url = absoluteUrl(titleEl.attr('href'), 'https://www.baidu.com')
      const summary = cleanText($(el).find('.c-abstract, .c-span-last, .content-right_8Zs40').first().text()).slice(0, 260)
      if (!title || !url) return
      out.push({ title, summary, url, source: 'baidu', metrics: {} })
    })
    return out
  } catch (err) {
    console.error('[Baidu] search error:', err.message)
    return []
  }
}

export async function searchBaiduNews(query, limit = 10) {
  await rateLimit('baidu-news', 10000)
  try {
    const res = await axios.get('https://news.baidu.com/ns', {
      params: { word: query, tn: 'news', rn: limit, cl: 2 },
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
      },
      timeout: 15000,
    })

    const $ = cheerio.load(res.data)
    const out = []
    $('.result, .result-op').each((_, el) => {
      if (out.length >= limit) return false
      const titleEl = $(el).find('h3 a, .c-title a').first()
      const title = cleanText(titleEl.text())
      const url = absoluteUrl(titleEl.attr('href'), 'https://news.baidu.com')
      const summary = cleanText($(el).find('.c-summary, .c-abstract').first().text()).slice(0, 260)
      if (!title || !url) return
      out.push({ title, summary, url, source: 'baidunews', metrics: {} })
    })
    return out
  } catch (err) {
    console.error('[BaiduNews] search error:', err.message)
    return []
  }
}

export async function searchZhihu(query, limit = 10) {
  await rateLimit('zhihu-search', 8000)
  try {
    const res = await axios.get('https://www.zhihu.com/api/v4/search_v3', {
      params: {
        q: query,
        t: 'general',
        limit,
        offset: 0,
        lc_idx: 0,
        show_all_topics: 0,
      },
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
        Referer: 'https://www.zhihu.com/search',
      },
      timeout: 15000,
    })

    return (res.data?.data || []).slice(0, limit).map(row => {
      const obj = row.object || row
      const title = stripHtml(obj.title || obj.question?.name || obj.excerpt || '')
      const summary = stripHtml(obj.excerpt || obj.content || obj.answer?.excerpt || obj.description || '').slice(0, 260)
      const url = obj.url || obj.link || obj.question?.url || ''
      const normalizedUrl = url.startsWith('http') ? url : absoluteUrl(url, 'https://www.zhihu.com')
      return {
        title,
        summary,
        url: normalizedUrl,
        source: 'zhihu',
        metrics: {
          voteup_count: Number(obj.voteup_count) || 0,
          comment_count: Number(obj.comment_count) || 0,
        },
      }
    }).filter(item => item.title && item.url)
  } catch (err) {
    warnOnce('zhihu:api', '[Zhihu] API unavailable, using Bing site fallback:', describeHttpError(err))
    return searchBingSiteResults(`site:zhihu.com ${query}`, limit, 'zhihu', {
      urlIncludes: ['zhihu.com'],
    })
  }
}

export async function searchZhihuPeople(query, limit = 8) {
  await rateLimit('zhihu-people-search', 8000)
  const term = getAccountSearchTerm(query)
  try {
    const res = await axios.get('https://www.zhihu.com/api/v4/search_v3', {
      params: {
        q: term,
        t: 'people',
        limit,
        offset: 0,
        lc_idx: 0,
      },
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
        Referer: 'https://www.zhihu.com/search',
      },
      timeout: 15000,
    })

    return (res.data?.data || []).slice(0, limit).map(row => {
      const user = row.object || row
      const name = stripHtml(user.name || user.headline || '')
      const token = user.url_token || user.id || ''
      const url = user.url || (token ? `https://www.zhihu.com/people/${token}` : '')
      return {
        title: name ? `${name}（知乎账号）` : '',
        summary: stripHtml(user.headline || user.description || '').slice(0, 260),
        url: url.startsWith('http') ? url : absoluteUrl(url, 'https://www.zhihu.com'),
        source: 'zhihu_account',
        metrics: {
          follower_count: Number(user.follower_count) || 0,
          answer_count: Number(user.answer_count) || 0,
          account_direct: true,
        },
      }
    }).filter(item => item.title && item.url)
  } catch (err) {
    warnOnce('zhihu_people:api', '[Zhihu] people API unavailable, using Bing site fallback:', describeHttpError(err))
    return searchBingSiteResults(`site:zhihu.com/people ${term}`, limit, 'zhihu_account', {
      urlIncludes: ['zhihu.com/people'],
      titleSuffix: '（知乎账号）',
      metrics: { account_direct: true },
    })
  }
}

function unwrapWeiboCard(card) {
  return card?.mblog || card?.card_group?.find(item => item?.mblog)?.mblog || null
}

export async function searchWeibo(query, limit = 10) {
  await rateLimit('weibo-search', 8000)
  try {
    const containerid = `100103type=1&q=${encodeURIComponent(query)}`
    const res = await axios.get('https://m.weibo.cn/api/container/getIndex', {
      params: { containerid, page_type: 'searchall', page: 1 },
      headers: {
        ...browserHeaders(`https://m.weibo.cn/search?containerid=${encodeURIComponent(containerid)}`),
        Accept: 'application/json, text/plain, */*',
      },
      timeout: 15000,
    })
    if (isSinaVisitorPage(res.data)) {
      throw new Error('Sina visitor verification required')
    }

    return (res.data?.data?.cards || [])
      .map(unwrapWeiboCard)
      .filter(Boolean)
      .slice(0, limit)
      .map(mblog => ({
        title: stripHtml(mblog.text).slice(0, 100),
        summary: stripHtml(mblog.text).slice(0, 260),
        url: mblog.scheme || `https://m.weibo.cn/detail/${mblog.id}`,
        source: 'weibo',
        publishedAt: mblog.created_at || '',
        metrics: {
          reposts: Number(mblog.reposts_count) || 0,
          comments: Number(mblog.comments_count) || 0,
          attitudes: Number(mblog.attitudes_count) || 0,
          author: mblog.user?.screen_name || null,
        },
      }))
      .filter(item => item.title && item.url)
  } catch (err) {
    warnOnce('weibo:api', '[Weibo] search unavailable, using Bing site fallback:', describeHttpError(err))
    return searchBingSiteResults(`site:weibo.com ${query}`, limit, 'weibo', {
      urlIncludes: ['weibo.com'],
    })
  }
}

export async function searchWeiboUsers(query, limit = 8) {
  await rateLimit('weibo-user-search', 8000)
  const term = getAccountSearchTerm(query)
  try {
    const containerid = `100103type=3&q=${encodeURIComponent(term)}`
    const res = await axios.get('https://m.weibo.cn/api/container/getIndex', {
      params: { containerid, page_type: 'searchall', page: 1 },
      headers: {
        ...browserHeaders(`https://m.weibo.cn/search?containerid=${encodeURIComponent(containerid)}`),
        Accept: 'application/json, text/plain, */*',
      },
      timeout: 15000,
    })
    if (isSinaVisitorPage(res.data)) {
      throw new Error('Sina visitor verification required')
    }

    const users = []
    for (const card of res.data?.data?.cards || []) {
      const groups = Array.isArray(card.card_group) ? card.card_group : [card]
      for (const item of groups) {
        const user = item.user || item
        if (!user?.screen_name || users.length >= limit) continue
        users.push({
          title: `${cleanText(user.screen_name)}（微博账号）`,
          summary: cleanText(user.description || user.desc1 || user.desc2 || '').slice(0, 260),
          url: user.profile_url ? absoluteUrl(user.profile_url, 'https://m.weibo.cn') : `https://m.weibo.cn/u/${user.id}`,
          source: 'weibo_account',
          metrics: {
            followers: Number(user.followers_count) || 0,
            statuses: Number(user.statuses_count) || 0,
            verified: Boolean(user.verified),
            account_direct: true,
          },
        })
      }
      if (users.length >= limit) break
    }
    return users
  } catch (err) {
    warnOnce('weibo_user:api', '[Weibo] user search unavailable, using Bing site fallback:', describeHttpError(err))
    return searchBingSiteResults(`site:weibo.com ${term}`, limit, 'weibo_account', {
      urlIncludes: ['weibo.com'],
      titleSuffix: '（微博账号）',
      metrics: { account_direct: true },
    })
  }
}

export async function searchBilibiliVideos(query, limit = 10) {
  await rateLimit('bilibili-search', 5000)
  try {
    const res = await axios.get('https://api.bilibili.com/x/web-interface/search/type', {
      params: { search_type: 'video', keyword: query, page: 1, page_size: limit },
      headers: bilibiliHeaders(`https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`),
      timeout: 15000,
    })
    if (res.data?.code !== 0) throw new Error(res.data?.message || `Bilibili API code ${res.data?.code}`)

    return (res.data?.data?.result || []).slice(0, limit).map(item => ({
      title: cleanText(item.title).replace(/<\/?em[^>]*>/g, ''),
      summary: cleanText(item.description).slice(0, 260),
      url: item.arcurl || `https://www.bilibili.com/video/${item.bvid}`,
      source: 'bilibili',
      publishedAt: item.pubdate ? new Date(item.pubdate * 1000).toISOString() : '',
      metrics: {
        views: Number(item.play) || 0,
        danmaku: Number(item.video_review) || 0,
        author: item.author || null,
      },
    }))
  } catch (err) {
    console.error('[Bilibili] video search error:', err.message)
    return []
  }
}

async function searchBilibiliUsersHtml(query, limit) {
  await rateLimit('bilibili-user-html', 5000)
  try {
    const res = await axios.get('https://search.bilibili.com/upuser', {
      params: { keyword: query },
      headers: browserHeaders('https://search.bilibili.com/'),
      timeout: 15000,
    })
    const $ = cheerio.load(res.data)
    const users = []
    $('.b-user-info-card').each((_, el) => {
      if (users.length >= limit) return false
      const linkEl = $(el).find('h2 a[href*="space.bilibili.com"]').first()
      const name = cleanText(linkEl.attr('title') || linkEl.text())
      const url = absoluteUrl(linkEl.attr('href'), 'https://search.bilibili.com')
      const summary = cleanText($(el).find('p').first().attr('title') || $(el).find('p').first().text()).slice(0, 260)
      if (!name || !url) return
      users.push({
        title: `${name}（B站账号）`,
        summary,
        url,
        source: 'bilibili_account',
        metrics: { account_direct: true },
      })
    })
    return users
  } catch (err) {
    warnOnce('bilibili_user:html', '[Bilibili] user HTML fallback unavailable:', describeHttpError(err))
    return []
  }
}

export async function searchBilibiliUsers(query, limit = 8) {
  await rateLimit('bilibili-user-search', 5000)
  const term = getAccountSearchTerm(query)
  try {
    const res = await axios.get('https://api.bilibili.com/x/web-interface/search/type', {
      params: { search_type: 'bili_user', keyword: term, page: 1, page_size: limit },
      headers: bilibiliHeaders(`https://search.bilibili.com/upuser?keyword=${encodeURIComponent(term)}`),
      timeout: 15000,
    })
    if (res.data?.code !== 0) throw new Error(res.data?.message || `Bilibili API code ${res.data?.code}`)

    return (res.data?.data?.result || []).slice(0, limit).map(user => ({
      title: `${cleanText(user.uname).replace(/<\/?em[^>]*>/g, '')}（B站账号）`,
      summary: cleanText(user.usign || `粉丝 ${user.fans ?? 0}，投稿 ${user.videos ?? 0}`).slice(0, 260),
      url: `https://space.bilibili.com/${user.mid}`,
      source: 'bilibili_account',
      metrics: {
        fans: Number(user.fans) || 0,
        videos: Number(user.videos) || 0,
        level: Number(user.level) || 0,
        account_direct: true,
      },
    }))
  } catch (err) {
    warnOnce('bilibili_user:api', '[Bilibili] user API unavailable, using HTML fallback:', describeHttpError(err))
    return searchBilibiliUsersHtml(term, limit)
  }
}

export async function searchSogouWeixinAccounts(query, limit = 8) {
  await rateLimit('sogou-weixin-account', 10000)
  const term = getAccountSearchTerm(query)
  try {
    const res = await axios.get('https://weixin.sogou.com/weixin', {
      params: { type: 1, query: term, ie: 'utf8', page: 1 },
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
        Referer: 'https://weixin.sogou.com/',
      },
      timeout: 15000,
    })

    const $ = cheerio.load(res.data)
    const out = []
    $('.news-list2 li').each((_, el) => {
      if (out.length >= limit) return false
      const title = cleanText($(el).find('.tit a').text())
      const accountId = cleanText($(el).find('label[name="em_weixinhao"]').text())
      const summary = cleanText($(el).find('.info').text()).slice(0, 260)
      const url = absoluteUrl($(el).find('.tit a').attr('href'), 'https://weixin.sogou.com')
      if (!title) return
      out.push({
        title: `${title}（微信公众号）`,
        summary: accountId ? `微信号：${accountId}${summary ? `。${summary}` : ''}` : summary,
        url,
        source: 'sogou_weixin_account',
        metrics: { account_id: accountId || null, account_direct: true },
      })
    })
    return out
  } catch (err) {
    console.error('[SogouWeixin] account search error:', err.message)
    return []
  }
}

export async function searchSogouWeixinArticles(query, limit = 10) {
  await rateLimit('sogou-weixin-article', 10000)
  try {
    const res = await axios.get('https://weixin.sogou.com/weixin', {
      params: { type: 2, query, ie: 'utf8', page: 1 },
      headers: {
        'User-Agent': randomUA(),
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
        Referer: 'https://weixin.sogou.com/',
      },
      timeout: 15000,
    })

    const $ = cheerio.load(res.data)
    const out = []
    $('.news-list li').each((_, el) => {
      if (out.length >= limit) return false
      const title = cleanText($(el).find('h3 a').text())
      const summary = cleanText($(el).find('.txt-info').text()).slice(0, 260)
      const url = absoluteUrl($(el).find('h3 a').attr('href'), 'https://weixin.sogou.com')
      const account = cleanText($(el).find('.s-p a').text())
      if (!title || !url) return
      out.push({
        title,
        summary: account ? `${summary} 来源：${account}` : summary,
        url,
        source: 'sogou_weixin',
        metrics: { account: account || null },
      })
    })
    return out
  } catch (err) {
    console.error('[SogouWeixin] article search error:', err.message)
    return []
  }
}
