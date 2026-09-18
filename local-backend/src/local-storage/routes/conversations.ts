/**
 * Conversations API 路由
 */

import express from 'express';
import { conversationDAO } from '../dao';
import { messageDAO } from '../dao';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * GET /api/local/conversations
 * 获取用户的所有对话
 */
router.get('/', (req, res) => {
  try {
    const userId = req.query.user_id as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const conversations = conversationDAO.getByUserId(userId, limit, offset);
    res.json({ data: conversations });
  } catch (error: any) {
    console.error('❌ 获取对话列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/conversations/search
 * 🔍 全文搜索消息
 */
router.get('/search', (req, res) => {
  try {
    const keyword = req.query.q as string;
    const userId = req.query.user_id as string;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!keyword) {
      return res.status(400).json({ error: 'q (keyword) is required' });
    }

    const results = messageDAO.searchMessages(keyword, userId, limit);
    
    res.json({ 
      success: true,
      data: results,
      count: results.length 
    });
  } catch (error: any) {
    console.error('❌ 搜索消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/local/conversations/memory/context
 * 📋 获取消息上下文（用于记忆召回）
 */
router.get('/memory/context', (req, res) => {
  try {
    const conversationId = req.query.conversation_id as string;
    const messageId = req.query.message_id as string;
    const before = parseInt(req.query.before as string) || 2;
    const after = parseInt(req.query.after as string) || 2;

    if (!conversationId || !messageId) {
      return res.status(400).json({ 
        success: false, 
        error: 'conversation_id and message_id are required' 
      });
    }

    const results = messageDAO.getMessageContext(conversationId, messageId, before, after);
    
    const formattedResults = results.map(msg => ({
      ...msg,
      created_at: new Date(msg.created_at).toISOString(),
    }));
    
    res.json({ 
      success: true,
      data: formattedResults,
      count: formattedResults.length 
    });
  } catch (error: any) {
    console.error('❌ 获取消息上下文失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/local/conversations
 * 创建新对话
 */
router.post('/', (req, res) => {
  try {
    const { id, user_id, title, agent_id, metadata } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const conversationId = id || uuidv4();
    
    const conversation = conversationDAO.create({
      id: conversationId,
      user_id,
      title: title || null,
      agent_id: agent_id || null,
      status: 'active',
      execution_count: 0,
      result: null,
      is_flagged: false,
      flagged_at: null,
      is_broadcast: false,
      metadata: metadata || {}
    });

    res.status(201).json({ data: conversation });
  } catch (error: any) {
    console.error('❌ 创建对话失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/conversations/:id
 * 获取单个对话
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const includeMessages = req.query.include_messages === 'true';

    if (includeMessages) {
      const conversation = conversationDAO.getWithMessages(id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      return res.json({ data: conversation });
    }

    const conversation = conversationDAO.getById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ data: conversation });
  } catch (error: any) {
    console.error('❌ 获取对话失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/local/conversations/:id
 * 更新对话
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, agent_id, status, metadata } = req.body;

    const success = conversationDAO.update(id, {
      title,
      agent_id,
      status,
      metadata
    });

    if (!success) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updated = conversationDAO.getById(id);
    res.json({ data: updated });
  } catch (error: any) {
    console.error('❌ 更新对话失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/local/conversations/:id
 * 删除对话（软删除）
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const hard = req.query.hard === 'true';

    const success = hard 
      ? conversationDAO.hardDelete(id)
      : conversationDAO.delete(id);

    if (!success) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ 删除对话失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/conversations/:id/messages/count
 * 获取对话的消息总数
 */
router.get('/:id/messages/count', (req, res) => {
  try {
    const { id } = req.params;

    const count = messageDAO.getCountByConversationId(id);
    
    res.json({ count });
  } catch (error: any) {
    console.error('❌ 获取消息总数失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/conversations/:id/messages
 * 获取对话的消息
 */
router.get('/:id/messages', (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = messageDAO.getByConversationId(id, limit, offset);
    
    const formattedMessages = messages.map(msg => ({
      ...msg,
      created_at: new Date(msg.created_at).toISOString(),
    }));
    
    res.json({ data: formattedMessages });
  } catch (error: any) {
    console.error('❌ 获取消息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/local/conversations/:id/messages
 * 向对话添加消息
 */
router.post('/:id/messages', (req, res) => {
  try {
    const { id } = req.params;
    const { role, content, metadata, files, api_role, result, status, call_id, icon_text, session_id, memory } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'role is required' });
    }

    if ((content === undefined || content === null) && !metadata?.phase_data) {
      return res.status(400).json({ error: 'content or phase_data is required' });
    }

    const conversation = conversationDAO.getById(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const message = messageDAO.create({
      id: uuidv4(),
      conversation_id: id,
      role,
      content,
      files: files || metadata?.files || [],
      metadata: metadata || {},
      api_role,
      result,
      status,
      call_id,
      icon_text,
      session_id,
      memory
    });

    conversationDAO.update(id, {});

    res.status(201).json({ data: message });
  } catch (error: any) {
    console.error('❌ 创建消息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/conversations/:id/messages/session
 * 获取指定会话的消息
 */
router.get('/:id/messages/session', (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const messages = messageDAO.getSessionMessages(id, sessionId as string);

    res.json({ data: messages });
  } catch (error: any) {
    console.error('❌ 获取会话消息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/local/conversations/:id/messages/:messageId
 * 更新消息（支持通过 call_id 更新）
 */
router.put('/:id/messages/:messageId', (req, res) => {
  try {
    const { id, messageId } = req.params;
    const { result, status, icon_text, content, metadata } = req.body;

    const conversation = conversationDAO.getById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // 尝试通过 call_id 更新
    const success = messageDAO.updateByCallId(messageId, {
      result,
      status,
      icon_text,
      content,
      metadata
    });

    if (!success) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ 更新消息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
