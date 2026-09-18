/**
 * 🔥 执行轨迹记录
 */
export interface ExecutionTrace {
  sessionId: string;
  toolName: string;
  timestamp: number;
  type: 'info' | 'warning' | 'error' | 'decision' | 'progress';
  message: string;
  data?: any;
}

/**
 * 🔥 执行轨迹存储服务
 * 
 * 职责：
 * 1. 每个 tool 沉淀执行轨迹（类似 log）
 * 2. SummaryHandler 可以按需查询
 * 3. 支持按 sessionId、toolName、type 过滤
 * 
 * 就像每个 tool 有自己的"黑匣子"，记录执行过程
 */
class ExecutionTraceStore {
  private traces: ExecutionTrace[] = [];
  private maxTraces: number = 1000;

  /**
   * 🔥 记录执行轨迹
   */
  addTrace(trace: Omit<ExecutionTrace, 'timestamp'>): void {
    const fullTrace: ExecutionTrace = {
      ...trace,
      timestamp: Date.now(),
    };

    this.traces.push(fullTrace);

    // 🔥 限制最大数量，防止内存溢出
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces);
    }

    console.log(`[TRACE-STORE] 记录轨迹: [${trace.type}] ${trace.toolName}: ${trace.message.substring(0, 50)}`);
  }

  /**
   * 🔥 查询执行轨迹
   */
  queryTraces(filter?: {
    sessionId?: string;
    toolName?: string;
    type?: ExecutionTrace['type'];
    limit?: number;
  }): ExecutionTrace[] {
    let result = [...this.traces];

    if (filter?.sessionId) {
      result = result.filter(t => t.sessionId === filter.sessionId);
    }

    if (filter?.toolName) {
      result = result.filter(t => t.toolName === filter.toolName);
    }

    if (filter?.type) {
      result = result.filter(t => t.type === filter.type);
    }

    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  /**
   * 🔥 获取指定 session 的执行摘要
   */
  getSessionSummary(sessionId: string): string {
    const traces = this.queryTraces({ sessionId });
    
    if (traces.length === 0) {
      return '无执行记录';
    }

    const lines: string[] = [];
    lines.push(`Session ${sessionId.substring(0, 8)} 执行轨迹 (${traces.length} 条):`);

    for (const trace of traces) {
      const time = new Date(trace.timestamp).toLocaleTimeString();
      const typeIcon = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        decision: '🎯',
        progress: '📊',
      }[trace.type];
      
      lines.push(`  ${typeIcon} [${time}] ${trace.toolName}: ${trace.message}`);
    }

    return lines.join('\n');
  }

  /**
   * 🔥 清理指定 session 的轨迹
   */
  clearSession(sessionId: string): void {
    this.traces = this.traces.filter(t => t.sessionId !== sessionId);
    console.log(`[TRACE-STORE] 清理 session ${sessionId} 的轨迹`);
  }

  /**
   * 🔥 清理所有轨迹
   */
  clearAll(): void {
    this.traces = [];
    console.log('[TRACE-STORE] 清理所有轨迹');
  }
}

export const executionTraceStore = new ExecutionTraceStore();

/**
 * 🔥 便捷方法：记录 info 轨迹
 */
export function traceInfo(sessionId: string, toolName: string, message: string, data?: any): void {
  executionTraceStore.addTrace({ sessionId, toolName, type: 'info', message, data });
}

/**
 * 🔥 便捷方法：记录 warning 轨迹
 */
export function traceWarning(sessionId: string, toolName: string, message: string, data?: any): void {
  executionTraceStore.addTrace({ sessionId, toolName, type: 'warning', message, data });
}

/**
 * 🔥 便捷方法：记录 error 轨迹
 */
export function traceError(sessionId: string, toolName: string, message: string, data?: any): void {
  executionTraceStore.addTrace({ sessionId, toolName, type: 'error', message, data });
}

/**
 * 🔥 便捷方法：记录 decision 轨迹（关键决策点）
 */
export function traceDecision(sessionId: string, toolName: string, message: string, data?: any): void {
  executionTraceStore.addTrace({ sessionId, toolName, type: 'decision', message, data });
}

/**
 * 🔥 便捷方法：记录 progress 轨迹
 */
export function traceProgress(sessionId: string, toolName: string, message: string, data?: any): void {
  executionTraceStore.addTrace({ sessionId, toolName, type: 'progress', message, data });
}
