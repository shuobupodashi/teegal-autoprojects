/**
 * 健康检查与根路由 - /, /health
 */
import { Router } from 'express';

const router = Router();

// 依赖注入：由 index.ts 注入
let wsManager: any = null;

export function setWsManager(manager: any) {
  wsManager = manager;
}

/**
 * 健康检查
 * GET /health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connections: wsManager?.getConnectionCount() || 0,
    memory: process.memoryUsage()
  });
});

/**
 * 根路径
 * GET /
 */
router.get('/', (req, res) => {
  res.json({
    service: 'ECS Async Worker',
    version: '1.0.0',
    endpoints: {
      'POST /async-task': '创建异步任务',
      'POST /oss/upload': '直接上传文件到OSS',
      'POST /oss/delete': '删除OSS文件',
      'POST /deepresearch': 'DeepResearch 深度研究服务',
      'POST /deepresearch/edit': 'DeepResearch Markdown 编辑服务',
      'POST /auto/plan': 'Auto Planning 规划服务',
      'POST /api/auto/summary': 'Summary 服务',
      'POST /api/auto/reactionLoopSummary': 'Reaction Loop Summary 服务',
      'POST /reaction/select-tool': 'Reaction 工具选择服务',
      'POST /reaction/adjust-steps': 'Reaction 计划调整服务',
      'POST /llm/test': 'LLM 统一调用测试服务',
      'POST /slidev/build': 'Slidev 幻灯片构建服务',
      'POST /document/convert': '文档转 Markdown 服务',
      'POST /urlreader/process': 'URL Reader 服务',
      'POST /simplesearch': 'Simple Search 服务',
      'POST /api/dataedit/generate-excel-commands': '数据编辑服务',
      'GET /wecom/webhook': '企微 URL 验证',
      'POST /wecom/webhook': '企微消息回调',
      'GET /health': '健康检查',
      'WS /ws?conversationId={id}': 'WebSocket 连接'
    }
  });
});

export default router;
