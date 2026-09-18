/**
 * 本地存储路由注册
 */

import express from 'express';
import conversationsRouter from './conversations';
import desktopAppsRouter from './desktopApps';
import trainingTasksRouter from './trainingTasks';
import executionLogsRouter from './executionLogs';
import dseFilesRouter from './dseFiles';
import credentialsRouter from './credentials';

const router = express.Router();

// 挂载子路由
router.use('/conversations', conversationsRouter);
router.use('/desktop-apps', desktopAppsRouter);
router.use('/training-tasks', trainingTasksRouter);
router.use('/execution-logs', executionLogsRouter);
router.use('/dse-files', dseFilesRouter);
router.use('/credentials', credentialsRouter);

export default router;
