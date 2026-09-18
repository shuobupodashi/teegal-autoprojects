/**
 * Execution Log DAO - 本地代码执行记录数据访问层
 */

import { localDatabase } from '../database';
import { ExecutionLog } from '../types';

export class ExecutionLogDAO {
  /**
   * 创建新执行日志
   */
  create(log: Omit<ExecutionLog, 'created_at' | 'updated_at'>): ExecutionLog {
    const db = localDatabase.getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO execution_logs (
        id, app_id, user_id, execution_mode, command, work_dir,
        stdout_output, stderr_output, exit_code, duration,
        status, error_message, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.id,
      log.app_id || null,
      log.user_id,
      log.execution_mode || 'python',
      log.command || null,
      log.work_dir || null,
      log.stdout_output || null,
      log.stderr_output || null,
      log.exit_code ?? null,
      log.duration ?? null,
      log.status || 'running',
      log.error_message || null,
      now,
      now
    );

    return {
      ...log,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * 根据 ID 获取执行日志
   */
  getById(id: string): ExecutionLog | null {
    const db = localDatabase.getDb();
    const stmt = db.prepare('SELECT * FROM execution_logs WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.parseLogRow(row);
  }

  /**
   * 获取用户的所有执行日志
   */
  getByUserId(userId: string, limit = 100, offset = 0): ExecutionLog[] {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT * FROM execution_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(userId, limit, offset) as any[];

    return rows.map(row => this.parseLogRow(row));
  }

  /**
   * 获取 app 的所有执行日志
   */
  getByAppId(appId: string): ExecutionLog[] {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT * FROM execution_logs
      WHERE app_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(appId) as any[];

    return rows.map(row => this.parseLogRow(row));
  }

  /**
   * 轻量查询：不含 stdout_output/stderr_output
   */
  getSummaryByAppId(appId: string): Partial<ExecutionLog>[] {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT id, app_id, user_id, execution_mode, command, work_dir,
             exit_code, duration, status, error_message,
             created_at, updated_at
      FROM execution_logs
      WHERE app_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(appId) as any[];

    return rows.map(row => ({
      id: row.id,
      app_id: row.app_id,
      user_id: row.user_id,
      execution_mode: row.execution_mode,
      command: row.command,
      work_dir: row.work_dir,
      exit_code: row.exit_code,
      duration: row.duration,
      status: row.status,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * 更新执行日志
   */
  update(id: string, updates: Partial<Omit<ExecutionLog, 'id' | 'created_at'>>): ExecutionLog | null {
    const db = localDatabase.getDb();
    const now = Date.now();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.app_id !== undefined) {
      fields.push('app_id = ?');
      values.push(updates.app_id);
    }
    if (updates.execution_mode !== undefined) {
      fields.push('execution_mode = ?');
      values.push(updates.execution_mode);
    }
    if (updates.command !== undefined) {
      fields.push('command = ?');
      values.push(updates.command);
    }
    if (updates.work_dir !== undefined) {
      fields.push('work_dir = ?');
      values.push(updates.work_dir);
    }
    if (updates.stdout_output !== undefined) {
      fields.push('stdout_output = ?');
      values.push(updates.stdout_output);
    }
    if (updates.stderr_output !== undefined) {
      fields.push('stderr_output = ?');
      values.push(updates.stderr_output);
    }
    if (updates.exit_code !== undefined) {
      fields.push('exit_code = ?');
      values.push(updates.exit_code);
    }
    if (updates.duration !== undefined) {
      fields.push('duration = ?');
      values.push(updates.duration);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.error_message !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.error_message);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const stmt = db.prepare(`
      UPDATE execution_logs
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);

    if (result.changes === 0) {
      return null;
    }

    return this.getById(id);
  }

  /**
   * 删除执行日志
   */
  delete(id: string): boolean {
    const db = localDatabase.getDb();
    const stmt = db.prepare('DELETE FROM execution_logs WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 解析数据库行
   */
  private parseLogRow(row: any): ExecutionLog {
    return {
      id: row.id,
      app_id: row.app_id,
      user_id: row.user_id,
      execution_mode: row.execution_mode,
      command: row.command,
      work_dir: row.work_dir,
      stdout_output: row.stdout_output,
      stderr_output: row.stderr_output,
      exit_code: row.exit_code,
      duration: row.duration,
      status: row.status,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

// 导出单例
export const executionLogDAO = new ExecutionLogDAO();
