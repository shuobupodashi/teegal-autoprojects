/**
 * OSS 文件操作路由 - /oss/*
 * 🔥 使用预签名 URL 方式，不再直接使用 AccessKey
 */
import { Router } from 'express';
import { ossCredentialManager } from '../utils/OSSCredentialManager';

const router = Router();

/**
 * 直接上传文件到OSS
 * 🔥 使用预签名 URL
 */
router.post('/upload', async (req, res) => {
  try {
    const { path, contentType, bucket, fileBase64 } = req.body;

    if (!path || !fileBase64) {
      return res.status(400).json({
        success: false,
        error: 'Missing path or file parameter'
      });
    }

    // 🔐 从 home-web 获取预签名 URL
    const { presignedUrl, publicUrl } = await ossCredentialManager.getPresignedUrl(
      path,
      contentType || 'application/octet-stream',
      3600
    );

    console.log('🔐 [OSS-ROUTE] 使用预签名 URL 上传:', {
      path,
      contentType: contentType || 'application/octet-stream'
    });

    // 将base64转换为Buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64');

    // 使用预签名 URL 上传到 OSS
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'application/octet-stream'
      },
      body: fileBuffer
    });

    console.log('🔍 [OSS-ROUTE] 上传响应:', {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText
    });

    if (!uploadResponse.ok) {
      let errorText = '';
      try {
        errorText = await uploadResponse.text();
      } catch (e) {
        errorText = '无法读取错误响应体';
      }

      console.error('❌ [OSS-ROUTE] 上传失败:', {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        errorText
      });

      return res.status(uploadResponse.status).json({
        success: false,
        error: `OSS upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`
      });
    }

    console.log('✅ [OSS-ROUTE] 上传成功:', publicUrl);

    res.json({
      success: true,
      url: publicUrl,
      path: path
    });

  } catch (error) {
    console.error('❌ [OSS-ROUTE] 上传失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    });
  }
});

/**
 * 删除OSS文件
 * 🔥 使用预签名 URL
 */
router.post('/delete', async (req, res) => {
  try {
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Missing path parameter'
      });
    }

    // 🔐 从 home-web 获取预签名 URL（用于删除）
    // 注意：删除操作也需要签名，我们需要一个新的端点来生成删除用的预签名 URL
    // 这里暂时使用环境变量直接删除（因为删除操作较少）

    const config = await ossCredentialManager.getConfig();

    console.log('🔐 [OSS-ROUTE] 删除文件:', {
      path,
      endpoint: config.endpoint
    });

    // 获取 OSS 配置用于删除
    const homeWebUrl = process.env.HOME_WEB_URL || 'https://www.workbees.space';

    // 请求删除用的预签名 URL
    const presignResponse = await fetch(`${homeWebUrl}/api/oss-sts/presign-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectKey: path, expirySeconds: 300 })
    });

    if (!presignResponse.ok) {
      throw new Error('获取删除预签名 URL 失败');
    }

    const { presignedUrl } = await presignResponse.json() as { presignedUrl: string };

    // 使用预签名 URL 删除 OSS 文件
    const deleteResponse = await fetch(presignedUrl, {
      method: 'DELETE'
    });

    if (!deleteResponse.ok) {
      let errorText = '';
      try {
        errorText = await deleteResponse.text();
      } catch (e) {
        errorText = '无法读取错误响应体';
      }

      console.error('❌ [OSS-ROUTE] 删除失败:', {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        errorText
      });

      return res.status(deleteResponse.status).json({
        success: false,
        error: `OSS delete failed: ${deleteResponse.status} ${deleteResponse.statusText} - ${errorText}`
      });
    }

    console.log('✅ [OSS-ROUTE] 删除成功:', path);

    res.json({
      success: true,
      path: path
    });

  } catch (error) {
    console.error('❌ [OSS-ROUTE] 删除失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    });
  }
});

export default router;
