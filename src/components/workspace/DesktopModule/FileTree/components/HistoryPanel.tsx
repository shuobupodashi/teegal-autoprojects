/**
 * 版本历史面板
 * 
 * 🔥 简化架构：
 * - 每个文件只保留一个历史版本（上一个 commit）
 * - Commit 功能已移至 DiffViewer 的"接受"按钮
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { FileHistory } from '../types';
import { getHistoryContent } from '../utils';

interface HistoryPanelProps {
  appId: string;
  history: FileHistory[];
  onRefresh: () => void;
  onViewHistory?: (fileName: string, content: string) => void;
}

export function HistoryPanel({ appId, history, onRefresh, onViewHistory }: HistoryPanelProps) {
  const handleViewHistory = async (fileName: string) => {
    if (!onViewHistory) return;
    
    const content = await getHistoryContent(appId, fileName);
    if (content) {
      onViewHistory(fileName, content);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-2 pl-1">
        <span className="text-xs font-medium text-gray-600">版本历史</span>
      </div>

      {/* 历史版本列表 */}
      {history.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-2 pl-1">
          暂无版本历史
          <br />
          <span className="text-gray-300">在对比视图中点击"接受"创建版本快照</span>
        </div>
      ) : (
        <div className="space-y-0.5">
          {history.map((fileHistory) => (
            <div
              key={fileHistory.fileName}
              className="flex items-center gap-1 py-1 px-1 rounded hover:bg-gray-100 cursor-pointer"
              onClick={() => handleViewHistory(fileHistory.fileName)}
              title="点击查看历史版本"
            >
              <FileText className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-700 flex-1 truncate">{fileHistory.fileName}</span>
              <span className="text-xs text-gray-400">{fileHistory.version.versionName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
