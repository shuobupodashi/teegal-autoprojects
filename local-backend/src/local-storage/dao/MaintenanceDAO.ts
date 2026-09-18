/**
 * 维护 DAO - 数据库维护和清理
 */

import { localDatabase } from '../database';

export class MaintenanceDAO {
  /**
   * 获取数据库统计信息
   */
  getStats() {
    const db = localDatabase.getDb();
    
    const conversationCount = db.prepare('SELECT COUNT(*) as count FROM conversations').get() as any;
    const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get() as any;
    const dbSize = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get() as any;
    
    return {
      conversations: conversationCount.count,
      messages: messageCount.count,
      database_size_bytes: dbSize.size,
      database_size_mb: (dbSize.size / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * 清理旧数据（超过指定天数的已删除对话）
   * @param days 天数
   */
  cleanupOldData(days = 30): number {
    const db = localDatabase.getDb();
    const timestamp = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    const stmt = db.prepare(`
      DELETE FROM conversations 
      WHERE status = 'deleted' AND updated_at < ?
    `);
    
    const result = stmt.run(timestamp);
    return result.changes;
  }

  /**
   * 压缩数据库（VACUUM）
   * 释放已删除数据占用的空间
   */
  vacuum(): void {
    const db = localDatabase.getDb();
    db.exec('VACUUM');
    console.log('✅ 数据库压缩完成');
  }

  /**
   * 优化数据库（分析表统计信息）
   */
  analyze(): void {
    const db = localDatabase.getDb();
    db.exec('ANALYZE');
    console.log('✅ 数据库优化完成');
  }

  /**
   * 检查数据库完整性
   */
  checkIntegrity(): { ok: boolean; errors: string[] } {
    const db = localDatabase.getDb();
    const result = db.prepare('PRAGMA integrity_check').all() as any[];
    
    if (result.length === 1 && result[0].integrity_check === 'ok') {
      return { ok: true, errors: [] };
    }
    
    return { 
      ok: false, 
      errors: result.map(r => r.integrity_check) 
    };
  }

  /**
   * 归档旧对话（将活跃对话改为归档状态）
   * @param days 多少天未更新的对话
   */
  archiveOldConversations(days = 90): number {
    const db = localDatabase.getDb();
    const timestamp = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    const stmt = db.prepare(`
      UPDATE conversations 
      SET status = 'archived' 
      WHERE status = 'active' AND updated_at < ?
    `);
    
    const result = stmt.run(timestamp);
    return result.changes;
  }

  /**
   * 导出对话数据（用于备份）
   */
  exportConversation(conversationId: string): any {
    const db = localDatabase.getDb();
    
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
    const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId);
    
    return {
      conversation,
      messages,
      exported_at: Date.now()
    };
  }
}

export const maintenanceDAO = new MaintenanceDAO();
