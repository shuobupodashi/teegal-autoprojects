/**
 * DSE (Data Storage Environment) Tools
 * 数据环境工具集
 *
 * - list_cloud_files: 查询用户已上传的云端文件 URL 列表
 */

import { AutoStep, AutoToolResult } from "../auto/types";

// 🔥 开发环境通过 Vite proxy（/api/ecs-worker → localhost:3002）
// 🔥 生产环境直接请求 local-backend（localhost:3001/api/local）
const getDseFilesUrl = () => {
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
  return isDev ? '/api/ecs-worker/api/local/dse-files' : 'http://localhost:3001/api/local/dse-files';
};

// ============================================================================
// list_cloud_files
// ============================================================================

/**
 * 查询用户已上传的云端文件 URL 列表
 *
 * LLM 在写训练代码时调用此工具，获取用户的云端文件 OSS URL，
 * 自动将数据 URL 嵌入代码中。
 *
 * 用法: list_cloud_files()
 *       list_cloud_files(file_type='image')
 *       list_cloud_files(dataset_id='xxx')
 */
export async function executeListCloudFilesTool(
  step: AutoStep,
  _planId: string,
  context?: { userId?: string }
): Promise<AutoToolResult> {
  const params = step.toolParams || step.parameters || {};
  const userId = context?.userId || params?.user_id || params?.userId;

  if (!userId) {
    return {
      success: false,
      error: "缺少 userId。用法: list_cloud_files()",
    };
  }

  try {
    const fileType = params?.file_type || params?.fileType || '';
    const datasetId = params?.dataset_id || params?.datasetId || '';

    let url = `${getDseFilesUrl()}?user_id=${userId}&limit=200`;
    if (datasetId) {
      url = `${getDseFilesUrl()}/dataset/${datasetId}`;
    }

    const resp = await fetch(url);
    if (!resp.ok) {
      return {
        success: false,
        error: `查询云端文件失败: HTTP ${resp.status}`,
      };
    }

    let files: any[] = await resp.json();

    // 按文件类型过滤
    if (fileType) {
      files = files.filter((f: any) => f.file_type === fileType);
    }

    if (files.length === 0) {
      return {
        success: true,
        data: {
          type: 'cloudFileList',
          files: [],
          fileCount: 0,
          message: `用户暂无云端文件。请提示用户先在"云端文件"面板上传文件，再编写训练代码。`,
        },
      };
    }

    // 构造 LLM 友好的摘要
    const fileList = files.map((f: any) => ({
      file_name: f.file_name,
      file_type: f.file_type,
      file_size: f.file_size,
      oss_url: f.oss_url,
      dataset_name: f.dataset_name || null,
    }));

    // 按类型分组统计
    const typeCounts: Record<string, number> = {};
    files.forEach((f: any) => {
      typeCounts[f.file_type] = (typeCounts[f.file_type] || 0) + 1;
    });
    const typeSummary = Object.entries(typeCounts)
      .map(([type, count]) => `${type}: ${count}个`)
      .join(', ');

    let message = `用户有 ${files.length} 个云端文件（${typeSummary}）：\n\n`;
    files.slice(0, 50).forEach((f: any, i: number) => {
      const sizeStr = f.file_size < 1024 * 1024
        ? `${(f.file_size / 1024).toFixed(1)}KB`
        : `${(f.file_size / (1024 * 1024)).toFixed(1)}MB`;
      message += `${i + 1}. ${f.file_name} (${f.file_type}, ${sizeStr})\n   URL: ${f.oss_url}\n`;
    });

    if (files.length > 50) {
      message += `\n... 还有 ${files.length - 50} 个文件`;
    }

    message += `\n\n💡 在训练代码中直接用这些 URL 下载数据。可选参数：file_type（按类型过滤，如 zip/csv/image）、dataset_id。`;
    message += `\n⚠️ 网络能力差异：阿里ECI训练机为封闭网络，只能下载内网URL（用户上传的OSS文件），公网URL（含预置数据集链接）不可用；腾讯云机子可下载公网URL。`;

    return {
      success: true,
      data: {
        type: 'cloudFileList',
        files: fileList,
        fileCount: files.length,
        typeSummary,
        message,
      },
    };
  } catch (error) {
    console.error('[LIST-CLOUD-FILES] 异常:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "查询云端文件失败",
    };
  }
}
