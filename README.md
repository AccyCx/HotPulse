# HotPulse - 热点监控系统

自动化热点发现与通知系统，支持关键词监控、多源热点聚合、AI智能验证、实时通知。

## 快速启动

### 1. 后端
```bash
cd backend
# 复制环境变量文件（可选，也可以直接在前端设置页面配置）
cp .env.example .env
# 启动
npm start
# 或开发模式（自动重启）
npm run dev
```

### 2. 前端
```bash
cd frontend
npm run dev
```

### 3. 访问
打开浏览器访问 `http://localhost:5173`（或 5174）

---

## 首次配置

进入 **设置页面** 配置以下内容：

| 配置项 | 说明 | 获取方式 |
|--------|------|---------|
| OpenRouter API Key | AI 验证与摘要（必填） | [openrouter.ai](https://openrouter.ai) 注册 |
| twitterapi.io Key | Twitter/X 数据源（可选） | [twitterapi.io](https://twitterapi.io) 注册 |
| SMTP 邮件 | 邮件通知（可选） | Gmail 开启应用专用密码 |

---

## 功能说明

### 关键词监控
- 添加关键词（如"Claude 4"、"GPT-5"）
- 每 30 分钟自动搜索多个来源
- AI 验证内容真实性（过滤假冒无关内容）
- 触发后推送 WebSocket + 浏览器通知 + 邮件

### 热点发现
- 添加监控领域（如"AI编程"、"量子计算"）
- 每 30 分钟自动从多源聚合热点
- AI 智能摘要、去重、热度评分（0-10）

### 数据源
| 来源 | 类型 | 费用 |
|------|------|------|
| Twitter/X | twitterapi.io | 按用量 |
| Google News | RSS 爬取 | 免费 |
| Hacker News | 官方 API | 免费 |
| Reddit | JSON API | 免费 |
| GitHub Trending | 网页爬取 | 免费 |
| arXiv | RSS 订阅 | 免费 |
| 技术博客 | RSS 订阅 | 免费 |

---

## 技术栈

- **前端**: React 19 + Vite + Tailwind CSS + React Router v7
- **后端**: Express v5 + better-sqlite3 + WebSocket (ws)
- **AI**: OpenRouter API (google/gemini-flash-1.5)
- **调度**: node-cron (每 30 分钟)
- **邮件**: Nodemailer (SMTP)

---

## 项目结构

```
AIProject/
├── docs/              # 需求、架构、设计系统文档
├── backend/           # Node.js Express 后端
│   ├── src/
│   │   ├── db/        # SQLite 数据库
│   │   ├── routes/    # REST API 路由
│   │   ├── services/  # 核心服务（AI/WS/Email/Monitor/Discovery）
│   │   ├── scrapers/  # 多源数据采集
│   │   └── utils/     # 工具函数
│   └── hotpulse.db    # SQLite 数据库文件（自动创建）
└── frontend/          # React 前端
    └── src/
        ├── pages/     # 四个页面
        ├── components/ # 公共组件
        ├── hooks/     # WebSocket/通知 hooks
        └── lib/       # API 客户端
```
