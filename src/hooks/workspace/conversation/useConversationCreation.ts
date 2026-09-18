import { useState } from 'react';

import { generateTitle } from '../utils/titleUtils';
import { conversationStorage, storageMode } from '@/services/storage';

// 🔥 生成标准UUID格式的conversationId
const generateClientConversationId = (): string => {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    // 回退方案：生成符合UUID v4格式的ID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

export const useConversationCreation = (userId: string | undefined) => {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  // 🔥 新增：后台异步插入数据库，不阻塞主流程
  const insertConversationToDatabase = async (
    conversationId: string,
    title: string,
    userId: string
  ) => {
    try {
      const conversationData = {
        id: conversationId,
        title,
        user_id: userId,
        status: 'idle',
        execution_count: 0,
        result: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // 🔥 使用统一的存储服务（支持本地/在线双模式）
      await conversationStorage.create(conversationData);
      
    } catch (error) {
      console.error('❌ [DB-INSERT] 插入会话异常:', error);
    }
  };
  
  // 🔥 修改：立即返回conversationId，数据库插入由调用者显式执行
  const createConversation = (titleOrContent?: string): string | null => {
    if (!userId) return null;
    
    try {
      // 🔥 立即生成标准UUID并返回
      const generatedId = generateClientConversationId();
      const title = titleOrContent ? generateTitle(titleOrContent) : '新对话';
      
      
      setCurrentConversationId(generatedId);
      
      // 🔥 不再自动插入数据库，由调用者显式调用 insertConversationToDatabase
      // 这样可以避免 RLS 策略竞态条件：消息保存前对话必须已存在
      
      return generatedId;
      
    } catch (error) {
      console.error('❌ [ID-GEN] 生成conversationId失败:', error);
      return null;
    }
  };
  
  return {
    currentConversationId,
    setCurrentConversationId,
    createConversation,
    insertConversationToDatabase // 🔥 暴露给外部，以便游客迁移时使用
  };
};