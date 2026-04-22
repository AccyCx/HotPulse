import axios from 'axios'
import * as cheerio from 'cheerio'
import { rateLimit } from '../utils/rateLimiter.js'
import { randomUA } from '../utils/userAgents.js'

// GitHub Trending - scrape the trending page
export async function getGithubTrending(language = '', since = 'daily', limit = 15) {
  await rateLimit('github', 300000) // 5 minutes
  try {
    const url = `https://github.com/trending${language ? `/${language}` : ''}?since=${since}`
    const res = await axios.get(url, {
      headers: { 'User-Agent': randomUA() },
      timeout: 15000,
    })
    const $ = cheerio.load(res.data)
    const repos = []
    $('article.Box-row').each((i, el) => {
      if (i >= limit) return false
      const nameEl = $(el).find('h2 a')
      const descEl = $(el).find('p')
      const starsEl = $(el).find('a[href$="/stargazers"]').first()
      const name = nameEl.text().trim().replace(/\s+/g, '')
      const desc = descEl.text().trim()
      const stars = starsEl.text().trim()
      if (name) {
        repos.push({
          title: name,
          summary: desc || `GitHub 热门项目 · ${stars} stars`,
          url: `https://github.com${nameEl.attr('href')}`,
          source: 'github-trending',
          score: parseInt(stars.replace(/,/g, '')) || 0,
        })
      }
    })
    return repos
  } catch (err) {
    console.error('[GitHub] trending error:', err.message)
    return []
  }
}
