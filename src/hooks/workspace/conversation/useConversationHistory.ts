import { useState, useEffect, useRef, useCallback } from 'react';

import { WorkHistory } from '@/components/workspace/HistoryPanel';
import { conversationStorage } from '@/services/storage';

export const useConversationHistory = (userId: string | undefined) => {
  const [history, setHistory] = useState<WorkHistory[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [sortByExecutionCount, setSortByExecutionCount] = useState<boolean>(false);

  // 分页相关状态
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10; // 每页加载10条

  // 🔥 防重复调用：记录上次加载的 userId
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // 🔥 使用 ref 追踪 history 长度，避免闭包问题
  const historyLengthRef = useRef(0);
  useEffect(() => {
    historyLengthRef.current = history.length;
  }, [history]);

  // 🔥 使用 ref 存储 userId，确保 fetchConversationHistory 始终使用最新值
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // 🔥 使用 ref 存储 page，确保 fetchConversationHistory 始终使用最新值
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // Fetch user's conversation history with pagination and file counts
  // 🔥 移除 useCallback 的依赖，使用 ref 获取最新值
  const fetchConversationHistory = useCallback(async (reset: boolean = false) => {
    const currentUserId = userIdRef.current;
    
    if (!currentUserId) return;

    // 🔥 防重复：如果正在加载，跳过
    if (isFetchingRef.current && reset) {
      return;
    }
    // 🔥 防重复：如果是 reset 请求且已加载过相同用户，跳过
    if (reset && lastFetchedUserIdRef.current === currentUserId && historyLengthRef.current > 0) {
      return;
    }

    isFetchingRef.current = true;

    try {
      const currentPage = reset ? 1 : pageRef.current;

      // Calculate offset for pagination
      const offset = (currentPage - 1) * pageSize;

      // Get conversations from the conversations table with pagination
      // 🔥 使用统一的存储服务获取对话列表（仅支持本地模式）

      let data: any[] = [];
      try {
        data = await conversationStorage.getByUserId(currentUserId, pageSize, offset);
      } catch (error) {
        console.error('Error fetching conversation history:', error);
        return;
      }

      let broadcastMap: Record<string, boolean> = {};

      if (data) {
        lastFetchedUserIdRef.current = currentUserId;

        let filesCounts: Record<string, number> = {};

        // Format the data for display - 🔥 简化状态映射逻辑
        const formattedHistory = data.map((item) => {
          let displayTitle = item.title;
          if (!displayTitle || displayTitle === 'New Conversation') {
            displayTitle = 'Unnamed Conversation';
          }

          // 🔥 任务持久化核心：简化状态逻辑，直接使用 conversations.status
          // 只有两种状态：'active' (正在执行) 和 'idle' (空闲)
          let displayStatus: "completed" | "failed" | "in_progress" | "paused" = 'completed';

          if (item.status === 'active') {
            displayStatus = 'in_progress'; // 正在执行任务
          } else {
            displayStatus = 'completed'; // 空闲状态，可执行新任务
          }

          return {
            id: item.id,
            title: displayTitle,
            status: displayStatus,
            created_at: item.created_at,
            filesCount: filesCounts[item.id] || 0, // 🔥 已简化
            hasBroadcast: broadcastMap[item.id] || false, // 🔥 已简化
            isFlagged: item.is_flagged || false, // 🔥 新增：是否被标记为重要
            flaggedAt: item.flagged_at || undefined, // 🔥 新增：置顶时间
            isBroadcast: item.is_broadcast || false // 🔥 新增：数据库中的broadcast标记
          };
        });

        // Update history based on whether this is a reset or load more
        if (reset) {
          setHistory(formattedHistory);
          setPage(2); // Next page would be 2
        } else {
          setHistory(prev => [...prev, ...formattedHistory]);
          setPage(prev => prev + 1);
        }

        // Check if there are more records
        setHasMore(data.length === pageSize);
      }
    } catch (error) {
      console.error('[HISTORY] 加载历史记录失败:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [pageSize]); // 🔥 移除 userId 和 page 依赖，使用 ref 获取最新值

  // 🔥 使用 ref 存储 fetchConversationHistory，确保 useEffect 始终调用最新函数
  const fetchConversationHistoryRef = useRef(fetchConversationHistory);
  useEffect(() => {
    fetchConversationHistoryRef.current = fetchConversationHistory;
  }, [fetchConversationHistory]);

  // 🔥 监听userId变化，自动加载历史记录（防重复）
  // 🔥 用户身份变更（切换账号/登出）时立即清空上一用户的历史，避免残留或闪现旧数据
  useEffect(() => {
    if (!userId || userId === 'undefined') {
      // 登出：重置全部历史状态
      hasInitializedRef.current = false;
      lastFetchedUserIdRef.current = null;
      isFetchingRef.current = false;
      setHistory([]);
      historyLengthRef.current = 0;
      setPage(1);
      setHasMore(true);
      setActiveHistoryId(null); // 🔥 清空选中会话，避免新用户界面残留旧用户会话
      return;
    }
    if (lastFetchedUserIdRef.current !== userId) {
      // 切换用户：先清空旧用户历史再拉新数据
      hasInitializedRef.current = true;
      setHistory([]);
      historyLengthRef.current = 0;
      setPage(1);
      setHasMore(true);
      setActiveHistoryId(null); // 🔥 清空旧用户选中的会话，让 useWorkspace 自动选中重新执行
      fetchConversationHistoryRef.current(true);
    }
  }, [userId]); // 🔥 只依赖 userId，使用 ref 调用最新函数

  // 🔥 后端冷启动兜底：本地缓存恢复登录比后端启动快，首次加载可能撞上后端未就绪
  //（waitForBackend 只等 15s，冷启动偶尔更久），且一次性初始化失败后 userId 不变、不会再触发
  // ——表现为"模型能加载（ModelManager 自轮询 health）但聊天历史空白"。
  // 这里每 5s 重试直到成功；成功标志 lastFetchedUserIdRef === userId（含"成功但历史为空"的新用户）
  useEffect(() => {
    if (!userId || userId === 'undefined') return;
    if (lastFetchedUserIdRef.current === userId) return;
    const timer = setInterval(() => {
      if (lastFetchedUserIdRef.current === userId) return;
      hasInitializedRef.current = false; // 允许重新初始化
      fetchConversationHistoryRef.current(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [userId, history.length]);

  // Load more history (for pagination)
  const loadMoreHistory = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    await fetchConversationHistoryRef.current(false);
    setIsLoadingMore(false);
  };

  // Toggle history sort method
  const toggleSortByExecutionCount = () => {
    setSortByExecutionCount(prev => !prev);
    // Reset pagination and re-fetch with new sort order
    setPage(1);
    setHasMore(true);
    fetchConversationHistoryRef.current(true);
  };

  // Reset and refresh history (useful for pull-to-refresh)
  const refreshHistory = async () => {
    setPage(1);
    setHasMore(true);
    await fetchConversationHistoryRef.current(true);
  };

  // 🔥 新增：增量添加单个对话到历史记录顶部（新建对话时调用）
  const addConversationToHistory = useCallback((conversationId: string, title: string) => {
    try {
      const newConversation: WorkHistory = {
        id: conversationId,
        title: title || 'New Conversation',
        status: 'completed',
        created_at: new Date().toISOString(),
        filesCount: 0,
        hasBroadcast: false,
        isFlagged: false,
        isBroadcast: false
      };

      setHistory(prev => {
        // 检查是否已存在
        const exists = prev.some(h => h.id === conversationId);
        if (exists) {
          return prev;
        }
        // 添加到顶部
        return [newConversation, ...prev];
      });
    } catch (error) {
      console.error('Error adding conversation to history:', error);
    }
  }, []);

  // 🔥 新增：切换会话标记状态
  const toggleConversationFlag = useCallback((conversationId: string) => {
    setHistory(prev => prev.map(item => {
      if (item.id === conversationId) {
        const newFlagged = !item.isFlagged;
        return {
          ...item,
          isFlagged: newFlagged,
          flaggedAt: newFlagged ? new Date().toISOString() : undefined
        };
      }
      return item;
    }));
  }, []);

  return {
    history,
    setHistory,
    activeHistoryId,
    setActiveHistoryId,
    sortByExecutionCount,
    toggleSortByExecutionCount,
    fetchConversationHistory,
    loadMoreHistory,
    refreshHistory,
    isLoadingMore,
    hasMore,
    toggleConversationFlag,
    addConversationToHistory
  };
};
