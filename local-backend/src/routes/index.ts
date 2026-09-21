/**
 * 路由聚合器 - 统一注册所有路由
 * 
 * 使用方法：
 * 在 server.ts 中调用 registerRoutes(app, { wsManager })
 */
import { Express } from 'express';
import { WebSocketManager } from '../websocket';

// 导入所有路由模块
import ossRouter from './oss';
import webshellRouter from './webshell';
import autoRouter, { createApiAutoRouter } from './auto';
import reActRouter from './react';
import simplesearchRouter from './simplesearch';
import llmRouter from './llm';

import healthRouter, { setWsManager } from './health';
import llmModelsRouter from './llm-models';
import llmProxyRouter from './llmProxy';

import codeexecutionRouter, { recoverOrphanTasks } from './codeexecution';
import rentalRouter from './rental';
import { AppScheduler } from '../codeexecution/AppScheduler';

/**
 * 路由注册配置
 */
interface RouteConfig {
  wsManager: WebSocketManager;
}

/**
 * 统一注册所有路由到 Express 应用
 */
export function registerRoutes(app: Express, config: RouteConfig): void {
  console.log('🔄 [ROUTES] 开始注册路由模块...');

  // 注入依赖
  setWsManager(config.wsManager);
  AppScheduler.getInstance().setWsManager(config.wsManager);

  // 注册路由（按路径前缀分组）
  
  // 基础路由（根路径和健康检查）
  app.use('/', healthRouter);
  
  // 核心业务路由
  app.use('/oss', ossRouter);
  app.use('/webshell', webshellRouter);
  app.use('/auto', autoRouter);
  app.use('/api/auto', createApiAutoRouter());
  app.use('/react', reActRouter);
  app.use('/simplesearch', simplesearchRouter);
  app.use('/llm', llmRouter);
  
  app.use('/api/llm-models', llmModelsRouter);
  app.use('/api/llm-proxy', llmProxyRouter);
  
  // 代码执行路由
  app.use('/api/code-execution', codeexecutionRouter);

  // 🔥 SSH 租赁路由（云端账本转发 + 本地资源中心）
  app.use('/api/rental', rentalRouter);

  // 🔥 数据库已就绪，恢复悬挂的 GPU 任务
  recoverOrphanTasks().catch(err => {
    console.error('[ROUTES] 恢复悬挂 GPU 任务失败:', err.message);
  });
}

export default registerRoutes;
