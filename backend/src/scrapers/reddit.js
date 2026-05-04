import axios from 'axios'
import { rateLimit } from '../utils/rateLimiter.js'
import { randomUA } from '../utils/userAgents.js'

// Reddit JSON API - no key required for public read
export async function searchReddit(query, limit = 10) {
  await rateLimit('reddit', 2000)
  try {
    const res = await axios.get('https://www.reddit.com/search.json', {
      params: { q: query, sort: 'new', limit, t: 'day' },
      headers: { 'User-Agent': randomUA() },
      timeout: 12000,
    })
    return (res.data?.data?.children || []).map(child => {
      const p = child.data
      return {
        title: p.title,
        summary: p.selftext ? p.selftext.slice(0, 200) : '',
        url: p.url || `https://reddit.com${p.permalink}`,
        source: 'reddit',
        publishedAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : '',
        score: p.score || 0,
        metrics: {
          score: p.score || 0,
          comments: p.num_comments || 0,
          upvote_ratio: p.upvote_ratio ?? null,
          subreddit: p.subreddit || null,
        },
      }
    })
  } catch (err) {
    console.error('[Reddit] search error:', err.message)
    return []
  }
}

export async function getSubredditHot(subreddit, limit = 15) {
  await rateLimit('reddit', 2000)
  try {
    const res = await axios.get(`https://www.reddit.com/r/${subreddit}/hot.json`, {
      params: { limit },
      headers: { 'User-Agent': randomUA() },
      timeout: 12000,
    })
    return (res.data?.data?.children || []).map(child => {
      const p = child.data
      return {
        title: p.title,
        summary: p.selftext ? p.selftext.slice(0, 200) : '',
        url: p.url || `https://reddit.com${p.permalink}`,
        source: `reddit/hot/r/${subreddit}`,
        publishedAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : '',
        score: p.score || 0,
        metrics: {
          score: p.score || 0,
          comments: p.num_comments || 0,
          upvote_ratio: p.upvote_ratio ?? null,
          subreddit,
        },
      }
    })
  } catch (err) {
    console.error(`[Reddit] r/${subreddit} error:`, err.message)
    return []
  }
}
