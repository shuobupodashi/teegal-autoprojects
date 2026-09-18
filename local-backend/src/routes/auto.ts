/**
 * Auto 规划与 Summary 路由 - /auto/*, /api/auto/*
 */
import { Router } from 'express';
import { SummaryModule } from '../planreactionloop/SummaryModule';
import { unifiedModelRegistry } from '../utils/llm/UnifiedModelRegistry';
import { OrganizationSubCategory } from '../utils/llm/types';

const router = Router();

export default router;

export function createApiAutoRouter() {
  const apiRouter = Router();

  apiRouter.post('/summary', async (req, res) => {
    try {
      const request = req.body;
      const userId = request.userId || req.headers['x-user-id'] as string;

      // 🔥 检查 environmentText（包含 userQuery 等所有环境信息）
      if (!request.environmentText) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数: environmentText'
        });
      }

      console.log('📝 [AUTO] 接收 Summary 请求:', {
        environmentTextLength: request.environmentText?.length || 0,
        currentDepth: request.currentDepth,
        maxDepth: request.maxDepth,
        userId: userId,
      });

      const model = unifiedModelRegistry.getModelForSubCategory(OrganizationSubCategory.SUMMARY, userId);
      if (!model) {
        return res.status(400).json({
          success: false,
          error: '未配置总结模型，请先在设置中绑定模型'
        });
      }

      const summaryModule = new SummaryModule(model.callConfig);
      const result = await summaryModule.generateSummary(request);

      if (!result.success) {
        return res.status(500).json(result);
      }

      console.log('✅ [AUTO] Summary 生成完成');
      res.json(result);

    } catch (error) {
      console.error('❌ [AUTO] Summary 生成失败:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Summary 服务异常'
      });
    }
  });

  apiRouter.post('/reactionLoopSummary', async (req, res) => {
    try {
      const request = req.body;
      const userId = request.userId || req.headers['x-user-id'] as string;

      // 🔥 userQuery 或 agentMessage 必须有一个，或者从 environmentText 中提取
      if (!request.userQuery && !request.agentMessage && !request.environmentText) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数: userQuery、agentMessage 或 environmentText'
        });
      }

      console.log('📝 [AUTO] 接收 ReactionLoopSummary 请求:', {
        userQuery: request.userQuery?.substring(0, 50) + '...' || '(无)',
        agentMessage: request.agentMessage?.substring(0, 50) + '...' || '(无)',
        userId: userId,
      });

      const model = unifiedModelRegistry.getModelForSubCategory(OrganizationSubCategory.SUMMARY, userId);
      if (!model) {
        return res.status(400).json({
          success: false,
          error: '未配置总结模型，请先在设置中绑定模型'
        });
      }

      const summaryModule = new SummaryModule(model.callConfig);
      const result = await summaryModule.reactionLoopSummary(request);

      if (!result.success) {
        return res.status(500).json(result);
      }

      console.log('✅ [AUTO] ReactionLoopSummary 生成完成');

      res.json(result);

    } catch (error) {
      console.error('❌ [AUTO] ReactionLoopSummary 生成失败:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'ReactionLoopSummary 服务异常'
      });
    }
  });

  return apiRouter;
}
