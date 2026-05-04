import cron from 'node-cron'
import db from '../db/index.js'

let cleanupTask = null
const DEFAULT_RETENTION_DAYS = 5

function normalizeRetentionDays(value) {
  const days = Number.parseInt(String(value), 10)
  if (Number.isNaN(days)) return DEFAULT_RETENTION_DAYS
  return Math.min(365, Math.max(1, days))
}

export function runCleanupNow({ retentionDays = DEFAULT_RETENTION_DAYS } = {}) {
  const days = normalizeRetentionDays(retentionDays)
  const cutoffModifier = `-${days} days`

  const result = db.prepare(`
    DELETE FROM alerts
    WHERE (expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now'))
      OR datetime(triggered_at) <= datetime('now', ?)
  `).run(cutoffModifier)

  if (result.changes > 0) {
    console.log(`[Cleanup] Deleted ${result.changes} alerts older than ${days} days`)
  }

  const notificationsResult = db.prepare(`
    DELETE FROM notifications
    WHERE type = 'alert'
      AND ref_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM alerts a WHERE a.id = notifications.ref_id
      )
  `).run()

  const logsResult = db.prepare(`
    DELETE FROM source_fetch_logs
    WHERE datetime(started_at) <= datetime('now', '-30 days')
  `).run()

  if (logsResult.changes > 0) {
    console.log(`[Cleanup] Deleted ${logsResult.changes} old source fetch logs`)
  }

  return {
    retention_days: days,
    deleted_alerts: result.changes,
    deleted_notifications: notificationsResult.changes,
    deleted_fetch_logs: logsResult.changes,
  }
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

