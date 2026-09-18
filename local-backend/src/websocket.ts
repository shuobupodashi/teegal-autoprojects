import { Server as WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';

/**
 * WebSocket 管理器 - 管理前端 WebSocket 连接
 */
export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, WebSocket>(); // conversationId -> WebSocket
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * 启动 WebSocket 服务
   */
  start(server: HttpServer) {
    this.wss = new WebSocketServer({ 
      server, 
      path: process.env.WS_PATH || '/ws'
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url!, 'http://localhost');
      const conversationId = url.searchParams.get('conversationId');

      if (!conversationId) {
        console.warn('⚠️ [WEBSOCKET] 连接缺少 conversationId，关闭连接');
        ws.close(1008, 'Missing conversationId parameter');
        return;
      }

      console.log(`✅ [WEBSOCKET] 新连接建立: ${conversationId}`);
      
      // 如果已存在连接，关闭旧连接
      const existingWs = this.connections.get(conversationId);
      if (existingWs && existingWs.readyState === WebSocket.OPEN) {
        console.log(`🔄 [WEBSOCKET] 关闭旧连接，建立新连接: ${conversationId}`);
        existingWs.close(1000, 'New connection established');
      }

      this.connections.set(conversationId, ws);

      // 发送连接确认
      this.send(conversationId, {
        type: 'connected',
        conversationId,
        timestamp: new Date().toISOString(),
        message: 'WebSocket 连接成功'
      });

      // 监听客户端消息（可选，用于心跳响应等）
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`📨 [WEBSOCKET] 收到客户端消息 (${conversationId}):`, message.type);
          
          // 处理心跳
          if (message.type === 'ping') {
            this.send(conversationId, { type: 'pong', timestamp: new Date().toISOString() });
          }
        } catch (error) {
          console.error(`❌ [WEBSOCKET] 消息解析失败 (${conversationId}):`, error);
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`🛑 [WEBSOCKET] 连接关闭: ${conversationId}, code: ${code}, reason: ${reason}`);
        this.connections.delete(conversationId);
      });

      ws.on('error', (error) => {
        console.error(`❌ [WEBSOCKET] 连接错误 (${conversationId}):`, error);
        this.connections.delete(conversationId);
      });

      // 心跳检测
      ws.on('pong', () => {
        // console.log(`💓 [WEBSOCKET] 心跳响应: ${conversationId}`);
      });
    });

    // 启动定期心跳检测
    this.startHeartbeat();

    // 🔥 修复：不再打印 WebSocket 启动日志，因为 server.ts 已经打印了
  }

  /**
   * 🔥 主动推送消息给前端
   */
  send(conversationId: string, data: any): boolean {
    const ws = this.connections.get(conversationId);

    if (!ws) {
      console.warn(`⚠️ [WEBSOCKET] 连接不存在: ${conversationId}`);
      return false;
    }

    if (ws.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ [WEBSOCKET] 连接未就绪: ${conversationId}, state: ${ws.readyState}`);
      return false;
    }

    try {
      const message = JSON.stringify(data);
      ws.send(message);
      return true;
    } catch (error) {
      console.error(`❌ [WEBSOCKET] 发送失败: ${conversationId}`, error);
      return false;
    }
  }

  /**
   * 广播消息给所有连接
   */
  broadcast(data: any): number {
    const message = JSON.stringify(data);
    let successCount = 0;
    let failCount = 0;

    this.connections.forEach((ws, conversationId) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
          successCount++;
        } catch (error) {
          console.error(`❌ [WEBSOCKET] 广播失败: ${conversationId}`, error);
          failCount++;
        }
      }
    });

    console.log(`📡 [WEBSOCKET] 广播完成: 成功 ${successCount}, 失败 ${failCount}`);
    return successCount;
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    const interval = parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10);

    this.heartbeatInterval = setInterval(() => {
      const deadConnections: string[] = [];

      this.connections.forEach((ws, conversationId) => {
        if (ws.readyState === WebSocket.OPEN) {
          // 发送 ping
          try {
            ws.ping();
          } catch (error) {
            console.error(`❌ [WEBSOCKET] Ping 失败: ${conversationId}`, error);
            deadConnections.push(conversationId);
          }
        } else {
          // 连接已断开
          deadConnections.push(conversationId);
        }
      });

      // 清理断开的连接
      deadConnections.forEach(conversationId => {
        console.log(`🧹 [WEBSOCKET] 清理断开连接: ${conversationId}`);
        const ws = this.connections.get(conversationId);
        if (ws) {
          ws.terminate();
        }
        this.connections.delete(conversationId);
      });

      if (deadConnections.length > 0) {
        console.log(`🧹 [WEBSOCKET] 清理了 ${deadConnections.length} 个断开连接`);
      }

    }, interval);

    console.log(`💓 [WEBSOCKET] 心跳检测已启动，间隔: ${interval}ms`);
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('🛑 [WEBSOCKET] 心跳检测已停止');
    }
  }

  /**
   * 获取连接数
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * 获取所有连接的 conversationId
   */
  getConnectedConversations(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * 检查连接是否存在
   */
  hasConnection(conversationId: string): boolean {
    const ws = this.connections.get(conversationId);
    return ws !== undefined && ws.readyState === WebSocket.OPEN;
  }

  /**
   * 关闭指定连接
   */
  closeConnection(conversationId: string, code = 1000, reason = 'Normal closure'): void {
    const ws = this.connections.get(conversationId);
    if (ws) {
      console.log(`🛑 [WEBSOCKET] 主动关闭连接: ${conversationId}`);
      ws.close(code, reason);
      this.connections.delete(conversationId);
    }
  }

  /**
   * 关闭所有连接
   */
  closeAll(): void {
    console.log(`🛑 [WEBSOCKET] 关闭所有连接 (共 ${this.connections.size} 个)`);
    
    this.connections.forEach((ws, conversationId) => {
      try {
        ws.close(1001, 'Server shutting down');
      } catch (error) {
        console.error(`❌ [WEBSOCKET] 关闭连接失败: ${conversationId}`, error);
      }
    });
    
    this.connections.clear();
    this.stopHeartbeat();
    
    if (this.wss) {
      this.wss.close(() => {
        console.log('✅ [WEBSOCKET] WebSocket Server 已关闭');
      });
    }
  }
}

// 导出单例
export const wsManager = new WebSocketManager();
