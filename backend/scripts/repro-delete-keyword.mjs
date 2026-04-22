import db from '../src/db/index.js'

function one(sql, ...params) {
  return db.prepare(sql).get(...params)
}
function all(sql, ...params) {
  return db.prepare(sql).all(...params)
}

// Create a unique keyword
const kwText = `repro-${Date.now()}`
const kwId = db.prepare('INSERT INTO keywords (keyword) VALUES (?)').run(kwText).lastInsertRowid
console.log('keyword_id', kwId, kwText)

// Insert a fake alert
db.prepare(`
  INSERT INTO alerts (keyword_id, keyword_text, title, summary, url, source, relevance_score)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(kwId, kwText, 'Repro alert title', 'Repro summary', 'https://example.com/repro', 'repro', 0.9)

console.log('alerts_before', one('SELECT COUNT(*) as c FROM alerts WHERE keyword_id = ?', kwId).c)

// Soft delete keyword (what API should do)
db.prepare(`UPDATE keywords SET enabled = 0, deleted_at = datetime('now') WHERE id = ?`).run(kwId)
db.prepare(`
  UPDATE alerts
  SET expires_at = COALESCE(expires_at, datetime('now', '+5 days'))
  WHERE keyword_id = ?
`).run(kwId)

console.log('keyword_row', one('SELECT id, keyword, enabled, deleted_at FROM keywords WHERE id = ?', kwId))
console.log('alerts_after', one('SELECT COUNT(*) as c FROM alerts WHERE keyword_id = ?', kwId).c)
console.log('sample_alert', one('SELECT id, keyword_id, keyword_text, expires_at FROM alerts WHERE keyword_id = ? ORDER BY id DESC LIMIT 1', kwId))

console.log('fk_alerts', all(`PRAGMA foreign_key_list(alerts)`))

