// Simple per-domain rate limiter to avoid scraping bans
const lastRequestTime = new Map()

export async function rateLimit(domain, minIntervalMs = 2000) {
  const last = lastRequestTime.get(domain) || 0
  const now = Date.now()
  const elapsed = now - last
  if (elapsed < minIntervalMs) {
    await sleep(minIntervalMs - elapsed + Math.random() * 500)
  }
  lastRequestTime.set(domain, Date.now())
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
