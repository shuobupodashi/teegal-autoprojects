# Local Backend

Teegal 桌面应用本地后端 - 文件处理、模型管理、数据存储

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 生产模式
npm start
```

## 环境配置

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

## 目录结构

```
local-backend/
├── src/
│   ├── server.ts          # 主服务入口
│   ├── routes/            # API 路由
│   ├── codeexecution/     # 代码执行器
│   └── utils/             # 工具函数
├── dist/                  # 编译输出
├── package.json
└── tsconfig.json
```

## Docker 支持

使用 `Dockerfile.python-cpu` 构建 Python 执行环境：

```bash
docker build -f Dockerfile.python-cpu -t python-cpu:latest .
```
