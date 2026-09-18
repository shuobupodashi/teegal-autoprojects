/**
 * ECS Async Worker - 主入口文件
 * 
 * 采用路由模块化架构，API 逻辑分散在 routes/ 目录下
 * 本文件只负责：中间件配置、路由注册、服务启动、优雅关闭
 */
// 必须在最前面加载环境变量，确保所有模块能正确获取运行配置
import dotenv from 'dotenv';
import path from 'path';
import { loadEncryptedEnv } from './utils/EnvDecryptor';

// 🔥 优先尝试加载加密的环境变量文件（生产环境：打包时 obfuscate-build.js 由 .env 加密生成）
loadEncryptedEnv();

// 🔥 然后加载普通 .env 文件（开发环境）
// ⚠️ 注意：dotenv 默认不覆盖已存在的变量，所以若存在 .env.encrypted，
//    加密文件里的旧值会优先生效——开发时改了 .env 不生效的话，删除 local-backend/.env.encrypted
const envPath = path.resolve(process.cwd(), '.env');
console.log('[SERVER] 加载环境变量文件:', envPath);
dotenv.config({ path: envPath });

import express from 'express';
import cors from 'cors';
import { WebSocketManager } from './websocket';
import { registerRoutes } from './routes';
import { localDatabase, localStorageRouter } from './local-storage';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ============================================
// 中间件配置
// ============================================
app.use(cors({
  origin: '*',
  credentials: false,  // 当 origin 是 '*' 时，credentials 必须是 false
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-LLM-Config']  // 🔥 添加自定义请求头
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: 'text/xml' })); // 支持 XML 格式（企微 webhook 需要）
app.options('*', cors()); // 手动处理 OPTIONS 请求

// ============================================
// 初始化核心服务
// ============================================
// 初始化 SQLite 数据库
try {
  localDatabase.connect();
  console.log('🗄️ [LOCAL-DB] SQLite 数据库已就绪');
} catch (error) {
  console.error('❌ [LOCAL-DB] SQLite 数据库初始化失败:', error);
}

const wsManager = new WebSocketManager();

// ============================================
// 注册所有路由模块
// ============================================
// 注册本地存储 API
app.use('/api/local', localStorageRouter);

// 注册其他路由
registerRoutes(app, { wsManager });

// ============================================
// 启动 HTTP 服务
// ============================================
async function startServer() {
  // 🔥 显式绑定 127.0.0.1：避免 macOS 上 localhost 解析到 IPv6 ::1 导致连接失败
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ [ECS-ASYNC-WORKER] HTTP Server 启动成功');
    console.log(`📍 地址: http://127.0.0.1:${PORT}`);
    console.log(`🔌 WebSocket: ws://127.0.0.1:${PORT}/ws`);
    console.log(`🔔 企微 Webhook: http://127.0.0.1:${PORT}/wecom/webhook`);
    console.log('='.repeat(60));
    console.log('');
  });

  // ============================================
  // 启动 WebSocket 服务
  // ============================================
  wsManager.start(server);

  // ============================================
  // 优雅关闭
  // ============================================
  const gracefulShutdown = () => {
    console.log('');
    console.log('🛑 [ECS-ASYNC-WORKER] 收到关闭信号，开始优雅关闭...');
    
    // 关闭 SQLite 数据库
    try {
      localDatabase.close();
    } catch (error) {
      console.error('❌ [LOCAL-DB] 数据库关闭失败:', error);
    }
    
    // 停止接收新请求
    server.close(() => {
      console.log('✅ [ECS-ASYNC-WORKER] HTTP Server 已关闭');
    });
    
    // 关闭所有 WebSocket 连接
    wsManager.closeAll();
    
    // 等待 5 秒后强制退出
    setTimeout(() => {
      console.log('⏱️ [ECS-ASYNC-WORKER] 强制退出');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return server;
}

// 启动服务
let gracefulShutdown: (() => void) | null = null;

startServer().then((server) => {
  // 定义优雅关闭函数
  gracefulShutdown = () => {
    console.log('');
    console.log('🛑 [ECS-ASYNC-WORKER] 收到关闭信号，开始优雅关闭...');
    
    // 关闭 SQLite 数据库
    try {
      localDatabase.close();
    } catch (error) {
      console.error('❌ [LOCAL-DB] 数据库关闭失败:', error);
    }
    
    // 停止接收新请求
    server.close(() => {
      console.log('✅ [ECS-ASYNC-WORKER] HTTP Server 已关闭');
    });
    
    // 关闭所有 WebSocket 连接
    wsManager.closeAll();
    
    // 等待 5 秒后强制退出
    setTimeout(() => {
      console.log('⏱️ [ECS-ASYNC-WORKER] 强制退出');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}).catch((error) => {
  console.error('❌ [ECS-ASYNC-WORKER] 启动失败:', error);
  process.exit(1);
});

// ============================================
// 未捕获异常处理
// ============================================
process.on('uncaughtException', (error) => {
  console.error('❌ [ECS-ASYNC-WORKER] 未捕获异常:', error);
  if (gracefulShutdown) gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [ECS-ASYNC-WORKER] 未处理的 Promise 拒绝:', reason);
});
