# HotPulse - 技术架构文档

> 版本：v1.0 | 日期：2026-04-22 | 基于 MCP Context7 最新文档

---

## 一、技术选型

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 前端框架 | React | v19 | 最新稳定版 |
| 前端构建 | Vite | latest | 快速开发服务器 |
| CSS 框架 | Tailwind CSS | v3 | 工具类优先 |
| 路由 | React Router | v7 | 从 `react-router` 导入（非 dom） |
| 图标 | Lucide React | latest | SVG 图标库 |
| 后端框架 | Express | v5.1.0 | 最新版本 |
| 数据库 | better-sqlite3 | v12.6.2 | WAL 模式，同步 API |
| WebSocket | ws | v8.x | 含心跳检测 |
| 定时任务 | node-cron | latest | Cron 语法调度 |
| 邮件发送 | Nodemailer | latest | SMTP 支持 |
| HTTP 客户端 | axios | latest | 数据采集请求 |
| HTML 解析 | cheerio | latest | 爬虫解析 |
| RSS 解析 | rss-parser | latest | RSS/Atom 订阅 |
| AI 服务 | OpenRouter API | - | 模型：google/gemini-flash-1.5 |

---

## 二、系统架构图

```
┌───────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                     │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │Dashboard │ │Keywords  │ │  Topics  │ │  Settings    │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │
│                                                               │
│  useWebSocket hook → 实时通知  |  axios → REST API            │
└──────────────────┬────────────────────────────────────────────┘
                   │ HTTP :3001 / WS :3001/ws
┌──────────────────▼────────────────────────────────────────────┐
│                    Backend (Express v5)                        │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    REST API Routes                       │  │
│  │  GET/POST /api/keywords   GET/POST /api/domains          │  │
│  │  GET /api/topics          GET /api/notifications         │  │
│  │  GET /api/alerts          POST /api/settings             │  │
│  └──────────────────────────────┬──────────────────────────┘  │
│                                 │                              │
│  ┌──────────────┐  ┌────────────▼────────────┐               │
│  │  WebSocket   │  │     Service Layer        │               │
│  │  Server (ws) │  │                          │               │
│  │  Heartbeat   │  │  MonitorService (cron)   │               │
│  │  Broadcast   │  │  DiscoveryService (cron) │               │
│  └──────┬───────┘  │  NotificationService     │               │
│         │          │  EmailService (nodemailer)│               │
│         │          │  AIService (OpenRouter)   │               │
│         │          └────────────┬─────────────┘               │
│         │                       │                              │
│         │          ┌────────────▼─────────────┐               │
│         │          │    Scrapers Layer          │               │
│         │          │  TwitterScraper           │               │
│         │          │  GoogleNewsScraper        │               │
│         │          │  HackerNewsScraper        │               │
│         │          │  RedditScraper            │               │
│         │          │  GitHubTrendingScraper    │               │
│         │          │  ArxivScraper             │               │
│         │          │  RssScraper               │               │
│         │          └────────────┬─────────────┘               │
│         │                       │                              │
│  ┌──────▼───────────────────────▼─────────────┐               │
│  │            SQLite (better-sqlite3)           │               │
│  │            WAL mode · 同步 API              │               │
│  └─────────────────────────────────────────────┘               │
└───────────────────────────────────────────────────────────────┘
         │ HTTP
┌────────▼──────────────────────────────────────────────────────┐
│              External Services                                 │
│  OpenRouter API  |  twitterapi.io  |  SMTP Server             │
└───────────────────────────────────────────────────────────────┘
```

---

## 三、目录结构

```
d:\Desktop\AIProject\
├── docs/                          # 项目文档
│   ├── requirements.md
│   ├── architecture.md
│   └── design-system.md
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js               # 服务入口
│       ├── db/
│       │   ├── index.js           # DB 连接 + WAL 模式
│       │   └── schema.js          # 建表 SQL
│       ├── routes/
│       │   ├── keywords.js        # 关键词 CRUD
│       │   ├── domains.js         # 监控领域 CRUD
│       │   ├── topics.js          # 热点查询
│       │   ├── alerts.js          # 告警历史
│       │   ├── notifications.js   # 通知记录
│       │   └── settings.js        # 配置读写
│       ├── services/
│       │   ├── ai.js              # OpenRouter 调用
│       │   ├── monitor.js         # 关键词监控定时任务
│       │   ├── discovery.js       # 热点发现定时任务
│       │   ├── notification.js    # 通知调度
│       │   ├── email.js           # Nodemailer 封装
│       │   └── websocket.js       # ws 服务端 + 心跳
│       ├── scrapers/
│       │   ├── twitter.js         # twitterapi.io REST
│       │   ├── googleNews.js      # Google News RSS
│       │   ├── hackerNews.js      # HN Algolia API
│       │   ├── reddit.js          # Reddit JSON API
│       │   ├── github.js          # GitHub Trending 爬取
│       │   ├── arxiv.js           # arXiv RSS
│       │   └── rss.js             # 通用 RSS 解析
│       └── utils/
│           ├── rateLimiter.js     # 请求频率控制
│           └── userAgents.js      # UA 轮换池
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx      # 仪表盘
│       │   ├── Keywords.jsx       # 关键词管理
│       │   ├── Topics.jsx         # 热点 Feed
│       │   └── Settings.jsx       # 设置
│       ├── components/
│       │   ├── Layout.jsx         # 整体布局 + 侧边栏
│       │   ├── NotificationPanel.jsx
│       │   ├── AlertCard.jsx
│       │   ├── TopicCard.jsx
│       │   └── KeywordBadge.jsx
│       ├── hooks/
│       │   ├── useWebSocket.js    # WebSocket 连接管理
│       │   └── useNotification.js # 浏览器通知权限
│       └── lib/
│           ├── api.js             # axios 封装
│           └── utils.js
└── README.md
```

