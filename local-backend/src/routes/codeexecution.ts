import { Router } from 'express';
import { createDefaultGPUExecutor } from '../codeexecution/GPUExecutorV2';
import { trainingTaskDatabase } from '../codeexecution/TrainingTaskDatabase';
import { desktopAppDAO } from '../local-storage/dao';
import { HostedProxyProvider } from '../codeexecution/providers/HostedProxyProvider';

const router = Router();

const executor = createDefaultGPUExecutor();

export function recoverOrphanTasks() {
  return executor.recoverOrphanTasks();
}

router.post('/execute', async (req, res) => {
  try {
    console.log('📥 [CODE-EXECUTION] 收到执行请求');
    
    const { 
      code, 
      gpuNeeded, 
      gpuInstanceType, 
      gpuProvider, 
      taskId, 
      userId, 
      appId, 
      conversationId, 
      config,
      // 🔥 多文件支持
      isMultiFile,
      codePackage,
      entryPoint,
      mainFile,
      files
    } = req.body;
    
    // 🔥 多文件项目：codePackage 必须存在
    // 单文件项目：code 必须存在
    if (!code && !codePackage) {
      return res.status(400).json({ success: false, error: '代码或代码包不能为空' });
    }

    if (gpuNeeded && taskId) {
      const existingTask = await trainingTaskDatabase.getTask(taskId);
      if (existingTask) {
        if (existingTask.status === 'running' || existingTask.status === 'pending') {
          console.log(`⏳ [CODE-EXECUTION] 任务 ${taskId} 正在执行中，跳过重复启动`);
          return res.json({ 
            success: true, 
            status: existingTask.status, 
            taskId,
            message: '任务已在执行中，请等待结果'
          });
        }
        if (existingTask.status === 'completed') {
          console.log(`✅ [CODE-EXECUTION] 任务 ${taskId} 已有成功结果，返回历史记录`);
          return res.json({
            success: true,
            output: existingTask.stdout_output,
            charts: existingTask.charts_json,
            files: existingTask.files_json,
            taskId,
            executionMode: 'gpu',
            gpuStatus: 'stopped'
          });
        }
      }
    }
    
    const result = await executor.execute({
      code: code || '',  // 🔥 多文件项目可能没有 code
      gpuNeeded: gpuNeeded === true || gpuNeeded === 'true',
      gpuInstanceType,
      gpuProvider: gpuProvider || 'aliyun',
      taskId,
      userId,
      appId,
      conversationId,
      config,
      // 🔥 多文件支持
      isMultiFile: isMultiFile === true || isMultiFile === 'true',
      codePackage,
      entryPoint: entryPoint || mainFile || 'main.py',
      mainFile: mainFile || 'main.py',
    });
    
    console.log('📤 [CODE-EXECUTION] 执行完成', {
      success: result.success,
      executionTime: result.executionTime,
      isMultiFile
    });
    
    if (appId && result.success) {
      try {
        const previewData = {
          output: result.output || '',
          charts: result.charts || [],
          executionTime: result.executionTime,
          timestamp: new Date().toISOString()
        };
        console.log(`💾 [CODE-EXECUTION] 保存预览到数据库: appId=${appId}, charts=${previewData.charts.length}`);
        desktopAppDAO.update(appId, { preview: JSON.stringify(previewData) });
      } catch (saveError) {
        console.error('❌ [CODE-EXECUTION] 保存预览失败:', saveError);
      }
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ [CODE-EXECUTION] 执行错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.post('/stop', async (req, res) => {
  try {
    const { taskId, appId, reason } = req.body;  // 🔥 新增 reason 参数
    console.log(`🛑 [CODE-EXECUTION] 收到停止请求: taskId=${taskId}, appId=${appId}, reason=${reason || '用户停止'}`);

    const success = await executor.stop(taskId, appId, reason);  // 🔥 传入 reason
    res.json({ success });
  } catch (error) {
    console.error('❌ [CODE-EXECUTION] 停止任务失败:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/status/:appId', (req, res) => {
  res.json({ success: true, isAutoRunning: false, message: '自动运行功能已移除' });
});

router.get('/check-package/:packageName', async (req, res) => {
  const { packageName } = req.params;
  
  console.log(`📦 [CODE-EXECUTION] 检查包: ${packageName}`);
  
  res.json({
    success: true,
    packageName,
    message: 'CPU 任务已迁移至前端执行，后端仅保留 GPU 执行功能',
    executionMode: 'frontend'
  });
});

router.post('/check-packages', async (req, res) => {
  const { packageNames } = req.body;
  
  if (!Array.isArray(packageNames) || packageNames.length === 0) {
    return res.status(400).json({ success: false, error: '请提供包名称列表' });
  }
  
  console.log(`📦 [CODE-EXECUTION] 批量检查包: ${packageNames.join(', ')}`);
  
  res.json({
    success: true,
    message: 'CPU 任务已迁移至前端执行，后端仅保留 GPU 执行功能',
    executionMode: 'frontend',
    packages: {}
  });
});

router.get('/env-info', async (req, res) => {
  res.json({
    success: true,
    message: 'CPU 任务已迁移至前端执行，后端支持多云 GPU 执行',
    executionMode: 'frontend',
    gpu: {
      enabled: true,
      providers: ['aliyun', 'tencent']
    }
  });
});

router.get('/gpu-options', async (req, res) => {
  try {
    const options = await executor.queryAllPrices();
    res.json({ success: true, options });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// 🔥 查询 GPU 实例可用性（hosted：可用性由云端查询并标记 provider，本地纯透传分组）
router.get('/gpu-availability', async (req, res) => {
  try {
    const hostedProvider = executor.getProvider('hosted');
    const results: { provider: string; items: any[] }[] = [];
    try {
      const items = await hostedProvider?.checkAllAvailability?.() || [];
      // 🔥 云端条目已带 provider 字段（聚合时由各 provider.name 填充），直接分组透传。
      //    若整体塞进 'hosted' 一组，前端按 spec.provider 匹配不到分组 → 静默降级全部显示可用
      const byProvider: Record<string, any[]> = {};
      for (const item of items as any[]) {
        const prov = item.provider || 'hosted';
        (byProvider[prov] = byProvider[prov] || []).push(item);
      }
      for (const [prov, list] of Object.entries(byProvider)) {
        results.push({ provider: prov, items: list });
      }
    } catch (error) {
      console.error('[GPU-AVAILABILITY] hosted 查询失败:', error);
      // 🔥 查询失败按不可用处理（fail-closed），避免前端误显示全部可用
      results.push({ provider: 'aliyun', items: [] });
      results.push({ provider: 'tencent', items: [] });
    }
    res.json({ success: true, availability: results });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// 🔥 返回 GPU 规格列表（纯透传云端 /specs，唯一权威配置源在 home-web/server）
router.get('/gpu-specs', async (req, res) => {
  try {
    const hostedProvider = executor.getProvider('hosted');
    if (!(hostedProvider instanceof HostedProxyProvider)) {
      return res.status(503).json({ success: false, error: 'hosted Provider 未初始化' });
    }
    const specs = await hostedProvider.fetchSpecs();
    res.json({ success: true, specs });
  } catch (error: any) {
    console.error('[GPU-SPECS] 透传云端规格表失败:', error.message);
    res.status(502).json({ success: false, error: `云端规格表获取失败: ${error.message}` });
  }
});

export default router;