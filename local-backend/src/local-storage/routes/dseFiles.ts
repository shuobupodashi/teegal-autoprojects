/**
 * DSE (Data Storage Environment) Files API 路由
 */

import express from 'express';
import { dseFileDAO } from '../dao';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * POST /api/local/dse-files
 * 创建文件记录（上传成功后调用）
 */
router.post('/', (req, res) => {
  try {
    const {
      user_id,
      file_name,
      file_size,
      file_type,
      oss_url,
      oss_path,
      local_path,
      dataset_id,
      dataset_name
    } = req.body;

    if (!user_id || !file_name || !oss_url) {
      res.status(400).json({ error: 'user_id, file_name, oss_url 为必填' });
      return;
    }

    const id = req.body.id || uuidv4();

    const file = dseFileDAO.create({
      id,
      user_id,
      file_name,
      file_size: file_size || 0,
      file_type: file_type || 'other',
      oss_url,
      oss_path: oss_path || '',
      local_path: local_path || null,
      dataset_id: dataset_id || null,
      dataset_name: dataset_name || null,
    });

    res.json(file);
  } catch (error) {
    console.error('[DSE] 创建文件记录失败:', error);
    res.status(500).json({ error: '创建文件记录失败' });
  }
});

/**
 * GET /api/local/dse-files
 * 获取用户的文件列表
 */
router.get('/', (req, res) => {
  try {
    const userId = req.query.user_id as string;
    if (!userId) {
      res.status(400).json({ error: 'user_id 为必填' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 200;
    const offset = parseInt(req.query.offset as string) || 0;
    const files = dseFileDAO.getByUserId(userId, limit, offset);
    res.json(files);
  } catch (error) {
    console.error('[DSE] 获取文件列表失败:', error);
    res.status(500).json({ error: '获取文件列表失败' });
  }
});

/**
 * GET /api/local/dse-files/stats
 * 获取用户的文件统计
 */
router.get('/stats', (req, res) => {
  try {
    const userId = req.query.user_id as string;
    if (!userId) {
      res.status(400).json({ error: 'user_id 为必填' });
      return;
    }

    const stats = dseFileDAO.getStatsByUserId(userId);
    res.json(stats);
  } catch (error) {
    console.error('[DSE] 获取文件统计失败:', error);
    res.status(500).json({ error: '获取文件统计失败' });
  }
});

/**
 * GET /api/local/dse-files/dataset/:datasetId
 * 获取数据集的所有文件
 */
router.get('/dataset/:datasetId', (req, res) => {
  try {
    const files = dseFileDAO.getByDatasetId(req.params.datasetId);
    res.json(files);
  } catch (error) {
    console.error('[DSE] 获取数据集文件失败:', error);
    res.status(500).json({ error: '获取数据集文件失败' });
  }
});

/**
 * DELETE /api/local/dse-files/:id
 * 删除单个文件
 */
router.delete('/:id', (req, res) => {
  try {
    const success = dseFileDAO.delete(req.params.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '文件不存在' });
    }
  } catch (error) {
    console.error('[DSE] 删除文件失败:', error);
    res.status(500).json({ error: '删除文件失败' });
  }
});

/**
 * DELETE /api/local/dse-files/dataset/:datasetId
 * 删除数据集的所有文件
 */
router.delete('/dataset/:datasetId', (req, res) => {
  try {
    const count = dseFileDAO.deleteByDatasetId(req.params.datasetId);
    res.json({ success: true, deletedCount: count });
  } catch (error) {
    console.error('[DSE] 删除数据集文件失败:', error);
    res.status(500).json({ error: '删除数据集文件失败' });
  }
});

export default router;
