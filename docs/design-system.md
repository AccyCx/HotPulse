# HotPulse - 设计系统文档

> 来源：ui-ux-pro-max 技能生成 | 日期：2026-04-22

---

## 一、整体风格

| 属性 | 值 |
|------|-----|
| 主题 | **明亮（Light）**，Light Glassmorphism |
| 风格 | 磨砂玻璃 + 白色/浅色底 |
| 产品类型 | SaaS Dashboard |
| 字体情绪 | Friendly · Modern · Clean · Professional |

---

## 二、调色板

```
主色       #0891B2  (Cyan-600)   - 导航高亮、按钮、链接
辅助色     #22D3EE  (Cyan-400)   - 渐变、悬停效果
强调/CTA   #22C55E  (Green-500)  - 成功状态、主按钮、热度标记
背景       #ECFEFF  (Cyan-50)    - 页面底色
卡片底色   #FFFFFF              - 卡片/面板背景
文字主色   #164E63  (Cyan-900)   - 正文、标题
文字次色   #0E7490  (Cyan-700)   - 副标题、描述
文字弱色   #67E8F9  (Cyan-300)   - 占位符、禁用状态
边框       #A5F3FC  (Cyan-200)   - 卡片边框
危险色     #EF4444  (Red-500)    - 错误、删除
警告色     #F59E0B  (Amber-500)  - 警告、待确认
```

### Tailwind 配置扩展

```javascript
colors: {
  primary: '#0891B2',
  secondary: '#22D3EE',
  accent: '#22C55E',
  brand: {
    50: '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#06B6D4',
    600: '#0891B2',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
  }
}
```

---

## 三、字体

| 字体 | 用途 | 权重 |
|------|------|------|
| Plus Jakarta Sans | 全站主字体 | 300/400/500/600/700 |

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

body {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
```

### 字号规范
```css
h1: 2rem (32px) · font-weight: 700
h2: 1.5rem (24px) · font-weight: 600
h3: 1.25rem (20px) · font-weight: 600
body: 0.875rem (14px) · font-weight: 400
small: 0.75rem (12px) · font-weight: 400
```

---

## 四、组件规范

### 卡片（Card）
```css
/* 标准卡片 */
background: rgba(255, 255, 255, 0.80);
backdrop-filter: blur(12px);
border: 1px solid rgba(165, 243, 252, 0.60);  /* cyan-200/60 */
border-radius: 12px;
box-shadow: 0 1px 3px rgba(8, 145, 178, 0.08);

/* 悬停状态 */
box-shadow: 0 4px 12px rgba(8, 145, 178, 0.15);
border-color: rgba(34, 211, 238, 0.60);  /* cyan-400/60 */
```

Tailwind：`bg-white/80 backdrop-blur-md border border-cyan-200/60 rounded-xl shadow-sm hover:shadow-md hover:border-cyan-400/60 transition-all duration-200`

### 按钮规范

```
主按钮：bg-primary text-white hover:bg-cyan-700
辅助按钮：bg-white border border-cyan-200 text-primary hover:bg-cyan-50
危险按钮：bg-red-50 border border-red-200 text-red-600 hover:bg-red-100
图标按钮：p-2 rounded-lg hover:bg-cyan-50 text-cyan-600
```

### 徽章/标签（Badge）

```
关键词：bg-cyan-100 text-cyan-700 rounded-full px-3 py-1
热点领域：bg-green-100 text-green-700 rounded-full
来源标签：bg-slate-100 text-slate-600 rounded px-2 py-0.5 text-xs
```

### 侧边导航栏

```
宽度：240px（桌面） | 图标模式（移动端收缩）
背景：bg-white/90 backdrop-blur-md border-r border-cyan-100
Logo 区：h-16 flex items-center px-6
导航项高亮：bg-cyan-50 text-primary border-r-2 border-primary
```

---

## 五、布局规范

### 整体布局
```
┌─────────────────────────────────────────┐
│  Sidebar (240px fixed)  │  Main Content  │
│  ┌──────────────────┐   │  ┌──────────┐ │
│  │ Logo             │   │  │ TopBar   │ │
│  │ Nav Items        │   │  └──────────┘ │
│  │                  │   │  ┌──────────┐ │
│  │                  │   │  │ Page     │ │
│  │                  │   │  │ Content  │ │
│  └──────────────────┘   │  └──────────┘ │
└─────────────────────────────────────────┘
```

### 间距系统
```
页面内边距：p-6（桌面）| p-4（移动）
卡片内边距：p-4 或 p-5
卡片间距：gap-4
组件间距：space-y-4
```

### 响应式断点
```
sm: 375px   - 手机竖屏
md: 768px   - 平板 / 手机横屏
lg: 1024px  - 笔记本
xl: 1440px  - 桌面
```

---

## 六、视觉效果

### Glassmorphism（明亮版）
```css
/* 页面背景 - 渐变网格 */
background: 
  linear-gradient(135deg, #ECFEFF 0%, #F0FDFE 50%, #ECFEFF 100%);

/* 装饰圆形光晕 */
.glow-primary {
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(8, 145, 178, 0.08) 0%, transparent 70%);
  filter: blur(40px);
}

/* 卡片玻璃效果 */
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
```

### 热度指示器（Heat Score）
```
0-3分：text-slate-400 bg-slate-50    （冷门）
4-6分：text-amber-600 bg-amber-50   （一般）
7-8分：text-orange-600 bg-orange-50  （热门）
9-10分：text-red-600 bg-red-50 + 闪烁动画 （爆热）
```

### 实时状态指示
```css
/* 在线指示点 */
.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #22C55E;
  animation: pulse 2s infinite;
}
```

---

## 七、图标规范

- 图标库：**Lucide React**（全程 SVG，不使用 emoji）
- 统一尺寸：`w-4 h-4`（小）| `w-5 h-5`（标准）| `w-6 h-6`（大）
- 颜色：跟随文字颜色，或 `text-primary`

| 功能 | Lucide 图标 |
|------|------------|
| 仪表盘 | `LayoutDashboard` |
| 关键词 | `Tag` |
| 热点 | `TrendingUp` |
| 设置 | `Settings` |
| 通知 | `Bell` |
| 添加 | `Plus` |
| 删除 | `Trash2` |
| 刷新 | `RefreshCw` |
| 来源-Twitter | `Twitter` |
| 来源-GitHub | `Github` |
| 邮件 | `Mail` |
| 链接 | `ExternalLink` |
| 已读 | `Check` |

---

## 八、交互规范

| 规则 | 实现 |
|------|------|
| 所有可点击元素 | `cursor-pointer` |
| 过渡动画 | `transition-all duration-200` |
| 悬停反馈 | 颜色/阴影变化，禁止布局偏移 |
| 加载状态 | 骨架屏（Skeleton）+ Spinner |
| 空状态 | 插画 + 引导文字 |
| 表单验证 | 实时验证 + 红色边框提示 |

---

## 九、Pre-Delivery 检查清单

- [ ] 无 emoji 作为图标（全部使用 Lucide SVG）
- [ ] 所有可点击元素有 `cursor-pointer`
- [ ] 悬停状态平滑（150-300ms）
- [ ] 明亮模式文字对比度 ≥ 4.5:1
- [ ] 键盘导航 focus 状态可见
- [ ] `prefers-reduced-motion` 已处理
- [ ] 响应式测试：375px / 768px / 1024px / 1440px
- [ ] 无水平滚动（移动端）
- [ ] 固定导航栏后内容不被遮挡
