/**
 * 🔥 Headless 分身 HTTP 入口（孙悟空分身：远端 Linux 无界面激活通道）
 *
 * headless 模式（TEEGAL_HEADLESS=1 或 --headless）下启动的 localhost HTTP server：
 *   POST /api/agent/query  { userQuery }   → IPC 转发渲染进程执行编排（受理即回）
 *   GET  /api/agent/ping                   → 健康检查（母体确认分身在线）
 *
 * 默认只绑 127.0.0.1（母体经 SSH 进来 curl 本机端口即可，不暴露公网；
 * 如需直连可用 TEEGAL_AGENT_HOST=0.0.0.0 自行承担风险）。
 * 端口 TEEGAL_AGENT_PORT，默认 7717。
 *
 * 职责边界：只做"激活"，不做执行——执行链完整保留在渲染进程
 * （SummaryHandler 内核 → ReAct → ToolHandler → local-backend），一套代码三形态。
 */

import { ipcMain, type BrowserWindow } from 'electron';

const AGENT_PORT = parseInt(process.env.TEEGAL_AGENT_PORT || '7717', 10);
const AGENT_HOST = process.env.TEEGAL_AGENT_HOST || '127.0.0.1';

/** 渲染进程回包等待超时（渲染进程 10s 内不回视为未就绪/卡死） */
const RENDERER_ACK_TIMEOUT_MS = 10_000;

interface PendingAck {
  resolve: (result: { ok: boolean; error?: string }) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** reqId → 等待中的渲染进程回包 */
const pendingAcks = new Map<string, PendingAck>();
let _reqSeq = 0;

/**
 * 🔥 启动 headless agent HTTP server（仅 headless 模式调用）
 * @param getWindow 取主窗口（渲染进程是执行宿主，窗口未就绪时拒绝请求）
 */
export function startAgentServer(getWindow: () => BrowserWindow | null): void {
  // 接收渲染进程回包（preload 的 agentQueryResult → ipcRenderer.send）
  ipcMain.on('agent:query:result', (_event, payload: { reqId: string; ok: boolean; error?: string }) => {
    const pending = payload?.reqId ? pendingAcks.get(payload.reqId) : undefined;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingAcks.delete(payload.reqId);
    pending.resolve({ ok: payload.ok === true, error: payload.error });
  });

  const server = require('http').createServer(async (req: any, res: any) => {
    const sendJson = (code: number, body: any) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };

    // 健康检查（母体 SSH 进来先 ping 确认分身在线）
    if (req.method === 'GET' && req.url?.startsWith('/api/agent/ping')) {
      return sendJson(200, { ok: true, headless: true, pid: process.pid, uptime: Math.round(process.uptime()) });
    }

    // 激活分身
    if (req.method === 'POST' && req.url?.startsWith('/api/agent/query')) {
      let body = '';
      req.on('data', (c: Buffer) => { body += c; if (body.length > 1024 * 512) req.destroy(); });
      req.on('end', async () => {
        let userQuery = '';
        try {
          userQuery = String(JSON.parse(body || '{}').userQuery || '').trim();
        } catch { /* 非法 JSON 按空处理 */ }
        if (!userQuery) {
          return sendJson(400, { ok: false, error: 'userQuery 不能为空' });
        }

        const win = getWindow();
        if (!win || win.isDestroyed()) {
          return sendJson(503, { ok: false, error: '渲染进程未就绪' });
        }

        // 转发渲染进程执行编排，等待受理回包
        const reqId = `agent-${Date.now()}-${++_reqSeq}`;
        try {
          const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
            const timer = setTimeout(() => {
              pendingAcks.delete(reqId);
              resolve({ ok: false, error: '渲染进程回包超时' });
            }, RENDERER_ACK_TIMEOUT_MS);
            pendingAcks.set(reqId, { resolve, timer });
            win.webContents.send('agent:query', { reqId, userQuery });
          });
          return sendJson(result.ok ? 200 : 500, result.ok
            ? { ok: true, accepted: true, reqId, message: '任务已受理，执行过程在分身内进行（产物经项目文件/GPU任务回流）' }
            : { ok: false, error: result.error });
        } catch (e: any) {
          return sendJson(500, { ok: false, error: e?.message || '转发失败' });
        }
      });
      return;
    }

    sendJson(404, { ok: false, error: 'not found' });
  });

  server.on('error', (e: any) => {
    console.error(`❌ [AGENT-SERVER] 启动失败:`, e?.message);
  });

  server.listen(AGENT_PORT, AGENT_HOST, () => {
    console.log(`✅ [AGENT-SERVER] Headless 分身入口已启动: http://${AGENT_HOST}:${AGENT_PORT}`);
    console.log(`   POST /api/agent/query  { "userQuery": "..." }`);
    console.log(`   GET  /api/agent/ping`);
  });
}
