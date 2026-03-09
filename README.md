# 🤖 Crypto BD Agent

> **加密圈 BD 自动化管理系统** — 自动发现新上线加密项目，智能联系项目方，追踪沟通进度，驱动交易所 Listing 业务增长。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tests](https://img.shields.io/badge/Tests-14%20passing-brightgreen.svg)](#)

---

## 📖 项目简介

Crypto BD Agent 是一款专为加密货币交易所 BD（Business Development）团队设计的自动化管理平台。系统通过对接 CoinGecko 和 CoinMarketCap 实时监控新上线项目，自动采集项目方的 Twitter、Telegram、Discord、官方邮箱等联系渠道，并使用预设英文模板发起首次联系邀请项目在交易所上币。对于 2 天内无回复的项目，系统自动触发跟进消息，全程追踪沟通状态，并通过数据分析仪表板实时呈现回复率、转化率等核心 KPI。

**核心工作流程：**

```
发现新项目 → 采集联系渠道 → 发送英文首次联系模板 → 追踪回复状态
     ↓                                                      ↓
  2天无回复                                           LLM分析回复意图
     ↓                                                      ↓
  自动跟进                                          生成个性化跟进话术
```

---

## ✨ 核心功能

### 🔍 项目发现模块
- 实时监控 **CoinGecko** 和 **CoinMarketCap** 新上线项目
- 支持扫描时间范围选择：过去 **24小时 / 3天 / 7天**
- 自动识别 **Meme 类项目**，优先标记
- SSE 实时进度推送：扫描时显示当前页数、已发现数量、最新项目名称
- 已入库项目自动更新市值、价格、联系渠道（不重复入库）
- 扫描完成后弹窗展示新项目列表，支持一键批量发起首次联系

### 📋 项目管理
- 完整状态流转：`发现 → 已联系 → 已回复 → 洽谈中 → 已成交 / 已拒绝`
- 支持按状态、关键词、Meme标签多维度筛选
- 项目详情页展示完整沟通历史记录
- 支持手动更新状态、添加备注

### ⏰ 智能跟进系统
- 自动识别 **2天内无回复** 的项目
- 一键触发跟进消息，或批量自动跟进
- 跟进记录完整保存，防止重复联系

### 📝 沟通模板管理
- 内置 3 套预设英文模板：**首次联系 / 跟进 / 报价**
- 支持变量替换：`{{projectName}}`、`{{symbol}}`、`{{contactName}}`
- 中英双语预览
- 支持创建、编辑、删除自定义模板

### 👥 多账号管理
- 支持添加多个 **Twitter / Telegram / Email** 账号
- 每账号可设置每日发送量上限，避免被平台限流
- 发送时自动轮换账号，分散风险

### 🤖 LLM 智能分析
- 自动分析项目方回复的**意图**（感兴趣 / 拒绝 / 需要更多信息）
- 识别回复**情绪**（积极 / 中性 / 消极）
- 根据回复内容生成**个性化跟进话术建议**，提升转化率

### 📊 数据分析仪表板
- **转化漏斗**：发现 → 联系 → 回复 → 成交 全链路可视化
- **渠道分布饼图**：各联系渠道的消息量占比
- **14天趋势折线图**：每日联系数、回复数、成交数
- **核心 KPI**：总项目数、回复率、转化率、Listing 收入

### 🔔 Telegram 通知
- 项目方回复时**实时推送** Telegram 提醒
- 新项目发现通知
- 跟进提醒（2天无回复）
- 支持配置 Bot Token 和 Chat ID

---

## 🛠 技术栈

| 层级 | 技术选型 |
|------|---------|
| **前端框架** | React 19 + TypeScript 5.9 + Vite 7 |
| **UI 组件库** | shadcn/ui + Tailwind CSS 4 + Radix UI |
| **数据可视化** | Recharts |
| **API 层** | tRPC 11（端到端类型安全） |
| **后端框架** | Express 4 + Node.js |
| **数据库** | MySQL / TiDB（Drizzle ORM） |
| **实时推送** | SSE（Server-Sent Events） |
| **AI 分析** | LLM API（内置集成） |
| **认证** | Manus OAuth |
| **测试** | Vitest（14 个测试用例） |
| **外部数据** | CoinGecko API + CoinMarketCap API |

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 10
- MySQL 8.0+ 或 TiDB

### 安装依赖

```bash
git clone https://github.com/didiYang/crypto_bd_agent.git
cd crypto_bd_agent
pnpm install
```

### 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# 数据库连接
DATABASE_URL=mysql://user:password@localhost:3306/crypto_bd

# 认证
JWT_SECRET=your_jwt_secret_here

# Manus OAuth（如使用 Manus 平台则自动注入）
VITE_APP_ID=your_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
```

### 数据库迁移

```bash
pnpm db:push
```

### 启动开发服务器

```bash
pnpm dev
```

访问 `http://localhost:3000` 即可使用。

### 运行测试

```bash
pnpm test
```

---

## 📱 使用指南

### 第一步：系统配置

进入**系统设置**页面：

1. 填入 **Telegram Bot Token** 和 **Chat ID**，点击"发送测试消息"验证通知
2. 填入 **CoinMarketCap API Key**（免费 Basic 计划即可），启用更精准的新项目发现
3. 点击"初始化默认模板"，系统自动创建 3 套英文 BD 沟通模板
4. 调整自动化参数：跟进等待天数（默认2天）、每日最大发送量

### 第二步：添加联系账号

进入**账号管理**页面，添加用于发送消息的账号：

- **Twitter 账号**：用于发送 Twitter DM
- **Telegram 账号**：用于发送 Telegram 消息
- **Email 账号**：用于发送邮件（配置 SMTP 信息）

### 第三步：扫描新项目

在**仪表板**点击"扫描新项目"按钮：

1. 通过下拉箭头选择时间范围（24小时 / 3天 / 7天）
2. 点击主按钮开始扫描，进度条实时显示扫描状态
3. 扫描完成后弹窗展示新发现的项目列表
4. 勾选目标项目，选择联系渠道，点击"批量发送首次联系"

### 第四步：追踪跟进

- **跟进管理**页面：查看所有 2 天内无回复的项目，一键发送跟进消息
- **项目详情**页面：查看完整沟通历史，使用 LLM 分析回复意图，获取跟进建议
- **仪表板**"自动跟进"按钮：一键处理所有待跟进项目

---

## 📊 数据库结构

```
projects          # 项目信息（名称、代币、市值、联系渠道、状态）
messages          # 消息记录（发送时间、渠道、内容、回复状态）
templates         # 沟通模板（首次联系、跟进、报价）
accounts          # 联系账号（Twitter、Telegram、Email）
settings          # 系统设置（Telegram配置、API密钥、自动化参数）
users             # 用户信息（认证）
```

---

## 🗂 项目结构

```
crypto_bd_agent/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx      # 仪表板
│       │   ├── Projects.tsx       # 项目列表
│       │   ├── ProjectDetail.tsx  # 项目详情
│       │   ├── FollowUp.tsx       # 跟进管理
│       │   ├── Templates.tsx      # 模板管理
│       │   ├── Accounts.tsx       # 账号管理
│       │   ├── Analytics.tsx      # 数据分析
│       │   └── Settings.tsx       # 系统设置
│       └── components/
│           ├── ScanResultDialog.tsx  # 扫描结果弹窗
│           └── StatusBadge.tsx       # 状态徽章
├── server/
│   ├── routers.ts       # tRPC API 路由（30+ 端点）
│   ├── db.ts            # 数据库查询助手
│   ├── discovery.ts     # 项目发现服务（CoinGecko/CMC）
│   ├── scanProgress.ts  # SSE 扫描进度推送
│   └── bd-agent.test.ts # 14 个 vitest 测试用例
├── drizzle/
│   └── schema.ts        # 数据库 Schema
└── todo.md              # 功能开发记录
```

---

## 🔌 API 集成说明

### CoinGecko（免费）

无需 API Key，使用 `/coins/markets` 端点，以 `ath_date` 作为新上线时间代理指标。免费计划限制：每分钟 30 次请求。

### CoinMarketCap（推荐配置）

申请 [CMC 免费 Basic 计划](https://coinmarketcap.com/api/)，填入 API Key 后可使用 `/cryptocurrency/listings/latest` 按 `date_added` 精确排序，比 CoinGecko 方案更准确。

### Telegram Bot

1. 在 Telegram 中搜索 `@BotFather`，发送 `/newbot` 创建 Bot
2. 复制 Bot Token 到系统设置
3. 获取你的 Chat ID（可通过 `@userinfobot` 查询）
4. 在设置页点击"发送测试消息"验证配置

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交变更：`git commit -m 'feat: add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

---

## 📄 License

本项目基于 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

- [CoinGecko API](https://www.coingecko.com/en/api) — 加密货币市场数据
- [CoinMarketCap API](https://coinmarketcap.com/api/) — 加密货币新项目数据
- [shadcn/ui](https://ui.shadcn.com/) — UI 组件库
- [tRPC](https://trpc.io/) — 端到端类型安全 API

---

*Built with ❤️ for Crypto BD Teams*
