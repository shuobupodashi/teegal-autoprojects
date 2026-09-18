import { useConversationHistory } from './conversation/useConversationHistory';
import { useConversationCreation } from './conversation/useConversationCreation';

export const useConversationManagement = (userId: string | undefined) => {
  const {
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
    toggleConversationFlag, // 🔥 新增：切换会话标记
    addConversationToHistory // 🔥 新增：增量添加对话
  } = useConversationHistory(userId);
  
  const {
    currentConversationId,
    setCurrentConversationId,
    createConversation,
    insertConversationToDatabase // 🔥 新增：显式插入对话到数据库
  } = useConversationCreation(userId);
  
  // 🔥 已移除：saveMessage、saveConversationMetadata、updateConversationStatus、loadExecutionResult、pauseConversation
  // 这些方法现已由 MessagePersistence、ReactionExecutor 等直接管理

  return {
    // History state
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
    toggleConversationFlag, // 🔥 新增：切换会话标记
    addConversationToHistory, // 🔥 新增：增量添加对话
      
    // Conversation state
    currentConversationId,
    setCurrentConversationId,
    createConversation,
    insertConversationToDatabase // 🔥 新增：显式插入对话到数据库
  };
};