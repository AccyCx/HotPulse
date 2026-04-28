import axios from 'axios'

// Hacker News via Algolia API - completely free, no rate limits
export async function searchHackerNews(query, limit = 10) {
  try {
    const res = await axios.get('https://hn.algolia.com/api/v1/search', {
      params: {
        query,
        tags: 'story',
        hitsPerPage: limit,
        numericFilters: `created_at_i>${Math.floor(Date.now() / 1000) - 86400 * 7}`,
      },
      timeout: 10000,
    })
    return res.data.hits.map(hit => ({
      title: hit.title,
      summary: hit.story_text ? hit.story_text.replace(/<[^>]+>/g, '').slice(0, 200) : '',
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      source: 'hackernews',
      score: hit.points || 0,
      metrics: {
        points: hit.points || 0,
        comments: hit.num_comments || 0,
        author: hit.author || null,
      },
    }))
  } catch (err) {
    console.error('[HN] search error:', err.message)
    return []
  }
}

export async function getHNTopStories(limit = 20) {
  try {
    const res = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json', {
      timeout: 10000,
    })
    const ids = res.data.slice(0, limit)
    const stories = await Promise.all(
      ids.map(id =>
        axios
          .get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 8000 })
          .then(r => r.data)
          .catch(() => null)
      )
    )
    return stories
      .filter(s => s && s.type === 'story' && s.url)
      .map(s => ({
        title: s.title,
        summary: '',
        url: s.url,
        source: 'hackernews/top',
        score: s.score || 0,
        metrics: {
          points: s.score || 0,
          comments: s.descendants || 0,
          author: s.by || null,
        },
      }))
  } catch (err) {
    console.error('[HN] top stories error:', err.message)
    return []
  }
}
