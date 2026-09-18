/**
 * ExecutionLogList - 本地代码执行日志列表
 * 参考 HistoryTaskList 的 UI 风格
 */

import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Terminal, Trash2, ChevronRight } from 'lucide-react';
import { executionLogStorage } from '@/services/storage';

export interface ExecutionLog {
  id: string;
  app_id: string;
  execution_mode: 'python' | 'npm' | 'shell';
  command: string | null;
  work_dir: string | null;
  stdout_output: string | null;
  stderr_output: string | null;
  exit_code: number | null;
  duration: number | null;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  error_message: string | null;
  created_at: number;
  [key: string]: any;
}

export interface ExecutionLogListProps {
  appId: string;
  onSelectLog: (log: ExecutionLog) => void;
  onTotalCountChange?: (count: number) => void;
}

export interface ExecutionLogListRef {
  refresh: () => Promise<ExecutionLog[]>;
  addRunningLog: (logId: string) => void;
}

const LOG_PAGE_SIZE = 5;

const getModeIcon = (mode: string) => {
  switch (mode) {
    case 'python': return '🐍';
    case 'npm': return '📦';
    case 'shell': return '💻';
    default: return '⚡';
  }
};

const getModeLabel = (mode: string) => {
  switch (mode) {
    case 'python': return 'Python';
    case 'npm': return 'NPM';
    case 'shell': return 'Shell';
    default: return mode;
  }
};

const ExecutionLogList = forwardRef<ExecutionLogListRef, ExecutionLogListProps>(({
  appId,
  onSelectLog,
  onTotalCountChange,
}, ref) => {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadLogs = async (reset = true): Promise<ExecutionLog[]> => {
    try {
      setLoading(true);
      const allLogs = await executionLogStorage.getSummaryByAppId(appId);
      const total = allLogs.length;
      onTotalCountChange?.(total);

      const offset = reset ? 0 : logs.length;
      const newLogs = allLogs.slice(offset, offset + LOG_PAGE_SIZE) as ExecutionLog[];

      if (reset) {
        setLogs(newLogs);
      } else {
        setLogs(prev => [...prev, ...newLogs]);
      }

      setHasMore(newLogs.length === LOG_PAGE_SIZE && offset + newLogs.length < allLogs.length);
      return reset ? newLogs : [...logs, ...newLogs];
    } catch (err) {
      console.error('[ExecutionLogList] 加载失败:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLog = async (log: ExecutionLog) => {
    // 🔥 修复：summary 数据没有 stdout_output 属性，需要加载完整数据
    // 只有当 stdout_output 确实存在且有值时才直接使用
    if (log.stdout_output !== undefined && log.stdout_output !== null) {
      onSelectLog(log);
      return;
    }
    // 否则从数据库加载完整数据
    const fullLog = await executionLogStorage.getById(log.id);
    if (fullLog) {
      onSelectLog(fullLog as ExecutionLog);
    } else {
      onSelectLog(log);
    }
  };

  const addRunningLog = (logId: string) => {
    const newLog: ExecutionLog = {
      id: logId,
      app_id: appId,
      execution_mode: 'python',
      command: null,
      work_dir: null,
      stdout_output: null,
      stderr_output: null,
      exit_code: null,
      duration: null,
      status: 'running',
      error_message: null,
      created_at: Date.now(),
    };
    setLogs(prev => [newLog, ...prev]);
  };

  useImperativeHandle(ref, () => ({
    refresh: () => loadLogs(true),
    addRunningLog,
  }));

  useEffect(() => {
    if (appId) {
      loadLogs(true);
    }
  }, [appId]);

  return (
    <div className="h-full overflow-auto bg-white p-4">
      <div className="space-y-3">
        {logs.length === 0 && !loading ? (
          <div className="text-center py-20 text-gray-400">
            <Terminal className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">暂无执行记录</p>
          </div>
        ) : (
          <>
            {logs.map((log) => (
              <div
                key={log.id}
                onClick={() => log.status !== 'running' && handleSelectLog(log)}
                className={`group border rounded-lg p-3 transition-all ${
                  log.status === 'running'
                    ? 'bg-blue-50 border-blue-200 cursor-wait'
                    : 'hover:border-blue-300 hover:shadow-md cursor-pointer bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    log.status === 'success' ? 'bg-green-100 text-green-700' :
                    log.status === 'failed' ? 'bg-red-100 text-red-700' :
                    log.status === 'cancelled' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700 animate-pulse'
                  }`}>
                    {log.status === 'success' ? '✅ 成功' :
                     log.status === 'failed' ? '❌ 失败' :
                     log.status === 'cancelled' ? '⚠️ 已取消' :
                     '⏳ 执行中'}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-700 line-clamp-1 mb-2 flex items-center gap-2">
                  <span>{getModeIcon(log.execution_mode)}</span>
                  <span>{getModeLabel(log.execution_mode)} 执行</span>
                  {log.exit_code !== null && log.exit_code !== 0 && (
                    <span className="text-[10px] text-red-500">exit: {log.exit_code}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                  <span>⏱️ {log.duration ? `${(log.duration / 1000).toFixed(1)}s` : '-'}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {log.status !== 'running' && (
                      <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        查看日志 <ChevronRight className="w-3 h-3" />
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        executionLogStorage.delete(log.id);
                        setLogs(prev => prev.filter(l => l.id !== log.id));
                      }}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                      title="删除记录"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="text-center py-4">
                <button
                  onClick={() => loadLogs(false)}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? '加载中...' : `加载更多 (${logs.length})`}
                </button>
              </div>
            )}

            {!hasMore && logs.length > 0 && (
              <div className="text-center py-3 text-[10px] text-gray-400">
                已加载全部 {logs.length} 条记录
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

ExecutionLogList.displayName = 'ExecutionLogList';

export default ExecutionLogList;
