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
    popularity_score REAL DEFAULT 0,
    review_status TEXT DEFAULT 'approved',
    raw_metrics TEXT,
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

  CREATE TABLE IF NOT EXISTS source_fetch_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword_id INTEGER REFERENCES keywords(id) ON DELETE SET NULL,
    keyword_text TEXT,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    item_count INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    error TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT DEFAULT (datetime('now'))
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
tryAddColumn('alerts', 'popularity_score REAL DEFAULT 0')
tryAddColumn('alerts', "review_status TEXT DEFAULT 'approved'")
tryAddColumn('alerts', 'raw_metrics TEXT')

// Helpful indexes (best-effort)
try { db.exec('CREATE INDEX IF NOT EXISTS idx_alerts_keyword_id ON alerts(keyword_id)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_alerts_expires_at ON alerts(expires_at)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_alerts_review_status ON alerts(review_status)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_source_fetch_logs_keyword_id ON source_fetch_logs(keyword_id)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_source_fetch_logs_started_at ON source_fetch_logs(started_at)') } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_source_fetch_logs_source ON source_fetch_logs(source)') } catch {}

const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_DASHSCOPE_MODEL = 'qwen-plus'

// Seed default settings if not present
const defaultSettings = {
  // Prefer `.env` (backend/.env) values on first boot (or when DB missing the key).
  // The primary configuration path is still the Settings UI (stored in SQLite).
  dashscope_api_key: process.env.DASHSCOPE_API_KEY || process.env.BAILIAN_API_KEY || '',
  dashscope_model: process.env.DASHSCOPE_MODEL || process.env.BAILIAN_MODEL || DEFAULT_DASHSCOPE_MODEL,
  dashscope_base_url: process.env.DASHSCOPE_BASE_URL || DEFAULT_DASHSCOPE_BASE_URL,
  twitter_api_key: process.env.TWITTER_API_KEY || '',
  smtp_host: process.env.SMTP_HOST || 'smtp.qq.com',
  smtp_port: process.env.SMTP_PORT || '465',
  smtp_user: process.env.SMTP_USER || '',
  smtp_pass: process.env.SMTP_PASS || '',
  notify_email: process.env.NOTIFY_EMAIL || '',
  check_interval: '30',
  sources_twitter: '1',
  sources_googlenews: '1',
  sources_bingnews: '1',
  sources_hackernews: '1',
  sources_reddit: '1',
  sources_github: '1',
  sources_arxiv: '1',
  sources_rss: '1',
  sources_duckduckgo: '0',
  sources_baidu: '1',
  sources_baidunews: '1',
  sources_zhihu: '1',
  sources_zhihu_accounts: '1',
  sources_weibo: '1',
  sources_weibo_accounts: '1',
  sources_bilibili: '1',
  sources_bilibili_accounts: '1',
  sources_sogou_weixin: '1',
  sources_sogou_weixin_accounts: '1',
  min_ai_confidence: '0.6',
  min_popularity: '0.15',
}

const upsertSetting = db.prepare(
  `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
)
for (const [key, value] of Object.entries(defaultSettings)) {
  upsertSetting.run(key, value)
}

// Keep legacy OpenRouter config around for compatibility, but migrate common model defaults to DashScope.
try {
  db.prepare(`
    INSERT OR IGNORE INTO settings (key, value)
    SELECT 'dashscope_api_key', value
    FROM settings
    WHERE key = 'bailian_api_key' AND value != ''
  `).run()
  db.prepare(`
    UPDATE settings
    SET value = ?
    WHERE key = 'dashscope_model'
      AND value IN ('', 'google/gemini-flash-1.5', 'google/gemini-2.0-flash-001', 'openai/gpt-4o-mini', 'anthropic/claude-3-haiku', 'qwen/qwen3-32b:free', 'qwen/qwen3-next-80b-a3b-instruct:free', 'z-ai/glm-4.5-air:free', 'qwen/qwen3-coder:free')
  `).run(DEFAULT_DASHSCOPE_MODEL)
} catch {}

export default db
