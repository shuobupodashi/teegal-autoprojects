/**
 * LLM 测试路由 - /llm/*
 */
import { Router } from 'express';
import { unifiedModelRegistry } from '../utils/llm/UnifiedModelRegistry';
import { llmService } from '../utils/LLMService';
import { AssistantSubCategory } from '../utils/llm/types';

const router = Router();

router.post('/test', async (req, res) => {
  try {
    const { message, subCategory = 'code' } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: '缺少消息内容'
      });
    }
    
    console.log(`🤖 [LLM-TEST] 测试请求:`, message.substring(0, 100));
    
    const userId = req.body.userId;

    const model = unifiedModelRegistry.getModelForSubCategory(subCategory as AssistantSubCategory, userId);

    if (!model) {
      return res.status(500).json({
        success: false,
        error: `未配置 ${subCategory} 模型，请先在设置中绑定模型`
      });
    }
    
    const response = await llmService.callWithConfig({
      messages: [{ role: 'user', content: message }],
      temperature: 0.7
    }, model.callConfig, 30000);
    
    console.log(`✅ [LLM-TEST] 调用成功:`, {
      success: response.success,
      contentLength: response.content?.length || 0
    });
    
    res.json({
      success: true,
      model: {
        id: model.id,
        name: model.name,
        modelId: model.modelId
      },
      response: {
        content: response.content,
        usage: response.usage
      }
    });
    
  } catch (error) {
    console.error('❌ [LLM-TEST] 调用失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'LLM 调用失败'
    });
  }
});

export default router;
