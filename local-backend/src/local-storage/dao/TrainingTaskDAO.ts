/**
 * Training Task DAO - 训练任务数据访问层
 */

import { localDatabase } from '../database';
import { TrainingTask } from '../types';

export class TrainingTaskDAO {
  /**
   * 创建新训练任务
   */
  create(task: Omit<TrainingTask, 'created_at' | 'updated_at'>): TrainingTask {
    const db = localDatabase.getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO training_tasks (
        id, app_id, user_id, status, code_snapshot, stdout_output,
        charts_json, files_json, model_oss_url, instance_type, gpu_instance_id, gpu_instance_region,
        duration, cost, error_message, flag, remark, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.app_id || null,
      task.user_id,
      task.status || 'pending',
      task.code_snapshot || null,
      task.stdout_output || null,
      JSON.stringify(task.charts_json || []),
      JSON.stringify(task.files_json || {}),
      task.model_oss_url || null,
      task.instance_type || null,
      task.gpu_instance_id || null,
      task.gpu_instance_region || null,
      task.duration || null,
      task.cost || null,
      task.error_message || null,
      task.flag || null,
      task.remark || null,
      now,
      now
    );

    return {
      ...task,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * 根据 ID 获取任务
   */
  getById(id: string): TrainingTask | null {
    const db = localDatabase.getDb();
    const stmt = db.prepare('SELECT * FROM training_tasks WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.parseTaskRow(row);
  }

  /**
   * 获取应用的所有训练任务
   */
  getByAppId(appId: string): TrainingTask[] {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT * FROM training_tasks 
      WHERE app_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(appId) as any[];

    return rows.map(row => this.parseTaskRow(row));
  }

  /**
   * 🔥 轻量级查询：只返回任务摘要信息，不包含大字段
   * 用于列表展示和定时轮询，避免传输 stdout_output/charts_json/files_json 等大字段
   */
  getSummaryByAppId(appId: string): Partial<TrainingTask>[] {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT id, app_id, user_id, status, instance_type, gpu_instance_id, gpu_instance_region,
             duration, cost, model_oss_url, error_message, flag, remark,
             created_at, updated_at
      FROM training_tasks
      WHERE app_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(appId) as any[];

    return rows.map(row => ({
      id: row.id,
      app_id: row.app_id,
      user_id: row.user_id,
      status: row.status,
      instance_type: row.instance_type,
      gpu_instance_id: row.gpu_instance_id,
      gpu_instance_region: row.gpu_instance_region,
      duration: row.duration,
      cost: row.cost,
      model_oss_url: row.model_oss_url,
      error_message: row.error_message,
      flag: row.flag,
      remark: row.remark,  // 🔥 训练备注
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * 获取用户的所有训练任务
   */
  getByUserId(userId: string, limit = 100, offset = 0): TrainingTask[] {
    const db = localDatabase.getDb();
    const stmt = db.prepare(`
      SELECT * FROM training_tasks 
      WHERE user_id = ?
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(userId, limit, offset) as any[];

    return rows.map(row => this.parseTaskRow(row));
  }

  /**
   * 获取指定状态的任务
   */
  getByStatus(status: string | string[]): TrainingTask[] {
    const db = localDatabase.getDb();
    const statuses = Array.isArray(status) ? status : [status];
    const placeholders = statuses.map(() => '?').join(',');
    const stmt = db.prepare(`
      SELECT * FROM training_tasks 
      WHERE status IN (${placeholders})
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(...statuses) as any[];

    return rows.map(row => this.parseTaskRow(row));
  }

  /**
   * 更新任务
   */
  update(id: string, updates: Partial<Omit<TrainingTask, 'id' | 'created_at'>>): TrainingTask | null {
    const db = localDatabase.getDb();
    const now = Date.now();

    // 构建动态更新语句
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.code_snapshot !== undefined) {
      fields.push('code_snapshot = ?');
      values.push(updates.code_snapshot);
    }
    if (updates.stdout_output !== undefined) {
      fields.push('stdout_output = ?');
      values.push(updates.stdout_output);
    }
    if (updates.charts_json !== undefined) {
      fields.push('charts_json = ?');
      values.push(JSON.stringify(updates.charts_json));
    }
    if (updates.files_json !== undefined) {
      fields.push('files_json = ?');
      values.push(JSON.stringify(updates.files_json));
    }
    if (updates.model_oss_url !== undefined) {
      fields.push('model_oss_url = ?');
      values.push(updates.model_oss_url);
    }
    if (updates.instance_type !== undefined) {
      fields.push('instance_type = ?');
      values.push(updates.instance_type);
    }
    if (updates.gpu_instance_id !== undefined) {
      fields.push('gpu_instance_id = ?');
      values.push(updates.gpu_instance_id);
    }
    if (updates.duration !== undefined) {
      fields.push('duration = ?');
      values.push(updates.duration);
    }
    if (updates.cost !== undefined) {
      fields.push('cost = ?');
      values.push(updates.cost);
    }
    if (updates.error_message !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.error_message);
    }
    // 🔥 新增 flag 字段更新
    if (updates.flag !== undefined) {
      fields.push('flag = ?');
      values.push(updates.flag);
    }
    // 🔥 新增 gpu_instance_region 字段更新
    if (updates.gpu_instance_region !== undefined) {
      fields.push('gpu_instance_region = ?');
      values.push(updates.gpu_instance_region);
    }
    // 🔥 新增 remark 字段更新（训练备注/阶段总结）
    if (updates.remark !== undefined) {
      fields.push('remark = ?');
      values.push(updates.remark);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const stmt = db.prepare(`
      UPDATE training_tasks 
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
   * 删除任务
   */
  delete(id: string): boolean {
    const db = localDatabase.getDb();
    const stmt = db.prepare('DELETE FROM training_tasks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 删除应用的所有任务
   */
  deleteByAppId(appId: string): number {
    const db = localDatabase.getDb();
    const stmt = db.prepare('DELETE FROM training_tasks WHERE app_id = ?');
    const result = stmt.run(appId);
    return result.changes;
  }

  /**
   * 解析数据库行
   */
  private parseTaskRow(row: any): TrainingTask {
    return {
      id: row.id,
      app_id: row.app_id,
      user_id: row.user_id,
      status: row.status,
      code_snapshot: row.code_snapshot,
      stdout_output: row.stdout_output,
      charts_json: JSON.parse(row.charts_json || '[]'),
      files_json: JSON.parse(row.files_json || '{}'),
      model_oss_url: row.model_oss_url,
      instance_type: row.instance_type,
      gpu_instance_id: row.gpu_instance_id,
      gpu_instance_region: row.gpu_instance_region,  // 🔥 新增 region 字段
      duration: row.duration,
      cost: row.cost,
      error_message: row.error_message,
      flag: row.flag,
      remark: row.remark,  // 🔥 训练备注
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

// 导出单例
export const trainingTaskDAO = new TrainingTaskDAO();
