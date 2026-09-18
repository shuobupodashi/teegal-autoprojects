
// 🔥 简化：新对话处理器 - 完全重置状态
export const createNewChatHandler = (workspace: any) => {
  return async () => {
    console.log('🆕 [NEW-CHAT-HANDLER-SIMPLIFIED] 创建新对话 - 完全重置版本');
    
    try {
      // 🔥 完全重置所有处理状态
      workspace.setIsProcessing(false);
      workspace.setMessages([]);
      workspace.setCurrentConversationId(null);
      workspace.setPendingAgent?.(null);
      workspace.setHasParameterNotification?.(false);
      workspace.setAgentFormVisible?.(false);


      
      if (workspace.setActiveHistoryId) {
        workspace.setActiveHistoryId(null);
      }
      
      console.log('✅ [NEW-CHAT-HANDLER-SIMPLIFIED] 新对话状态重置完成');
      
      // 刷新历史记录
      if (workspace.fetchConversationHistory) {
        workspace.fetchConversationHistory();
      }
    } catch (error) {
      console.error('❌ [NEW-CHAT-HANDLER-SIMPLIFIED] 新对话处理异常:', error);
    }
  };
};

