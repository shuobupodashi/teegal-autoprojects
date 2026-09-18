
import { Message } from '@/components/workspace/types/ChatTypes';
import {
  initializeMessagePagination,
  getPaginationStats,
  getCachedLoadedMessages
} from './messagePaginationHandlers';

export const loadMessagesForConversation = async (
  conversationId: string,
  setMessages: (callback: (prev: Message[]) => Message[]) => void,
  setIsProcessing?: (isProcessing: boolean) => void
): Promise<void> => {
  if (!conversationId || conversationId === 'null' || conversationId === 'undefined') {
    setMessages(() => []);
    setIsProcessing?.(false);
    return;
  }

  const existingStats = getPaginationStats(conversationId);
  if (existingStats && existingStats.loadedCount > 0) {
    // 🔥 分页缓存命中：回填缓存消息而不是静默 return。
    // 切换账号/切回历史会话时 messages 已被清空，静默 return 会让界面
    // 因 messages.length === 0 永远停在加载动画（ChatMessages 的 WaveformLoader）
    const cached = getCachedLoadedMessages(conversationId);
    setMessages(() => cached || []);
    setIsProcessing?.(false);
    return;
  }

  try {
    await initializeMessagePagination(conversationId, setMessages, setIsProcessing);
  } catch (error) {
    console.error('❌ [MESSAGE-HANDLERS] 加载消息异常:', error);
    setMessages(() => []);
    setIsProcessing?.(false);
  }
};


