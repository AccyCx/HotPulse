import axios from 'axios'
import db from '../db/index.js'

function getTwitterKey() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'twitter_api_key'").get()
  return row?.value || ''
}

// twitterapi.io REST API
export async function searchTwitter(query, limit = 20) {
  const apiKey = getTwitterKey()
  if (!apiKey) {
    console.log('[Twitter] API key not configured, skipping')
    return []
  }

  try {
    const res = await axios.get('https://api.twitterapi.io/twitter/tweet/advanced_search', {
      params: {
        query: `${query} -is:retweet lang:zh OR lang:en`,
        queryType: 'Latest',
        count: limit,
      },
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    })

    const tweets = res.data?.tweets || res.data?.data || []
    return tweets.map(tweet => ({
      title: tweet.text?.slice(0, 100) || '',
      summary: tweet.text || '',
      url: tweet.url || `https://x.com/i/web/status/${tweet.id}`,
      source: 'twitter',
      score: (tweet.public_metrics?.like_count || 0) + (tweet.public_metrics?.retweet_count || 0) * 3,
      author: tweet.author?.username || tweet.user?.screen_name || '',
    }))
  } catch (err) {
    console.error('[Twitter] search error:', err.message)
    return []
  }
}

export async function getTwitterTrending(query, limit = 15) {
  const apiKey = getTwitterKey()
  if (!apiKey) return []

  try {
    const res = await axios.get('https://api.twitterapi.io/twitter/tweet/advanced_search', {
      params: {
        query: `${query} min_faves:10 -is:retweet`,
        queryType: 'Top',
        count: limit,
      },
      headers: { 'X-API-Key': apiKey },
      timeout: 15000,
    })

    const tweets = res.data?.tweets || res.data?.data || []
    return tweets.map(tweet => ({
      title: tweet.text?.slice(0, 100) || '',
      summary: tweet.text || '',
      url: tweet.url || `https://x.com/i/web/status/${tweet.id}`,
      source: 'twitter',
      score: (tweet.public_metrics?.like_count || 0) + (tweet.public_metrics?.retweet_count || 0) * 3,
    }))
  } catch (err) {
    console.error('[Twitter] trending error:', err.message)
    return []
  }
}
