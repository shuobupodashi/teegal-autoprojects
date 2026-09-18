/**
 * Training Tasks API 路由
 */

import express from 'express';
import { trainingTaskDAO } from '../dao';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * GET /api/local/training-tasks
 * 获取用户的所有训练任务
 */
router.get('/', (req, res) => {
  try {
    const userId = req.query.user_id as string;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const tasks = trainingTaskDAO.getByUserId(userId, limit, offset);
    res.json({ data: tasks });
  } catch (error: any) {
    console.error('❌ 获取训练任务列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/training-tasks/app/:appId
 * 获取应用的所有训练任务
 */
router.get('/app/:appId', (req, res) => {
  try {
    const { appId } = req.params;
    const tasks = trainingTaskDAO.getByAppId(appId);
    res.json({ data: tasks });
  } catch (error: any) {
    console.error('❌ 获取应用训练任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/training-tasks/app/:appId/summary
 * 🔥 轻量级查询：只返回任务摘要，不包含 stdout_output/charts_json/files_json 等大字段
 * 用于列表展示和定时轮询
 */
router.get('/app/:appId/summary', (req, res) => {
  try {
    const { appId } = req.params;
    const tasks = trainingTaskDAO.getSummaryByAppId(appId);
    res.json({ data: tasks });
  } catch (error: any) {
    console.error('❌ 获取应用训练任务摘要失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/local/training-tasks/:id
 * 获取单个训练任务
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const task = trainingTaskDAO.getById(id);

    if (!task) {
      return res.status(404).json({ error: 'Training task not found' });
    }

    res.json({ data: task });
  } catch (error: any) {
    console.error('❌ 获取训练任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/local/training-tasks
 * 创建新训练任务
 */
router.post('/', (req, res) => {
  try {
    const {
      app_id,
      user_id,
      status,
      code_snapshot,
      stdout_output,
      charts_json,
      files_json,
      model_oss_url,
      instance_type,
      gpu_instance_id
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const task = trainingTaskDAO.create({
      id: uuidv4(),
      app_id: app_id || null,
      user_id,
      status: status || 'pending',
      code_snapshot: code_snapshot || null,
      stdout_output: stdout_output || null,
      charts_json: charts_json || [],
      files_json: files_json || {},
      model_oss_url: model_oss_url || null,
      instance_type: instance_type || null,
      gpu_instance_id: gpu_instance_id || null,
      gpu_instance_region: null,
      duration: null,
      cost: null,
      error_message: null,
      flag: null,
      remark: null  // 🔥 训练备注
    });

    res.status(201).json({ data: task });
  } catch (error: any) {
    console.error('❌ 创建训练任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/local/training-tasks/:id
 * 更新训练任务
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const task = trainingTaskDAO.update(id, updates);

    if (!task) {
      return res.status(404).json({ error: 'Training task not found' });
    }

    res.json({ data: task });
  } catch (error: any) {
    console.error('❌ 更新训练任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/local/training-tasks/:id
 * 删除训练任务
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = trainingTaskDAO.delete(id);

    if (!success) {
      return res.status(404).json({ error: 'Training task not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ 删除训练任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
