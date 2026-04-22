import cron from 'node-cron'
import db from '../db/index.js'

let cleanupTask = null

export function runCleanupNow() {
  const result = db.prepare(`
    DELETE FROM alerts
    WHERE expires_at IS NOT NULL
      AND datetime(expires_at) <= datetime('now')
  `).run()

  if (result.changes > 0) {
    console.log(`[Cleanup] Deleted ${result.changes} expired alerts`)
  }
  return result.changes
}

export function startCleanup() {
  if (cleanupTask) cleanupTask.stop()
  // Daily at 03:10
  cleanupTask = cron.schedule('10 3 * * *', () => {
    try { runCleanupNow() } catch (e) { console.error('[Cleanup] Error:', e.message) }
  }, { runOnInit: false })
  console.log('[Cleanup] Expired alerts cleanup scheduled (daily 03:10)')
}

export function stopCleanup() {
  if (cleanupTask) { cleanupTask.stop(); cleanupTask = null }
}