---

## 四、数据库 Schema

```sql
-- 用户配置的监控关键词
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL UNIQUE,
  enabled INTEGER DEFAULT 1,
  check_count INTEGER DEFAULT 0,
  last_checked_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 关键词触发告警记录
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER REFERENCES keywords(id),
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  source TEXT,
  relevance_score REAL,
  is_read INTEGER DEFAULT 0,
  triggered_at TEXT DEFAULT (datetime('now'))
);

-- 用户配置的监控领域
CREATE TABLE domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 发现的热点内容
CREATE TABLE topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id INTEGER REFERENCES domains(id),
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  source TEXT,
  heat_score REAL DEFAULT 0,
  discovered_at TEXT DEFAULT (datetime('now'))
);

-- 通知发送记录
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,         -- 'alert' | 'topic'
  ref_id INTEGER,             -- alert_id 或 topic_id
  channel TEXT NOT NULL,      -- 'websocket' | 'browser' | 'email'
  status TEXT DEFAULT 'sent', -- 'sent' | 'failed'
  sent_at TEXT DEFAULT (datetime('now'))
);

-- 应用设置（KV 存储）
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## 五、API 路由规范

### 关键词接口
| Method | Path | 说明 |
|--------|------|------|
| GET | /api/keywords | 获取所有关键词列表 |
| POST | /api/keywords | 添加新关键词 |
| PATCH | /api/keywords/:id | 更新（启用/停用） |
| DELETE | /api/keywords/:id | 删除关键词 |
| GET | /api/keywords/:id/alerts | 该关键词的告警历史 |

### 领域接口
| Method | Path | 说明 |
|--------|------|------|
| GET | /api/domains | 获取所有监控领域 |
| POST | /api/domains | 添加新领域 |
| DELETE | /api/domains/:id | 删除领域 |

### 热点接口
| Method | Path | 说明 |
|--------|------|------|
| GET | /api/topics | 获取热点列表（支持 ?domain_id&limit&offset） |
| POST | /api/topics/refresh | 手动触发一次热点刷新 |

### 告警接口
| Method | Path | 说明 |
|--------|------|------|
| GET | /api/alerts | 所有告警（支持分页） |
| PATCH | /api/alerts/:id/read | 标记已读 |

### 设置接口
| Method | Path | 说明 |
|--------|------|------|
| GET | /api/settings | 获取所有配置 |
| POST | /api/settings | 批量更新配置 |
| POST | /api/settings/test-email | 测试邮件配置 |
| POST | /api/settings/test-ai | 测试 AI 配置 |

---

## 六、定时任务规划

| 任务 | Cron 表达式 | 说明 |
|------|------------|------|
| 关键词监控 | `*/30 * * * *` | 每 30 分钟检查一次 |
| 热点发现 | `*/30 * * * *` | 每 30 分钟采集一次 |
| 数据清理 | `0 2 * * *` | 每天凌晨 2 点清理 7 天前数据 |

---

## 七、AI 服务规范（OpenRouter）

### 模型选择
- 主模型：`google/gemini-flash-1.5`（速度快、成本低）
- 备用模型：`openai/gpt-4o-mini`

### 调用场景

**场景1：关键词相关性验证**
```
Prompt: 判断以下内容是否与关键词"{keyword}"真实相关。
内容标题：{title}
内容摘要：{summary}
返回 JSON: {"relevant": true/false, "confidence": 0-1, "reason": "..."}
```

**场景2：热点摘要生成**
```
Prompt: 以下是关于"{domain}"领域的多条原始内容，请：
1. 识别出最重要的热点（最多5条）
2. 为每条生成100字中文摘要
3. 评估热度分（0-10）
返回 JSON 数组。
```

---

## 八、WebSocket 消息协议

```json
// 服务端 → 客户端：新告警
{
  "type": "alert",
  "data": {
    "id": 1,
    "keyword": "Claude 4",
    "title": "Anthropic 发布 Claude 4",
    "summary": "...",
    "url": "https://...",
    "source": "twitter",
    "relevance_score": 0.95,
    "triggered_at": "2026-04-22T10:00:00Z"
  }
}

// 服务端 → 客户端：新热点
{
  "type": "topic",
  "data": { ... }
}

// 服务端 → 客户端：系统状态
{
  "type": "status",
  "data": { "message": "热点检查完成，发现 3 条新内容" }
}
```

---

## 九、关键依赖版本（来自 MCP Context7）

| 包名 | 版本 | 来源 |
|------|------|------|
| express | v5.1.0 | Context7 /expressjs/express |
| better-sqlite3 | v12.6.2 | Context7 /wiselibs/better-sqlite3 |
| ws | v8.18.3 | Context7 /websockets/ws |
| nodemailer | latest | Context7 /nodemailer/nodemailer |
| node-cron | latest | Context7 /websites/nodecron |
| react-router | v7.x | Context7 /remix-run/react-router (从 'react-router' 导入) |
