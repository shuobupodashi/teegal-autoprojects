
import { useAuth } from '@/context/AuthContext';
import { useConversationManagement } from './useConversationManagement';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Message } from '@/components/workspace/types/ChatTypes';
import { loadMessagesForConversation } from './handlers/messageHandlers';

/**
 * 🔥 优化版本的主工作空间Hook - 统一Auto模式
 */
export const useWorkspace = () => {
  const authContext = useAuth();
  
  // 🔥 SummaryHandler状态管理
  const [summaryHandler, setSummaryHandler] = useState<any>(null);
  
  // 🔥 核心修复：真实的消息状态容器 - 取代已删除的useMessageManagement
  const [messages, setMessages] = useState<Message[]>([]);
  
  // 🔥 核心修复：真实的 isProcessing 状态管理 - 用于控制发送按钮状态
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 🔥 简化：直接使用 authContext 的值，避免多余的 memo
  const userId = authContext.user?.id;

  // 🔥 简化Hook初始化 - 让各个Hook自己管理数据获取时机
  const conversationManagement = useConversationManagement(userId);

  // 🔥 新增：首次加载时，如果 activeHistoryId 为 null，自动选中最近更新的 conversation
  // 使用 ref 确保只执行一次（用户登录时），后续 activeHistoryId 变化（如新对话清零）不再触发
  // 这个逻辑移到 useWorkspace 中，确保即使 HistoryPanel 收起也能正常执行
  const autoSelectExecuted = useRef(false);
  
  // 🔥 核心修复：监听 userId 变化，重置自动选择状态
  // 当用户登录（userId 从 undefined 变为实际值）时，需要重新执行自动选择
  const prevUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    // 🔥 userId 变化时重置自动选择状态，并立即清空上一用户的聊天界面
    if (userId !== prevUserIdRef.current) {
      prevUserIdRef.current = userId;
      autoSelectExecuted.current = false;
      // 🔥 多账号隔离：清空旧用户的消息/处理状态/当前会话，避免切换账号后界面残留
      setMessages([]);
      setIsProcessing(false);
      conversationManagement.setCurrentConversationId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  
  useEffect(() => {
    const { history, activeHistoryId, setActiveHistoryId, setCurrentConversationId } = conversationManagement;
    // 🔥 修复：确保 history 已加载且有数据，且没有 activeHistoryId，且未执行过自动选择
    if (history && history.length > 0 && !activeHistoryId && !autoSelectExecuted.current) {
      autoSelectExecuted.current = true;
      // 🔥 history 已按 updated_at DESC 排序，第一个就是最近更新的对话
      const mostRecentHistoryId = history[0].id;
      setActiveHistoryId(mostRecentHistoryId);
      setCurrentConversationId(mostRecentHistoryId);
      // 🔥 同时加载该对话的消息
      loadMessagesForConversation(mostRecentHistoryId, setMessages, setIsProcessing);
    }
  }, [userId, conversationManagement.history, conversationManagement.activeHistoryId, conversationManagement.setActiveHistoryId, conversationManagement.setCurrentConversationId, setMessages, setIsProcessing]);

  // 🔥 缓存工作空间统计信息
  const workspaceStats = useMemo(() => {
    return {
      historyCount: conversationManagement.history?.length || 0,
      hasMoreHistory: conversationManagement.hasMore,
      isLoadingMoreHistory: conversationManagement.isLoadingMore
    };
  }, [
    conversationManagement.history?.length,
    conversationManagement.hasMore,
    conversationManagement.isLoadingMore
  ]);

  // 移除重复的日志，仅在调试时启用
  // console.log('📋 [WORKSPACE-HOOK] 关键状态:', { currentConversationId: conversationManagement.currentConversationId, ...workspaceStats });

  // 🔥 使用useMemo缓存workspace数据对象，避免每次渲染都创建新对象
  const workspaceData = useMemo(() => ({
    // Auth context - 🔥 关键修复：确保用户信息正确传递
    user: authContext.user,
    userId: authContext.user?.id, // 🔥 直接使用 authContext
    userEmail: authContext.user?.email, // 🔥 直接使用 authContext
    session: authContext.session,
    isAuthenticated: authContext.isAuthenticated,
    authLoading: authContext.isLoading, // 🔥 新增：认证加载状态
    
    // Messages state - 🔥 由真实的React state管理
    messages: messages,
    setMessages: setMessages,
    
    // Execution state - 🔥 isProcessing 由真实的 React state 管理
    isProcessing: isProcessing,
    setIsProcessing: setIsProcessing,
    
    // History state
    history: conversationManagement.history,
    setHistory: conversationManagement.setHistory,
    activeHistoryId: conversationManagement.activeHistoryId,
    setActiveHistoryId: conversationManagement.setActiveHistoryId,
    sortByExecutionCount: conversationManagement.sortByExecutionCount,
    toggleSortByExecutionCount: conversationManagement.toggleSortByExecutionCount,
    
    // 懒加载相关属性
    loadMoreHistory: conversationManagement.loadMoreHistory,
    refreshHistory: conversationManagement.refreshHistory,
    isLoadingMore: conversationManagement.isLoadingMore,
    hasMore: conversationManagement.hasMore,
    toggleConversationFlag: conversationManagement.toggleConversationFlag, // 🔥 新增：切换会话标记
    addConversationToHistory: conversationManagement.addConversationToHistory, // 🔥 新增：增量添加对话
    
    // Conversation state
    currentConversationId: conversationManagement.currentConversationId,
    setCurrentConversationId: conversationManagement.setCurrentConversationId,
    
    // 🔥 SummaryHandler状态
    summaryHandler: summaryHandler,
    setSummaryHandler: setSummaryHandler,
    
    // Functions - 🔥 移除fetchAgents
    fetchConversationHistory: conversationManagement.fetchConversationHistory,
    createConversation: conversationManagement.createConversation,
    insertConversationToDatabase: conversationManagement.insertConversationToDatabase // 🔥 新增：显式插入对话到数据库
  }), [
    // 🔥 优化依赖数组，只包含真正变化的值
    authContext.user,
    authContext.isAuthenticated,
    authContext.session,
    authContext.isLoading,


    conversationManagement.history,
    conversationManagement.setHistory,
    conversationManagement.activeHistoryId,
    conversationManagement.setActiveHistoryId,
    conversationManagement.sortByExecutionCount,
    conversationManagement.toggleSortByExecutionCount,
    conversationManagement.loadMoreHistory,
    conversationManagement.refreshHistory,
    conversationManagement.isLoadingMore,
    conversationManagement.hasMore,
    conversationManagement.toggleConversationFlag, // 🔥 新增：切换会话标记
    conversationManagement.addConversationToHistory, // 🔥 新增：增量添加对话
    conversationManagement.currentConversationId,
    conversationManagement.setCurrentConversationId,
    conversationManagement.fetchConversationHistory,
    conversationManagement.createConversation,
    conversationManagement.insertConversationToDatabase,
    // 🔥 SummaryHandler依赖
    summaryHandler,
    setSummaryHandler,
    // 🔥 Messages状态依赖
    messages,
    setMessages,
    // 🔥 isProcessing状态依赖
    isProcessing,
    setIsProcessing
  ]);

  return workspaceData;
};
