/**
 * WebShell 路由 - 聚合简单搜索、URL读取等功能
 * 路径: /webshell/*
 */
import { Router } from 'express';
import { UrlReaderService } from '../webshell/UrlReaderService';

const router = Router();

const urlReaderService = new UrlReaderService();

/**
 * URL Reader - 处理 URL 内容读取
 * POST /webshell/urlreader
 * 支持分块读取长文档：传入 chunkId 可读取指定分块
 */
router.post('/urlreader', async (req, res) => {
  try {
    const { url, userQuery, userId, conversationId, chunkId } = req.body;

    if (!url || !userId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: url, userId'
      });
    }

    if (chunkId) {
      console.log(`📄 [WEBSHELL-URLREADER] 分块读取: chunkId=${chunkId}`);
    } else {
      console.log('🔗 [WEBSHELL-URLREADER] 开始处理 URL:', url);
    }

    const result = await urlReaderService.processUrl({
      url,
      userQuery,
      userId,
      conversationId,
      chunkId,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    console.log('✅ [WEBSHELL-URLREADER] URL 处理完成:', result.title);
    res.json(result);

  } catch (error) {
    console.error('❌ [WEBSHELL-URLREADER] 处理失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'URL 处理失败'
    });
  }
});

export default router;
