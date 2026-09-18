# Teegal - 从AutoResearch到AutoProjects

<div align="center">

**简体中文** | [English](#english)

</div>

Teegal 起源于一个小团队的自我补足：我们没有前沿研究团队，也买不起算力，于是为自己写了一个 **AutoResearch Agent（自动研究智能体）**。但在实操中我们发现：AutoResearch 的方法并不局限于研究——它同样适用于任何项目型工作（Projects）。因此我们基于 AutoResearch 的递归式方法，封装出 **Projects Auto** 项目级自动化能力，让同一个 Agent 适配数据分析、模型训练、剪辑、视频制作等多类任务域——把一句需求自动推进为可交付的成果。

## 核心特点

### 1. 递归式执行（Recursive Execution）—— AutoResearch 的方法论
复杂任务自动递归分解为子任务，执行 → 观察 → 再分解，直到产出结果。全过程有工作笔记与执行记录可追溯，避免一次性长规划带来的失控。

### 2. 计算优化（Compute Optimization）—— 让"买不到算力"不再是门槛
- **本地执行**：代码运行、文件处理等轻任务在本地完成后端执行，零成本
- **云端 GPU**：训练等重任务自动调度到云端算力；本地只需维护云端凭证即可接入（hosted 模式）——GPU 规格、价格、库存、云厂商凭证全部在云端服务统一维护，本地与前端零渠道概念
- 任务按需路由，兼顾成本与性能

### 3. Projects Auto（Project-level Automation）—— 从 AutoResearch 泛化到 AutoProjects
AutoResearch 的方法论不止于研究：以项目为单位组织自动化——多阶段任务编排、产物统一落盘管理、断点恢复与执行对账，让 Agent 的产出沉淀为项目资产，而非一次性对话。

## 功能特性

- **智能对话** - 多轮对话，自动维护上下文
- **Auto 模式** - AI 自动分析需求并执行任务（ReAct 推理-行动循环）
- **Projects Auto** - 项目级自动化任务编排
- **GPU 云端算力** - hosted 代理接入云端 GPU，按量结算
- **文件管理** - 上传、预览、下载，产物自动关联任务
- **桌面端** - Electron 跨平台桌面应用，支持自动更新

## 项目结构

```
├── src/               # 前端应用（React 18 + TypeScript + Vite + shadcn-ui）
├── local-backend/     # 本地常驻后端（Node.js + Express + SQLite）
│                      #   ReAct 执行引擎、任务调度、GPU hosted 代理、本地数据存储
└── electron/          # 桌面端（Electron 主进程 / 预加载 / 打包与自动更新）
```

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + shadcn-ui
- **后端**：Node.js + Express + SQLite（local-storage）
- **桌面端**：Electron + electron-builder
- **国际化**：i18next

## 快速开始

### 前置要求
- Node.js 18+
- npm

### 1. 安装依赖
```bash
# 根目录（前端 + 桌面端）
npm install

# 本地后端
cd local-backend
npm install
```

### 2. 配置环境变量
```bash
# 复制模板并按需修改
cp .env.example .env
cp local-backend/.env.example local-backend/.env
```

### 3. 启动开发环境
```bash
# 启动本地后端（默认 3001 端口）
cd local-backend
npm run dev

# 新终端：启动 Web 前端（默认 8080 端口）
npm run dev

# 或直接启动桌面端开发环境（前端 + Electron）
npm run electron:dev
```

### 4. 构建桌面安装包
```bash
npm run electron:package:win    # Windows
npm run electron:package:mac    # macOS
npm run electron:package:linux  # Linux
```

## 环境变量

| 变量 | 位置 | 说明 |
|---|---|---|
| `VITE_HOME_WEB_URL` | 根目录 `.env` | 云端服务地址（不配置则使用默认官方服务） |
| `VITE_ALIYUN_OSS_BUCKET` / `REGION` | 根目录 `.env` | 对象存储直传配置（凭证由云端动态下发） |
| `GPU_WORKER_SECRET` | `local-backend/.env` | 云端 GPU 执行层服务间密钥 |
| `HOME_WEB_URL` | `local-backend/.env` | 云端地址（不配置则默认官方服务） |

完整说明见 `.env.example` 与 `local-backend/.env.example`。

## 云端算力

Teegal 采用 **hosted 云端执行架构**：本地不持有任何云厂商凭证，GPU 规格/价格/库存/结算全部由云端服务统一维护。

- **开箱即用**：克隆后无需任何配置，云端算力默认接入官方服务（`https://www.workbees.space`），训练等重任务自动调度到云端执行
- **自建云端（可选）**：如需指向自己的云端服务，在 `local-backend/.env` 配置：
   ```env
   GPU_WORKER_SECRET=your-worker-secret
   HOME_WEB_URL=https://your-cloud-service
   ```
   云端服务需自行部署（云端执行层代码不在本仓库中），负责配置云厂商凭证与对象存储；训练任务自动提交执行，状态/日志/产物 URL 回传本地展示

> OSS 与 GPU 同理：谁运行云端，谁配置存储。开源代码中不含任何存储凭证。

## 许可证

MIT

---

<div align="center">

<a name="english"></a>

# Teegal - From AutoResearch to AutoProjects (English)

**[简体中文](#top) | English**

</div>

Teegal began as a small team's way of compensating for what we lacked: no frontier research team, and no budget for compute. So we built an **AutoResearch Agent** for ourselves. Along the way, we discovered that the AutoResearch methodology is not limited to research — it applies to any project-based work. So we distilled its recursive methodology into **Projects Auto**, project-level automation that lets the same Agent adapt to many task domains — data analysis, model training, video editing, media production — turning a single request into deliverable results automatically.

## Key Highlights

### 1. Recursive Execution — the AutoResearch methodology
Complex tasks are automatically decomposed into subtasks in a recursive loop: execute → observe → decompose further — until results are produced. The whole process is traceable through working notes and execution records, avoiding the loss of control of one-shot long planning.

### 2. Compute Optimization — no compute budget? No longer a blocker
- **Local execution**: lightweight tasks (code running, file processing) run locally at zero cost
- **Cloud GPU**: heavy tasks (training) are automatically scheduled to cloud compute; you only need to maintain cloud credentials locally (hosted mode) — GPU specs, pricing, availability, and provider credentials are all maintained by the cloud service. No provider concepts leak into the local codebase
- Tasks are routed on demand, balancing cost and performance

### 3. Projects Auto — from AutoResearch to AutoProjects
The methodology generalizes beyond research: automation is organized around projects — multi-stage task orchestration, unified artifact management, resumable runs and execution reconciliation. Agent output accumulates as project assets instead of one-off conversations.

## Features

- **Smart conversation** - Multi-turn dialogue with automatic context management
- **Auto mode** - AI analyzes requests and executes tasks automatically (ReAct loop)
- **Projects Auto** - Project-level automation orchestration
- **Cloud GPU** - hosted proxy to cloud GPUs with usage-based billing
- **File management** - Upload, preview, download; artifacts are linked to tasks
- **Desktop app** - Cross-platform Electron app with auto-update

## Project Structure

```
├── src/               # Frontend app (React 18 + TypeScript + Vite + shadcn-ui)
├── local-backend/     # Local resident backend (Node.js + Express + SQLite)
│                      #   ReAct engine, task scheduling, GPU hosted proxy, local storage
└── electron/          # Desktop shell (Electron main / preload / packaging & auto-update)
```

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn-ui
- **Backend**: Node.js + Express + SQLite
- **Desktop**: Electron + electron-builder
- **i18n**: i18next

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### 1. Install dependencies
```bash
# Root (frontend + desktop)
npm install

# Local backend
cd local-backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
cp local-backend/.env.example local-backend/.env
```

### 3. Start development
```bash
# Start local backend (port 3001 by default)
cd local-backend
npm run dev

# New terminal: start web frontend (port 8080 by default)
npm run dev

# Or start desktop dev environment (frontend + Electron)
npm run electron:dev
```

### 4. Build desktop installers
```bash
npm run electron:package:win    # Windows
npm run electron:package:mac    # macOS
npm run electron:package:linux  # Linux
```

## Environment Variables

| Variable | Location | Description |
|---|---|---|
| `VITE_HOME_WEB_URL` | Root `.env` | Cloud service URL (defaults to the official service) |
| `VITE_ALIYUN_OSS_BUCKET` / `REGION` | Root `.env` | Object storage direct-upload config (credentials are delivered by the cloud) |
| `GPU_WORKER_SECRET` | `local-backend/.env` | Service-to-service secret for the cloud GPU execution layer |
| `HOME_WEB_URL` | `local-backend/.env` | Cloud service URL (defaults to the official service) |

See `.env.example` and `local-backend/.env.example` for details.

## Cloud Compute

Teegal uses a **hosted cloud execution architecture**: no cloud provider credentials live in the local codebase. GPU specs, pricing, availability, and settlement are all maintained by the cloud service.

- **Out of the box**: after cloning, zero configuration is needed — cloud compute defaults to the official service (`https://www.workbees.space`), and heavy tasks like training are scheduled to the cloud automatically
- **Self-hosted cloud (optional)**: to point to your own cloud service, set in `local-backend/.env`:
   ```env
   GPU_WORKER_SECRET=your-worker-secret
   HOME_WEB_URL=https://your-cloud-service
   ```
   The cloud service needs to be deployed by yourself (the cloud execution layer is not part of this repository); it holds the provider credentials and object storage config. Training tasks are submitted automatically; status, logs, and artifact URLs flow back to the local UI

> The same rule applies to object storage as to GPUs: whoever runs the cloud configures the storage. No storage credentials are bundled with the open-source code.

## License

MIT
