import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowUpDown,
  Clock,
  RefreshCw,
  Loader2,
  Folders,
  Radio,
  FileText,
  Bike,
  MessageCircle,
  Flag,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale/zh-CN";
import { enUS } from "date-fns/locale/en-US";
import { useTranslation } from "react-i18next";

export interface WorkHistory {
  id: string;
  title: string;
  created_at: string;
  status: string;
  filesCount?: number;
  hasParameters?: boolean;
  hasBroadcast?: boolean;
  taskStatus?: string;
  estimatedCompletionTime?: string;
  pollingCount?: number;
  isFlagged?: boolean; // 🔥 新增：是否被标记为重要
  flaggedAt?: string; // 🔥 新增：置顶时间
  isBroadcast?: boolean; // 🔥 新增：数据库中的broadcast标记（来自conversations.is_broadcast）
}

interface HistoryPanelProps {
  history: WorkHistory[];
  activeHistoryId: string | null;
  sortByExecutionCount: boolean;
  onSelectHistory: (historyId: string) => void;
  onToggleSortOrder: () => void;
  onNewChat?: () => void; // 🔥 新增：新对话回调
  onToggleFlag?: (conversationId: string) => void; // 🔥 新增：标记位置会话回调
  // 新增的懒加载相关 props
  onLoadMore?: () => void;
  onRefresh?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  backgroundLoading?: boolean;
}

const HistoryPanel = ({
  history,
  activeHistoryId,
  sortByExecutionCount,
  onSelectHistory,
  onToggleSortOrder,
  onNewChat,
  onToggleFlag,
  onLoadMore,
  onRefresh,
  isLoadingMore = false,
  hasMore = true,
  backgroundLoading = false,
}: HistoryPanelProps) => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith('zh') ? zhCN : enUS;

  return (
    <div className="h-full max-h-full flex flex-col bg-white border rounded-lg overflow-hidden">
      {/* 🔥 保持：固定标题区域 */}
      <div className="flex items-center justify-center px-4 py-2 border-b bg-white flex-shrink-0 h-12">
        <h2 className="font-medium">{t('workspace.historyPanel.title')}</h2>
      </div>

      {/* 🔥 保持：强化滚动区域，明确高度约束 */}
      <div className="flex-1 min-h-0 max-h-[calc(100%-60px)] overflow-hidden">
        <ScrollArea className="h-full w-full">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              {" "}
              {/* 父容器设置垂直水平居中 */}
              <div className="flex items-center justify-center text-gray-500">
                <Bike className="w-8 h-8 mb-2" />
                <p className="text-xs">...</p>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {/* 🔥 新增：新对话按钮，放在哲史记录第一个 */}
              {onNewChat && (
                <div
                  onClick={onNewChat}
                  className="p-3 rounded-lg border border-dashed border-blue-300 cursor-pointer transition-all duration-200 hover:bg-blue-50 flex items-center justify-center gap-2 bg-blue-50/30"
                >
                  <MessageCircle size={16} className="text-blue-500" />
                  <span className="text-sm font-medium text-blue-600">{t('workspace.chatHeader.newChat')}</span>
                </div>
              )}

              {/* 残余的对话记录 */}
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectHistory(item.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    activeHistoryId === item.id
                      ? "bg-[#F7F4ED] border-blue-300 shadow-sm ring-1 ring-blue-200"
                      : item.status === "active"
                        ? "bg-blue-50/50 border-blue-200 hover:bg-blue-50 animate-pulse"
                        : "hover:bg-gray-50 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900 mb-2 truncate">
                    {item.title}
                    {item.status === "active" && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full animate-pulse">
                        {t('workspace.historyPanel.execution')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: dateLocale })}
                    </span>
                    <div className="flex items-center gap-1 relative">
                        {/* 🔥 旗帜图标（hover 悬停触发悬浮卡片） */}
                        {onToggleFlag && (
                          <div className="group relative">
                            {/* 旗帜图标 - hover 时显示卡片 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // 阻止事件冒泡
                              }}
                              className="transition-colors duration-200 hover:text-orange-500 p-1"
                              title={item.isFlagged ? t('workspace.historyPanel.unmarkImportant') : t('workspace.historyPanel.markImportant')}
                            >
                              <Flag
                                className={`w-3 h-3 ${
                                  item.isFlagged ? 'text-orange-500 fill-orange-500' : 'text-gray-400'
                                }`}
                              />
                            </button>

                            {/* 🔥 悬浮卡片：hover group-hover 自动显示 */}
                            <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-max opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                              {/* 不可见的桥接区域，连接按钮和卡片 */}
                              <div className="h-1 w-full"></div>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // 阻止事件冒泡
                                  console.log('🖱️ [HISTORY-PANEL] 旗帜图标点击:', {
                                    conversationId: item.id,
                                    currentFlagged: item.isFlagged,
                                    onToggleFlagExists: !!onToggleFlag
                                  });
                                  onToggleFlag(item.id);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-gray-100 rounded transition-colors"
                              >
                                <Flag className={`w-3 h-3 ${item.isFlagged ? 'text-orange-500 fill-orange-500' : 'text-gray-400'}`} />
                                <span className="text-gray-700">
                                  {item.isFlagged ? t('workspace.historyPanel.unmarkImportant') : t('workspace.historyPanel.markImportant')}
                                </span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Broadcast图标 */}
                        {item.hasBroadcast && (
                          <span title={t('workspace.historyPanel.broadcast') || '已配置广播'}>
                            <Radio className="w-3 h-3 text-green-500" />
                          </span>
                        )}

                        {/* 文件图标 */}
                        {(item.status === "completed" || item.status === "idle") && (
                          <span
                            title={item.filesCount && item.filesCount > 0 ? t('workspace.historyPanel.files', { count: item.filesCount }) : t('workspace.historyPanel.noFiles')}
                          >
                            <Folders
                              className={`w-3 h-3 ${item.filesCount && item.filesCount > 0 ? "text-yellow-500" : "text-gray-400"}`}
                            />
                          </span>
                        )}

                      </div>
                  </div>
                </div>
              ))}

              {/* 🔥 新增：懒加载控制区域 */}
              {onLoadMore && hasMore && (
                <div className="p-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                    className="text-xs w-full"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        {t('workspace.historyPanel.loadingMore')}
                      </>
                    ) : (
                      t('workspace.historyPanel.loadMore')
                    )}
                  </Button>
                </div>
              )}

              {/* 显示已加载完成的状态 */}
              {!hasMore && history.length > 0 && (
                <div className="p-2 text-center text-xs text-gray-400">{t('workspace.historyPanel.noMoreHistory')}</div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default HistoryPanel;
