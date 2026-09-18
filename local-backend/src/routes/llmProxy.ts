import { Router, Request } from 'express';
import { userModelRegistry } from '../utils/llm/UserModelRegistry';
import { modelBindingRegistry } from '../utils/llm/ModelBindingRegistry';
import { isCloudProxyUrl, refreshPackageToken } from '../utils/llm/CloudTokenRefresher';

const router = Router();

function getUserId(req: Request): string | undefined {
  return req.query.userId as string || req.headers['x-user-id'] as string || undefined;
}

router.post('/call', async (req, res) => {
  try {
    const { modelId, purpose, requestBody, stream, userId: bodyUserId } = req.body;
    const userId = bodyUserId || getUserId(req);

    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    if (!requestBody) {
      return res.status(400).json({ success: false, error: 'Missing requestBody' });
    }

    let resolvedModelId = modelId;

    if (!resolvedModelId && purpose) {
      const boundModelId = modelBindingRegistry.getBinding(purpose, userId);
      if (boundModelId) {
        resolvedModelId = boundModelId;
        console.log(`[LLM-PROXY] purpose "${purpose}" -> bound modelId "${boundModelId}"`);
      }
    }

    if (!resolvedModelId) {
      return res.status(400).json({ success: false, error: 'Missing modelId or purpose' });
    }

    const model = userModelRegistry.getUserModelById(resolvedModelId, userId);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: `Model not found: ${resolvedModelId}`,
      });
    }

    if (!model.url || !model.apiKey) {
      return res.status(400).json({
        success: false,
        error: `Model ${model.name} missing url or apiKey`,
      });
    }

    const finalBody = {
      ...requestBody,
      model: model.modelId,
    };

    // 🔥 套餐模型 401 自愈：JWT 快照过期 → refreshToken 换新 → 更新快照 → 重试一次
    const doFetch = (apiKey: string) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-DashScope-SSE': stream ? 'enable' : 'disable',
      };
      if (model.provider !== 'ollama') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      return fetch(model.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(finalBody),
      });
    };

    let response = await doFetch(model.apiKey);
    if (response.status === 401 && model.refreshToken && isCloudProxyUrl(model.url)) {
      console.log('[LLM-PROXY] 套餐模型 401，尝试自动续期 JWT...');
      userModelRegistry.setCurrentUser(userId);
      const tokens = await refreshPackageToken({ url: model.url, refreshToken: model.refreshToken });
      if (tokens) {
        model.apiKey = tokens.accessToken;
        model.refreshToken = tokens.refreshToken || model.refreshToken;
        response = await doFetch(model.apiKey);
        console.log('[LLM-PROXY] 续期后重试，状态:', response.status);
      }
    }

    console.log('[LLM-PROXY] request body preview:', JSON.stringify(finalBody).substring(0, 500));

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        if (!response.ok) {
          const errorText = await response.text();
          res.write(`data: ${JSON.stringify({ error: `LLM request failed: ${response.status}`, detail: errorText })}\n\n`);
          res.end();
          return;
        }

        if (!response.body) {
          res.write(`data: ${JSON.stringify({ error: 'No response body' })}\n\n`);
          res.end();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);
          }
        } finally {
          reader.releaseLock();
        }

        res.end();
      } catch (streamError) {
        console.error('[LLM-PROXY] Stream error:', streamError);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Stream failed' });
        } else {
          res.end();
        }
      }

      return;
    }

    console.log('[LLM-PROXY] 发送请求到:', model.url);

    console.log('[LLM-PROXY] 收到响应，状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [LLM-PROXY] API error: ${response.status}`, errorText.substring(0, 300));
      return res.status(response.status).json({
        success: false,
        error: errorText,
      });
    }

    const data: any = await response.json();
    console.log('[LLM-PROXY] 响应数据:', JSON.stringify(data).substring(0, 500));

    let content = '';
    let usage = undefined;

    if (data.output?.choices?.[0]?.message?.content) {
      const msgContent = data.output.choices[0].message.content;
      if (Array.isArray(msgContent)) {
        content = msgContent.map((c: any) => c.text || '').join('');
      } else {
        content = String(msgContent);
      }
      usage = data.usage;
    } else if (data.choices?.[0]?.message?.content) {
      content = data.choices[0].message.content;
      usage = data.usage;
    } else if (data.output?.text) {
      content = data.output.text;
      usage = data.usage;
    } else {
      content = JSON.stringify(data);
    }

    res.json({
      success: true,
      content,
      usage,
      model: model.modelId,
    });

  } catch (error) {
    console.error('[LLM-PROXY] Call failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/models', async (req, res) => {
  try {
    const userId = getUserId(req) || req.body.userId;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const models = userModelRegistry.getAllUserModels(userId);

    res.json({
      success: true,
      models: models.map(m => ({
        id: m.id,
        name: m.name,
        modelId: m.modelId,
        provider: m.provider,
        requestFormat: m.requestFormat,
      })),
    });

  } catch (error) {
    console.error('[LLM-PROXY] List models failed:', error);
    res.status(500).json({ success: false, error: 'Failed to list models' });
  }
});

export default router;
