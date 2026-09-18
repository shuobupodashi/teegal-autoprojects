/**
 * Execution Logs API 路由
 */

import express from 'express';
import { executionLogDAO } from '../dao';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * POST /api/local/execution-logs
 * 创建执行日志
 */
router.post('/', (req, res) => {
  try {
    const {
      app_id,
      user_id,
      execution_mode,
      command,
      work_dir,
      stdout_output,
      stderr_output,
      exit_code,
      duration,
      status,
      error_message
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // 🔥 使用前端传的 ID（如果有），否则生成新 ID
    const logId = req.body.id || uuidv4();

    const log = executionLogDAO.create({
      id: logId,
      app_id: app_id || null,
      user_id,
      execution_mode: execution_mode || 'python',
      command: command || null,
      work_dir: work_dir || null,
      stdout_output: stdout_output || null,
      stderr_output: stderr_output || null,
      exit_code: exit_code ?? null,
      duration: duration ?? null,
      status: status || 'running',
      error_message: error_message || null
    });

    res.status(201).json({ data: log });
  } catch (error: any) {
    console.error('❌ 创建执行日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/execution-logs
 * 获取用户的所有执行日志
 */
router.get('/', (req, res) => {
  try {
    const userId = req.query.user_id as string;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const logs = executionLogDAO.getByUserId(userId, limit, offset);
    res.json({ data: logs });
  } catch (error: any) {
    console.error('❌ 获取执行日志列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/execution-logs/app/:appId
 * 获取 app 的所有执行日志
 */
router.get('/app/:appId', (req, res) => {
  try {
    const { appId } = req.params;
    const logs = executionLogDAO.getByAppId(appId);
    res.json({ data: logs });
  } catch (error: any) {
    console.error('❌ 获取应用执行日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/execution-logs/app/:appId/summary
 * 获取 app 的执行日志摘要（不含大字段）
 */
router.get('/app/:appId/summary', (req, res) => {
  try {
    const { appId } = req.params;
    const logs = executionLogDAO.getSummaryByAppId(appId);
    res.json({ data: logs });
  } catch (error: any) {
    console.error('❌ 获取应用执行日志摘要失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/execution-logs/:id
 * 获取单个执行日志
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const log = executionLogDAO.getById(id);

    if (!log) {
      return res.status(404).json({ error: 'Execution log not found' });
    }

    res.json({ data: log });
  } catch (error: any) {
    console.error('❌ 获取执行日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/local/execution-logs/:id
 * 更新执行日志
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const log = executionLogDAO.update(id, updates);

    if (!log) {
      return res.status(404).json({ error: 'Execution log not found' });
    }

    res.json({ data: log });
  } catch (error: any) {
    console.error('❌ 更新执行日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/local/execution-logs/:id
 * 删除执行日志
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = executionLogDAO.delete(id);

    if (!success) {
      return res.status(404).json({ error: 'Execution log not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ 删除执行日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
