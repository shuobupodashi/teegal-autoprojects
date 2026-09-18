/**
 * Message DAO - 消息数据访问层
 */

import { localDatabase } from '../database';
import { Message } from '../types';

export class MessageDAO {
  /**
   * 创建新消息
   */
  create(message: Omit<Message, 'created_at'>): Message {
    const db = localDatabase.getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO messages (
        id, conversation_id, role, content, files, metadata,
        api_role, result, status, call_id, icon_text, session_id, memory, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      message.id,
      message.conversation_id,
      message.role,
      message.content,
      JSON.stringify(message.files || []),
      JSON.stringify(message.metadata || {}),
      message.api_role || null,
      message.result || null,
      message.status || null,
      message.call_id || null,
      message.icon_text || null,
      message.session_id || null,
      message.memory || null,
      now
    );

    return {
      ...message,
      created_at: now
    };
  }

  /**
   * 批量创建消息
   */
  createBatch(messages: Omit<Message, 'created_at'>[]): Message[] {
    const db = localDatabase.getDb();
    const now = Date.now();

    const insert = db.transaction((msgs: Omit<Message, 'created_at'>[]) => {
      const stmt = db.prepare(`
        INSERT INTO messages (
          id, conversation_id, role, content, files, metadata,
          api_role, result, status, call_id, icon_text, session_id, memory, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const msg of msgs) {
        stmt.run(
          msg.id,
          msg.conversation_id,
          msg.role,
          msg.content,
          JSON.stringify(msg.files || []),
          JSON.stringify(msg.metadata || {}),
          msg.api_role || null,
          msg.result || null,
          msg.status || null,
          msg.call_id || null,
          msg.icon_text || null,
          msg.session_id || null,
          msg.memory || null,
          now
        );
      }
    });

    insert(messages);

    return messages.map(msg => ({
      ...msg,
      created_at: now
    }));
  }

  /**
   * 根据 ID 获取消息
   */
  getById(id: string): Message | null {
    const db = localDatabase.getDb();
    const stmt = db.prepare('SELECT * FROM messages WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.parseMessageRow(row);
  }

  /**
   * 获取对话的所有消息
   * 🔥 统一返回 DESC（降序）：消息按时间从新到旧排列
   * 前端通过 reverse() 调整显示顺序
   */
  getByConversationId(conversationId: string, limit = 100, offset = 0): Message[] {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(conversationId, limit, offset) as any[];

    return rows.map(row => this.parseMessageRow(row));
  }

  /**
   * 获取对话的消息总数
   */
  getCountByConversationId(conversationId: string): number {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM messages 
      WHERE conversation_id = ?
    `);
    
    const result = stmt.get(conversationId) as { count: number };
    // Message count
    
    return result?.count || 0;
  }

  /**
   * 🔥 获取指定矩阵坐标的消息（用于 currentCoordContext）
   * @param conversationId 对话ID
   * @param sessionId 会话ID
   * @returns 该会话下的所有消息
   */
  getSessionMessages(
    conversationId: string,
    sessionId: string
  ): Message[] {
    const db = localDatabase.getDb();
    
    const stmt = db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? AND session_id = ?
      ORDER BY created_at ASC
    `);
    
    const rows = stmt.all(conversationId, sessionId) as any[];
    
    return rows.map(row => this.parseMessageRow(row));
  }

  /**
   * 更新消息内容
   */
  update(id: string, content: string, metadata?: Record<string, any>): boolean {
    const db = localDatabase.getDb();

    const updates: string[] = ['content = ?'];
    const values: any[] = [content];

    if (metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(metadata));
    }

    values.push(id);

    const stmt = db.prepare(`
      UPDATE messages
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  updateByCallId(
    callId: string,
    updates: {
      result?: string;
      status?: string;
      icon_text?: string;
      content?: string;
      metadata?: Record<string, any>;
      session_id?: string;
    }
  ): boolean {
    const db = localDatabase.getDb();

    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.result !== undefined) {
      setClauses.push('result = ?');
      values.push(updates.result);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.icon_text !== undefined) {
      setClauses.push('icon_text = ?');
      values.push(updates.icon_text);
    }
    if (updates.content !== undefined) {
      setClauses.push('content = ?');
      values.push(updates.content);
    }
    if (updates.metadata !== undefined) {
      setClauses.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }
    if (updates.session_id !== undefined) {
      setClauses.push('session_id = ?');
      values.push(updates.session_id);
    }

    if (setClauses.length === 0) return false;

    values.push(callId);

    const stmt = db.prepare(`
      UPDATE messages
      SET ${setClauses.join(', ')}
      WHERE call_id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  /**
   * 删除消息
   */
  delete(id: string): boolean {
    const db = localDatabase.getDb();
    const stmt = db.prepare('DELETE FROM messages WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 删除对话的所有消息
   */
  deleteByConversationId(conversationId: string): number {
    const db = localDatabase.getDb();
    const stmt = db.prepare('DELETE FROM messages WHERE conversation_id = ?');
    const result = stmt.run(conversationId);
    return result.changes;
  }

  /**
   * 🔍 全文搜索消息（使用 FTS5 + LIKE 后备方案）
   * @param keyword 搜索关键词
   * @param userId 用户 ID（可选）
   * @param limit 限制数量
   */
  searchMessages(
    keyword: string, 
    userId?: string, 
    limit = 50
  ): Array<Message & { conversation_title: string | null; rank: number; snippet: string }> {
    const db = localDatabase.getDb();
    
    // 🔥 策略1: 尝试 FTS5 搜索
    try {
      // 🔥 转换关键词为 FTS5 支持的格式
      // 对于包含下划线等特殊字符的词，尝试多种匹配方式
      const ftsKeywords = keyword.split(/\s+/).filter(k => k.length > 0);
      const ftsMatchExpressions: string[] = [];
      
      // 原始关键词（用于短语匹配）
      ftsMatchExpressions.push(`"${keyword}"`);
      
      // 每个词加上通配符（支持前缀匹配）
      ftsKeywords.forEach(k => {
        if (k.length >= 2) {
          ftsMatchExpressions.push(`${k}*`);
        }
      });
      
      // 组合成 OR 查询
      const ftsMatchQuery = ftsMatchExpressions.join(' OR ');
      
      let query = `
        SELECT 
          m.*,
          c.title as conversation_title,
          snippet(messages_fts, 0, '<mark>', '</mark>', '...', 30) as snippet,
          messages_fts.rank as fts_rank
        FROM messages_fts
        JOIN messages m ON messages_fts.rowid = m.rowid
        JOIN conversations c ON m.conversation_id = c.id
      `;
      
      const params: any[] = [];
      
      if (userId) {
        query += ` WHERE c.user_id = ?`;
        params.push(userId);
        query += ` AND messages_fts MATCH ?`;
        params.push(ftsMatchQuery);
      } else {
        query += ` WHERE messages_fts MATCH ?`;
        params.push(ftsMatchQuery);
      }
      
      query += ` ORDER BY fts_rank ASC LIMIT ?`;
      params.push(limit);
      
      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as any[];
      
      if (rows.length > 0) {
        console.log(`[MessageDAO] FTS5 搜索成功: "${keyword}" (匹配: ${ftsMatchQuery}) 找到 ${rows.length} 条结果`);
        // 🔥 调试：打印前5条结果的 rank（FTS5 rank 越小越相关）
        console.log(`[MessageDAO] 前5条 (按相关性排序):`, rows.slice(0, 5).map(r => ({
          title: r.conversation_title?.substring(0, 20),
          rank: r.fts_rank,
          content: r.content?.substring(0, 50)
        })));
        return rows.map(row => ({
          ...this.parseMessageRow(row),
          conversation_title: row.conversation_title,
          rank: row.fts_rank,
          snippet: row.snippet || row.content?.substring(0, 100) + '...'
        }));
      }
    } catch (e) {
      console.warn(`[MessageDAO] FTS5 搜索失败: "${keyword}", 错误:`, e);
    }
    
    // 🔥 策略2: FTS5 失败或无结果，使用 LIKE 搜索（同时搜索 content 和 result）
    console.log(`[MessageDAO] 使用 LIKE 搜索: "${keyword}"`);
    
    // 🔥 同时搜索 content 和 result 字段（合并搜索）
    let likeQuery = `
      SELECT 
        m.*,
        c.title as conversation_title,
        0 as fts_rank,
        COALESCE(NULLIF(m.content, ''), NULLIF(m.result, ''), '') as snippet
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE (m.content LIKE ? OR m.result LIKE ? OR (m.content || ' ' || COALESCE(m.result, '')) LIKE ?)
    `;
    
    // 🔥 三个参数：content、result、合并字段都使用相同的搜索模式
    const likePattern = `%${keyword}%`;
    const likeParams: any[] = [likePattern, likePattern, likePattern];
    
    if (userId) {
      likeQuery += ` AND c.user_id = ?`;
      likeParams.push(userId);
    }
    
    likeQuery += ` ORDER BY m.created_at DESC LIMIT ?`;
    likeParams.push(limit);
    
    try {
      const likeStmt = db.prepare(likeQuery);
      const likeRows = likeStmt.all(...likeParams) as any[];
      
      console.log(`[MessageDAO] LIKE 搜索完成: "${keyword}" 找到 ${likeRows.length} 条结果`);
      
      return likeRows.map(row => ({
        ...this.parseMessageRow(row),
        conversation_title: row.conversation_title,
        rank: 0, // LIKE 搜索没有排名
        snippet: row.snippet || row.content?.substring(0, 100) || row.result?.substring(0, 100) || ''
      }));
    } catch (e) {
      console.error(`[MessageDAO] LIKE 搜索也失败了:`, e);
      return [];
    }
  }

  /**
   * 获取消息上下文（前后 n 条消息）
   * @param conversationId 对话 ID
   * @param messageId 目标消息 ID
   * @param before 前面获取的条数
   * @param after 后面获取的条数
   */
  getMessageContext(
    conversationId: string,
    messageId: string,
    before: number = 2,
    after: number = 2
  ): Array<Message & { conversation_title: string | null }> {
    const db = localDatabase.getDb();
    
    const targetStmt = db.prepare(`
      SELECT created_at FROM messages WHERE id = ? AND conversation_id = ?
    `);
    const targetRow = targetStmt.get(messageId, conversationId) as any;
    
    if (!targetRow) {
      console.warn('[MessageDAO] 目标消息不存在:', { messageId, conversationId });
      return [];
    }
    
    const targetTime = targetRow.created_at;
    
    const beforeStmt = db.prepare(`
      SELECT m.*, c.title as conversation_title
      FROM messages m
      LEFT JOIN conversations c ON m.conversation_id = c.id
      WHERE m.conversation_id = ? AND m.created_at < ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `);
    const beforeRows = beforeStmt.all(conversationId, targetTime, before) as any[];
    
    const afterStmt = db.prepare(`
      SELECT m.*, c.title as conversation_title
      FROM messages m
      LEFT JOIN conversations c ON m.conversation_id = c.id
      WHERE m.conversation_id = ? AND m.created_at > ?
      ORDER BY m.created_at ASC
      LIMIT ?
    `);
    const afterRows = afterStmt.all(conversationId, targetTime, after) as any[];
    
    const targetMsgStmt = db.prepare(`
      SELECT m.*, c.title as conversation_title
      FROM messages m
      LEFT JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = ?
    `);
    const targetMsg = targetMsgStmt.get(messageId) as any;
    
    const results = [
      ...beforeRows.reverse().map(row => ({
        ...this.parseMessageRow(row),
        conversation_title: row.conversation_title
      })),
      ...(targetMsg ? [{
        ...this.parseMessageRow(targetMsg),
        conversation_title: targetMsg.conversation_title
      }] : []),
      ...afterRows.map(row => ({
        ...this.parseMessageRow(row),
        conversation_title: row.conversation_title
      }))
    ];
    
    return results;
  }

  /**
   * 解析数据库行对象为 Message 对象
   */
  private parseMessageRow(row: any): Message {
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      content: row.content,
      files: JSON.parse(row.files || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      api_role: row.api_role,
      result: row.result,
      status: row.status,
      call_id: row.call_id,
      icon_text: row.icon_text,
      session_id: row.session_id,
      memory: row.memory,
      created_at: row.created_at
    };
  }
}

export const messageDAO = new MessageDAO();
