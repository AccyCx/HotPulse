import Parser from 'rss-parser'

const parser = new Parser({ timeout: 15000 })

const CATEGORY_MAP = {
  ai: 'cs.AI',
  ml: 'cs.LG',
  cv: 'cs.CV',
  nlp: 'cs.CL',
  robotics: 'cs.RO',
  crypto: 'cs.CR',
  quantum: 'quant-ph',
}

export async function getArxivPapers(query, limit = 10) {
  try {
    const encodedQuery = encodeURIComponent(query)
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`
    const feed = await parser.parseURL(url)
    return (feed.items || []).slice(0, limit).map(item => ({
      title: item.title?.trim() || '',
      summary: item.contentSnippet?.slice(0, 300) || item.summary?.slice(0, 300) || '',
      url: item.link || '',
      source: 'arxiv',
      publishedAt: item.pubDate || '',
    }))
  } catch (err) {
    console.error('[arXiv] query error:', err.message)
    return []
  }
}

export async function getArxivCategory(category = 'cs.AI', limit = 10) {
  try {
    const cat = CATEGORY_MAP[category.toLowerCase()] || category
    const url = `https://export.arxiv.org/rss/${cat}`
    const feed = await parser.parseURL(url)
    return (feed.items || []).slice(0, limit).map(item => ({
      title: item.title?.replace(/\s*\(arXiv.*?\)/, '').trim() || '',
      summary: item.contentSnippet?.slice(0, 300) || '',
      url: item.link || '',
      source: 'arxiv',
    }))
  } catch (err) {
    console.error('[arXiv] category error:', err.message)
    return []
  }
}
