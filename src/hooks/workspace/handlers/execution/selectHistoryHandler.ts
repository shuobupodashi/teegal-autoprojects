

export const createSelectHistoryHandler = (
  workspace: any, 
  loadMessagesForConversation: (conversationId: string, setMessages: any) => Promise<void>
) => {
  return async (historyId: string) => {
    try {
      const selectedConversation = workspace.history.find((item: any) => item.id === historyId);
      if (!selectedConversation) return;
      
      workspace.setActiveHistoryId(historyId);
      workspace.setCurrentConversationId(historyId);
      
      await loadMessagesForConversation(historyId, workspace.setMessages);
      
      try {
        const refreshEvent = new CustomEvent('executionPanelRefresh', {
          detail: { conversationId: historyId }
        });
        window.dispatchEvent(refreshEvent);
      } catch (e) {
        // ignore
      }
    } catch (error) {
      console.error('❌ [SELECT-HISTORY-HANDLER] 选择历史记录失败:', error);
    }
  };
};
