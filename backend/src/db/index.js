import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../../hotpulse.db')

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    enabled INTEGER DEFAULT 1,
    check_count INTEGER DEFAULT 0,
    last_checked_at TEXT,
    deleted_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword_id INTEGER REFERENCES keywords(id) ON DELETE CASCADE,
    keyword_text TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    url TEXT,
    source TEXT,
    relevance_score REAL DEFAULT 0,
    is_read INTEGER DEFAULT 0,
    expires_at TEXT,
    triggered_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT,
    url TEXT,
    source TEXT,
    heat_score REAL DEFAULT 0,
    discovered_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    ref_id INTEGER,
    channel TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    sent_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`)

// Lightweight "migrations" for existing DBs.
// SQLite doesn't support IF NOT EXISTS for ADD COLUMN reliably across versions,
// so we attempt and ignore "duplicate column" errors.
function tryAddColumn(table, columnDef) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`) } catch {}
}

tryAddColumn('keywords', 'deleted_at TEXT')
tryAddColumn('alerts', 'keyword_text TEXT')
tryAddColumn('alerts', 'expires_at TEXT')

// Helpful indexes (best-effort)
try { db.exec('CREATE INDEX IF NOT EXISTS idx_alerts_keyword_id ON alerts(keyword_id)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_alerts_expires_at ON alerts(expires_at)') } catch {}

// Seed default settings if not present
const defaultSettings = {
  openrouter_api_key: '',
  openrouter_model: 'google/gemini-flash-1.5',
  twitter_api_key: '',
  smtp_host: 'smtp.gmail.com',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  notify_email: '',
  check_interval: '30',
  sources_twitter: '1',
  sources_googlenews: '1',
  sources_hackernews: '1',
  sources_reddit: '1',
  sources_github: '1',
  sources_arxiv: '1',
}

const upsertSetting = db.prepare(
  `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
)
for (const [key, value] of Object.entries(defaultSettings)) {
  upsertSetting.run(key, value)
}

export default db
