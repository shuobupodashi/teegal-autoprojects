/**
 * DSE (Data Storage Environment) File DAO - 数据环境文件数据访问层
 */

import { localDatabase } from '../database';
import { DSEFile } from '../types';

export class DSEFileDAO {
  /**
   * 创建文件记录
   */
  create(file: Omit<DSEFile, 'created_at' | 'updated_at'>): DSEFile {
    const db = localDatabase.getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO dse_files (
        id, user_id, file_name, file_size, file_type,
        oss_url, oss_path, local_path, dataset_id, dataset_name,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      file.id,
      file.user_id,
      file.file_name,
      file.file_size,
      file.file_type,
      file.oss_url,
      file.oss_path,
      file.local_path || null,
      file.dataset_id || null,
      file.dataset_name || null,
      now,
      now
    );

    return {
      ...file,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * 根据 ID 获取文件
   */
  getById(id: string): DSEFile | null {
    const db = localDatabase.getDb();
    const stmt = db.prepare('SELECT * FROM dse_files WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.parseRow(row) : null;
  }

  /**
   * 获取用户的所有文件
   */
  getByUserId(userId: string, limit = 200, offset = 0): DSEFile[] {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT * FROM dse_files
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(userId, limit, offset) as any[];
    return rows.map(row => this.parseRow(row));
  }

  /**
   * 获取数据集的所有文件
   */
  getByDatasetId(datasetId: string): DSEFile[] {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT * FROM dse_files
      WHERE dataset_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(datasetId) as any[];
    return rows.map(row => this.parseRow(row));
  }

  /**
   * 获取用户的文件数量和总大小
   */
  getStatsByUserId(userId: string): { count: number; totalSize: number } {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as totalSize
      FROM dse_files
      WHERE user_id = ?
    `);
    const row = stmt.get(userId) as any;
    return {
      count: row?.count || 0,
      totalSize: row?.totalSize || 0
    };
  }

  /**
   * 删除文件
   */
  delete(id: string): boolean {
    const db = localDatabase.getDb();
    const stmt = db.prepare('DELETE FROM dse_files WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 删除数据集的所有文件
   */
  deleteByDatasetId(datasetId: string): number {
    const db = localDatabase.getDb();
    const stmt = db.prepare('DELETE FROM dse_files WHERE dataset_id = ?');
    const result = stmt.run(datasetId);
    return result.changes;
  }

  /**
   * 删除用户的所有文件
   */
  deleteByUserId(userId: string): number {
    const db = localDatabase.getDb();
    const stmt = db.prepare('DELETE FROM dse_files WHERE user_id = ?');
    const result = stmt.run(userId);
    return result.changes;
  }

  private parseRow(row: any): DSEFile {
    return {
      id: row.id,
      user_id: row.user_id,
      file_name: row.file_name,
      file_size: row.file_size,
      file_type: row.file_type,
      oss_url: row.oss_url,
      oss_path: row.oss_path,
      local_path: row.local_path,
      dataset_id: row.dataset_id,
      dataset_name: row.dataset_name,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export const dseFileDAO = new DSEFileDAO();
