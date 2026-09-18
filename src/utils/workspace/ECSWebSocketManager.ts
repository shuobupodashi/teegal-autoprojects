import { getBackendWsUrl } from '@/config/api';

export class ECSWebSocketManager {
  private ws: WebSocket | null = null;
  private conversationId: string;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: ((data: any) => void)[] = [];
  private isClosingManually = false;

  constructor(conversationId: string) {
    this.conversationId = conversationId;
    this.url = `${getBackendWsUrl()}/ws?conversationId=${conversationId}`;
    console.log('🔌 [ECS-WS] WebSocket URL (local-backend):', this.url);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔌 [ECS-WS] 连接 WebSocket:', this.url);

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('✅ [ECS-WS] WebSocket 连接成功');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('❌ [ECS-WS] WebSocket 连接错误:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('🛑 [ECS-WS] WebSocket 连接关闭:', event.code, event.reason);
          
          if (!this.isClosingManually) {
            this.attemptReconnect();
          } else {
            console.log('✅ [ECS-WS] 主动关闭，不进行重连');
            this.isClosingManually = false;
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 [ECS-WS] 收到消息:', data.type);
            this.messageHandlers.forEach(handler => handler(data));
          } catch (error) {
            console.error('❌ [ECS-WS] 消息解析失败:', error);
          }
        };
      } catch (error) {
        console.error('❌ [ECS-WS] WebSocket 创建失败:', error);
        reject(error);
      }
    });
  }

  onMessage(callback: (data: any) => void): void {
    this.messageHandlers.push(callback);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ [ECS-WS] 达到最大重连次数，放弃重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`🔄 [ECS-WS] ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连...`);

    setTimeout(() => {
      this.connect().catch(err => {
        console.error('❌ [ECS-WS] 重连失败:', err);
      });
    }, delay);
  }

  close(): void {
    if (this.ws) {
      console.log('🛑 [ECS-WS] 主动关闭 WebSocket');
      this.isClosingManually = true;
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
    this.messageHandlers = [];
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
