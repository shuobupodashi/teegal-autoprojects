/**
 * Simple Search 路由 - /simplesearch
 */
import { Router } from 'express';
import { SimpleSearchService } from '../webshell/SimpleSearchService';

const router = Router();
const simpleSearchService = new SimpleSearchService();

/**
 * Simple Search 服务
 * POST /simplesearch
 */
router.post('/', async (req, res) => {
  try {
    const request = req.body;

    // 参数验证
    if (!request.query) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: query'
      });
    }

    console.log('🔍 [SIMPLE-SEARCH] 接收 Simple Search 请求:', {
      query: request.query,
      maxResults: request.maxResults,
      userId: request.userId,
    });

    // 调用 Simple Search 服务
    const result = await simpleSearchService.search(request);

    if (!result.success) {
      return res.status(500).json(result);
    }

    console.log('✅ [SIMPLE-SEARCH] Simple Search 处理完成');

    res.json(result);

  } catch (error) {
    console.error('❌ [SIMPLE-SEARCH] Simple Search 处理失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Simple Search 服务异常'
    });
  }
});

export default router;
