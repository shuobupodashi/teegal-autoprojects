/**
 * List GPU Types Tool
 * 查询 GPU 类型列表工具 - 返回当前维护的 GPU 实例规格
 *
 * 功能：
 * 1. 返回所有支持的 GPU 类型（阿里云、腾讯云）
 * 2. 查询实时可用性，标注售罄状态
 * 3. 返回简洁文本给 LLM（不浪费 token）
 */

import { AutoStep, AutoToolResult } from '../auto/types';
import { getBackendUrl } from '@/config/env';

/**
 * GPU 规格（从后端 API 获取）
 */
interface GpuSpecFromApi {
  provider: string;
  providerDisplayName: string;
  gpuType: string;
  instanceType: string;
  pricePerHour: number;
  gpuCount: number;
  vcpuCount: number;
  memoryGB: number;
}

/**
 * 🔥 训练镜像环境说明（所有 GPU 规格共用同一镜像，阿里云/腾讯云同源）
 * 只说明镜像里有什么，LLM 据此自行推断能训什么；控制在 200 字内
 */
const TRAINING_IMAGE_ENV_LINES: string[] = [
  '训练镜像（所有GPU同一镜像，阿里/腾讯同源）：Python 3.10 + PyTorch 2.1.0(CUDA 12.1)。预装 ultralytics(YOLO，权重内置/app/weights/yolov8n.pt与yolov8s.pt)、transformers/accelerate/datasets/diffusers/peft、sklearn/pandas/matplotlib、gymnasium/stable-baselines3/tianshou、torch_geometric。',
  '⚠️ 阿里云为封闭网络：不能pip install、不能访问外部URL；腾讯云无此限制。训练产物一律写入 /tmp/output/。',
];

/**
 * 查询 GPU 类型列表（含实时可用性）
 * @param step 工具步骤
 * @returns GPU 类型列表（简洁文本）
 */
export async function listGpuTypes(step: AutoStep): Promise<AutoToolResult> {
  console.log(`[LIST_GPU_TYPES] 开始查询 GPU 类型列表`);

  // 🔥 从 API 获取 GPU 规格列表
  let specsFromApi: GpuSpecFromApi[] = [];
  try {
    const resp = await fetch(`${getBackendUrl()}/api/code-execution/gpu-specs`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.specs) {
        specsFromApi = data.specs;
      }
    }
  } catch (error) {
    console.warn('[LIST_GPU_TYPES] 获取规格列表失败:', error);
  }

  if (specsFromApi.length === 0) {
    return {
      success: false,
      data: { text: '无法获取 GPU 规格列表' },
    };
  }

  // 🔥 查询实时可用性（只判断有卡/售罄，不返回区域）
  let availableSet: Record<string, Set<string>> = {};
  try {
    const resp = await fetch(`${getBackendUrl()}/api/code-execution/gpu-availability`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.availability) {
        for (const providerData of data.availability) {
          const provider = providerData.provider;
          availableSet[provider] = new Set();
          for (const item of providerData.items || []) {
            if (item.available) {
              availableSet[provider].add(item.instanceType);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('[LIST_GPU_TYPES] 查询可用性失败:', error);
  }

  const hasAvailabilityData = Object.keys(availableSet).length > 0;

  // 🔥 按 providerDisplayName 分组
  const groupedSpecs: Record<string, GpuSpecFromApi[]> = {};
  for (const spec of specsFromApi) {
    const key = spec.providerDisplayName;
    if (!groupedSpecs[key]) groupedSpecs[key] = [];
    groupedSpecs[key].push(spec);
  }

  // 🔥 构建简洁文本（不返回 JSON，不浪费 token）
  const lines: string[] = [];
  
  for (const [providerName, specs] of Object.entries(groupedSpecs)) {
    lines.push(`${providerName} GPU 规格：`);
    
    for (const spec of specs) {
      const providerAvail = availableSet[spec.provider];
      const isCpu = spec.gpuType === 'CPU';
      let status = '';

      if (hasAvailabilityData && providerAvail) {
        status = providerAvail.has(spec.instanceType) ? (isCpu ? '[可开]' : '[有卡]') : '[售罄]';
      } else if (hasAvailabilityData) {
        status = '[售罄]';
      } else {
        status = '[未知]';
      }

      // 格式：T4×1 (ecs.gn6i-c4g1.xlarge) ¥10/小时 [有卡]
      const label = isCpu ? 'CPU（通用计算）' : `${spec.gpuType}×${spec.gpuCount}`;
      lines.push(`- ${label} (${spec.instanceType}) ¥${spec.pricePerHour}/小时 ${status}`);
    }
    
    lines.push(''); // 空行分隔
  }

  // 🔥 附上训练镜像环境说明（LLM 据此判断什么能训、怎么写训练代码）
  lines.push(...TRAINING_IMAGE_ENV_LINES);
  lines.push('');

  lines.push('提示：选择 instanceType 启动训练，优先选 [有卡] 的规格。');
  lines.push('⚠️ 与用户沟通时，不要提及云厂商(provider)和实例编码(instanceType)，只说GPU类型(如T4/A10/V100)和价格即可，避免暴露GPU来源。');

  const text = lines.join('\n');

  console.log(`[LIST_GPU_TYPES] 查询完成：${specsFromApi.length} 种 GPU 规格`);

  return {
    success: true,
    data: { text },
  };
}