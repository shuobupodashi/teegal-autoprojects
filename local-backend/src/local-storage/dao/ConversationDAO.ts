/**
 * Conversation DAO - 对话数据访问层
 */

import { localDatabase } from '../database';
import { Conversation, Message, ConversationWithMessages } from '../types';

export class ConversationDAO {
  /**
   * 创建新对话
   */
  create(conversation: Omit<Conversation, 'created_at' | 'updated_at'>): Conversation {
    const db = localDatabase.getDb();
    const now = Date.now();
    
    const stmt = db.prepare(`
      INSERT INTO conversations (
        id, user_id, title, agent_id, status, execution_count, result,
        is_flagged, flagged_at, is_broadcast, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      conversation.id,
      conversation.user_id,
      conversation.title,
      conversation.agent_id,
      conversation.status || 'idle',
      conversation.execution_count || 0,
      conversation.result || null,
      conversation.is_flagged ? 1 : 0,
      conversation.flagged_at || null,
      conversation.is_broadcast ? 1 : 0,
      JSON.stringify(conversation.metadata || {}),
      now,
      now
    );
    
    return {
      ...conversation,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * 根据 ID 获取对话
   */
  getById(id: string): Conversation | null {
    const db = localDatabase.getDb();
    const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.parseConversationRow(row);
  }

  /**
   * 获取用户的所有对话
   */
  getByUserId(userId: string, limit = 50, offset = 0): Conversation[] {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT * FROM conversations 
      WHERE user_id = ? AND status != 'deleted'
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(userId, limit, offset) as any[];
    
    return rows.map(row => this.parseConversationRow(row));
  }

  /**
   * 获取对话及其消息
   */
  getWithMessages(id: string): ConversationWithMessages | null {
    const conversation = this.getById(id);
    if (!conversation) return null;
    
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at ASC
    `);
    
    const messages = (stmt.all(id) as any[]).map(row => ({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    }));
    
    return {
      ...conversation,
      messages
    };
  }

  /**
   * 更新对话
   */
  update(id: string, updates: Partial<Omit<Conversation, 'id' | 'created_at'>>): boolean {
    const db = localDatabase.getDb();
    const now = Date.now();
    
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.agent_id !== undefined) {
      fields.push('agent_id = ?');
      values.push(updates.agent_id);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);
    
    const stmt = db.prepare(`
      UPDATE conversations 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `);
    
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  /**
   * 删除对话（软删除）
   */
  delete(id: string): boolean {
    return this.update(id, { status: 'deleted' });
  }

  /**
   * 彻底删除对话
   */
  hardDelete(id: string): boolean {
    const db = localDatabase.getDb();
    const stmt = db.prepare('DELETE FROM conversations WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 解析数据库行对象为 Conversation 对象
   */
  private parseConversationRow(row: any): Conversation {
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      agent_id: row.agent_id,
      status: row.status,
      execution_count: row.execution_count || 0,
      result: row.result,
      is_flagged: row.is_flagged === 1,
      flagged_at: row.flagged_at,
      is_broadcast: row.is_broadcast === 1,
      metadata: JSON.parse(row.metadata || '{}'),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export const conversationDAO = new ConversationDAO();
