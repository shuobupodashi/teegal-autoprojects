import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { History, Trash2, Flag, ChevronDown, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { trainingTaskStorage } from '@/services/storage';

// 🔥 训练标记类型定义
export type TrainingFlag = 'best' | 'breakthrough' | 'baseline' | 'experimental' | 'pending_optimization' | 'failed_valuable' | null;

// 🔥 标记选项（用于 UI 展示）
export const FLAG_OPTIONS: { value: TrainingFlag; label: string; icon: string; color: string }[] = [
  { value: 'best', label: '最佳训练', icon: '⭐', color: 'text-yellow-600 bg-yellow-50' },
  { value: 'breakthrough', label: '重要突破', icon: '🚀', color: 'text-purple-600 bg-purple-50' },
  { value: 'baseline', label: '基准模型', icon: '📊', color: 'text-blue-600 bg-blue-50' },
  { value: 'experimental', label: '实验性', icon: '🧪', color: 'text-teal-600 bg-teal-50' },
  { value: 'pending_optimization', label: '待优化', icon: '⚠️', color: 'text-orange-600 bg-orange-50' },
  { value: 'failed_valuable', label: '失败但有价值', icon: '💡', color: 'text-gray-600 bg-gray-50' },
  { value: null, label: '取消标记', icon: '✖️', color: 'text-gray-400' },
];

// 🔥 根据 instance_type 推断 GPU 型号（导出供其他组件使用）
export const getGpuDisplayName = (instanceType?: string): string => {
  if (!instanceType) return 'GPU';
  const t = instanceType.toLowerCase();
  // 阿里云 ecs.gn* 系列
  if (t.includes('gn6i')) return 'NVIDIA T4';
  if (t.includes('gn7i')) return 'NVIDIA A10';
  if (t.includes('gn6v') || t.includes('gn6e')) return 'NVIDIA V100';
  if (t.includes('gn8')) return 'NVIDIA H100';
  if (t.startsWith('ecs.gn7')) return 'NVIDIA A100'; // 阿里云 A100 (ecs.gn7-*)
  // 腾讯云 GN*/GT* 系列
  if (t.includes('gn7')) return 'NVIDIA T4'; // 腾讯云 GN7 = T4
  if (t.includes('gn10x')) return 'NVIDIA V100'; // 腾讯云 GN10X = V100
  if (t.includes('gt4')) return 'NVIDIA A100'; // 腾讯云 GT4 = A100
  return instanceType;
};

// 🔥 训练任务类型定义
export interface TrainingTask {
  id: string;
  app_id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  instance_type?: string;
  duration?: number;
  cost?: number;
  created_at: string;
  files_json?: any;
  remark?: string;
  flag?: TrainingFlag;  // 🔥 新增 flag 字段
  [key: string]: any;
}

export interface HistoryTaskListProps {
  appId: string;
  onSelectTask: (task: TrainingTask | null) => void;
  onTotalCountChange?: (count: number) => void;
  onLatestTaskChange?: (task: TrainingTask | null) => void; // 🔥 用于恢复 GPU 运行状态
}

export interface HistoryTaskListRef {
  refresh: () => Promise<TrainingTask[]>;
  getTasks: () => TrainingTask[];
  addCancelledTask: (reason: string) => void;
}

const HISTORY_PAGE_SIZE = 5; // 每次加载5个

/**
 * 🔥 历史训练任务列表组件
 * 支持分页加载，初始只加载5条，点击"加载更多"追加5条
 */
const HistoryTaskList = forwardRef<HistoryTaskListRef, HistoryTaskListProps>(({
  appId,
  onSelectTask,
  onTotalCountChange,
  onLatestTaskChange,
}, ref) => {
  const { t } = useTranslation();
  
  // 🔥 分页加载状态
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  // 🔥 标记下拉菜单状态
  const [flagDropdownId, setFlagDropdownId] = useState<string | null>(null);
  // 🔥 备注编辑状态
  const [remarkEditId, setRemarkEditId] = useState<string | null>(null);
  const [remarkInput, setRemarkInput] = useState('');

  // 🔥 设置任务标记
  const handleSetFlag = async (taskId: string, flag: TrainingFlag) => {
    try {
      await trainingTaskStorage.update(taskId, { flag });
      // 🔥 更新本地状态
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, flag } : t));
    } catch (error) {
      console.error('[HistoryTaskList] 设置标记失败:', error);
    }
  };

  // 🔥 更新训练备注
  const handleUpdateRemark = async (taskId: string) => {
    const trimmed = remarkInput.trim().slice(0, 200);
    try {
      await trainingTaskStorage.update(taskId, { remark: trimmed });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, remark: trimmed } : t));
      setRemarkEditId(null);
    } catch (error) {
      console.error('[HistoryTaskList] 更新备注失败:', error);
    }
  };

  // 🔥 分页加载历史任务（节约资源）- 已迁移到本地存储
  const loadTasks = async (reset = true, notifyParent = false): Promise<TrainingTask[]> => {
    try {
      setLoading(true);

      // 🔥 使用轻量级查询，不加载 stdout_output/charts_json/files_json 等大字段
      const allAppTasks = await trainingTaskStorage.getSummaryByAppId(appId);
      const total = allAppTasks.length;
      setTotalCount(total);
      onTotalCountChange?.(total);

      const offset = reset ? 0 : tasks.length;
      const newTasks = allAppTasks.slice(offset, offset + HISTORY_PAGE_SIZE) as TrainingTask[];

      let allTasks: TrainingTask[];
      if (reset) {
        allTasks = newTasks;
        setTasks(newTasks);
        if (notifyParent) {
          onLatestTaskChange?.(newTasks[0] || null);
        }
      } else {
        allTasks = [...tasks, ...newTasks];
        setTasks(allTasks);
      }

      setHasMore(newTasks.length === HISTORY_PAGE_SIZE && offset + newTasks.length < total);

      return allTasks;
    } catch (err) {
      console.error('Failed to load history tasks:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };
  
  // 🔥 加载更多历史任务
  const loadMore = () => {
    if (!loading && hasMore) {
      loadTasks(false);
    }
  };

  // 🔥 点击任务时加载完整数据（包含 stdout_output, charts_json, files_json）
  const handleSelectTask = async (task: TrainingTask) => {
    try {
      // 🔥 如果任务已经有 stdout_output，说明是完整数据，直接返回
      if (task.stdout_output) {
        onSelectTask(task);
        return;
      }

      // 🔥 否则从数据库加载完整数据
      console.log(`[HistoryTaskList] 加载任务完整数据: ${task.id}`);
      const fullTask = await trainingTaskStorage.getById(task.id);
      if (fullTask) {
        onSelectTask(fullTask as TrainingTask);
      } else {
        // 如果加载失败，使用当前数据
        onSelectTask(task);
      }
    } catch (error) {
      console.error('[HistoryTaskList] 加载任务完整数据失败:', error);
      onSelectTask(task);
    }
  };

  // 🔥 添加取消任务记录
  const addCancelledTask = (reason: string) => {
    const cancelledTask: TrainingTask = {
      id: crypto.randomUUID(),
      app_id: appId,
      status: 'cancelled',
      created_at: new Date().toISOString(),
      remark: reason,
    };
    setTasks([cancelledTask, ...tasks]);
    setTotalCount(totalCount + 1);
    onTotalCountChange?.(totalCount + 1);
  };
    
  // 🔥 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    refresh: () => loadTasks(true, false),
    getTasks: () => tasks,
    addCancelledTask,
  }));

  useEffect(() => {
    if (appId) {
      loadTasks(true, true);
    }
  }, [appId]);

  return (
    <div className="h-full overflow-auto bg-white p-4">
      <div className="space-y-3">
        {tasks.length === 0 && !loading ? (
          <div className="text-center py-20 text-gray-400">
            <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>{t('workspace.desktopModule.desktopAppViewer.noTrainingHistory')}</p>
          </div>
        ) : (
          <>
            {tasks.map((task) => (
              <div 
                key={task.id}
                onClick={() => handleSelectTask(task)}
                className="group border rounded-lg p-3 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer bg-gray-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    task.status === 'success' ? 'bg-green-100 text-green-700' : 
                    task.status === 'failed' ? 'bg-red-100 text-red-700' : 
                    task.status === 'cancelled' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700 animate-pulse'
                  }`}>
                    {task.status === 'success' ? `✅ ${t('workspace.desktopModule.desktopAppViewer.trainingSuccess')}` : 
                     task.status === 'failed' ? `❌ ${t('workspace.desktopModule.desktopAppViewer.trainingFailed')}` :
                     task.status === 'cancelled' ? `⚠️ 已取消` :
                     `⏳ ${t('workspace.desktopModule.desktopAppViewer.trainingInProgress')}`}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(task.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-700 line-clamp-1 mb-2 flex items-center gap-2">
                  {task.status === 'cancelled' ? task.remark : `${getGpuDisplayName(task.instance_type)} ${t('workspace.desktopModule.desktopAppViewer.trainingTask')}`}
                  {/* 🔥 显示 flag 标记 */}
                  {task.flag && (() => {
                    const flagOption = FLAG_OPTIONS.find(f => f.value === task.flag);
                    return flagOption ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${flagOption.color}`}>
                        {flagOption.icon} {flagOption.label}
                      </span>
                    ) : null;
                  })()}
                  {/* 🔥 显示备注摘要 */}
                  {task.remark && (
                    <span className="text-[10px] text-gray-500 truncate max-w-[120px]" title={task.remark}>
                      📝 {task.remark}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                  <span>⏱️ {Math.ceil((task.duration || 0) / 60)} {t('workspace.desktopModule.gpuTrainingStatus.unitMinute')}</span>
                  <span className="inline-flex items-center gap-0.5 text-green-600 font-bold"><Sparkles className="h-2.5 w-2.5" />{Math.ceil(task.cost || 0)}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {/* 🔥 标记按钮 */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // 🔥 切换下拉菜单显示状态（通过 state 管理）
                          setFlagDropdownId(flagDropdownId === task.id ? null : task.id);
                        }}
                        className={`p-0.5 rounded transition-colors ${
                          task.flag ? 'text-yellow-600 bg-yellow-50' : 'text-gray-400 hover:text-yellow-500 opacity-0 group-hover:opacity-100'
                        }`}
                        title="标记训练"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                      {/* 🔥 下拉菜单 */}
                      {flagDropdownId === task.id && (
                        <>
                        {/* 🔥 透明遮罩：点击外部关闭下拉 */}
                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setFlagDropdownId(null); setRemarkEditId(null); }} />
                        <div
                          className="absolute right-0 top-6 z-50 bg-white border rounded-lg shadow-lg py-1 w-48"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {FLAG_OPTIONS.map(option => (
                            <button
                              key={option.value || 'none'}
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleSetFlag(task.id, option.value);
                                setFlagDropdownId(null);
                              }}
                              className={`w-full px-2 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 ${
                                task.flag === option.value ? 'bg-gray-100 font-medium' : ''
                              }`}
                            >
                              <span>{option.icon}</span>
                              <span>{option.label}</span>
                            </button>
                          ))}
                          {/* 🔥 分隔线 + 备注输入 */}
                          <div className="border-t mt-1 pt-1.5 px-2 pb-1">
                            <textarea
                              value={remarkEditId === task.id ? remarkInput : (task.remark || '')}
                              onChange={(e) => {
                                if (remarkEditId !== task.id) {
                                  setRemarkEditId(task.id);
                                  setRemarkInput(task.remark || '');
                                }
                                setRemarkInput(e.target.value);
                              }}
                              onFocus={() => {
                                setRemarkEditId(task.id);
                                setRemarkInput(task.remark || '');
                              }}
                              placeholder="训练备注（最多200字）..."
                              className="w-full text-xs border rounded p-1 resize-none focus:outline-none focus:border-blue-400"
                              rows={2}
                              maxLength={200}
                            />
                            {remarkEditId === task.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateRemark(task.id);
                                }}
                                className="w-full mt-1 text-xs bg-blue-500 text-white rounded py-0.5 hover:bg-blue-600 transition-colors"
                              >
                                保存备注
                              </button>
                            )}
                          </div>
                        </div>
                        </>
                      )}
                    </div>
                    <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">{t('workspace.desktopModule.desktopAppViewer.viewDetails')} →</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const doDelete = async () => {
                          await trainingTaskStorage.delete(task.id);
                          setTasks(prev => prev.filter(t => t.id !== task.id));
                          setTotalCount(prev => {
                            const next = prev - 1;
                            onTotalCountChange?.(next);
                            return next;
                          });
                        };
                        doDelete();
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
            
            {/* 🔥 加载更多按钮 */}
            {hasMore && (
              <div className="text-center py-4">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                      加载中...
                    </span>
                  ) : (
                    <span>加载更多 ({tasks.length}/{totalCount})</span>
                  )}
                </button>
              </div>
            )}
            
            {/* 🔥 已加载全部提示 */}
            {!hasMore && tasks.length > 0 && (
              <div className="text-center py-3 text-[10px] text-gray-400">
                已加载全部 {tasks.length} 条记录
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

HistoryTaskList.displayName = 'HistoryTaskList';

export default HistoryTaskList;
