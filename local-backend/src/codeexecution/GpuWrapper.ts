/**
 * GPU 代码包装器服务（简化版）
 * 
 * 🔥 职责（只做预处理 + 注入全局变量）：
 * 1. 注入全局变量 _OUTPUT_DIR, _files, _charts
 * 2. 🔥 替换 OSS/COS 外网 URL 为内网 URL（加速云端访问）
 * 
 * 🔥 不负责（交给 Provider）：
 * - try-except 包装（由 Provider 包装脚本处理）
 * - 生成 result.json（由 Provider 包装脚本生成）
 * - 文件扫描和上传（由 Provider 处理）
 */

import { PROJECT_DIR } from './providers/JobBundleContract';

export interface GpuWrapOptions {
  outputDir: string;  // 输出目录（本地磁盘），如 /tmp/output/
  ossBucket?: string; // OSS/COS bucket 名称（用于 URL 替换）
  ossRegion?: string; // OSS/COS 区域（用于 URL 替换）
  ossAppId?: string;  // 腾讯云 COS AppId（用于 URL 替换）
  provider?: string;  // 云厂商：'aliyun' 或 'tencent'
}

/**
 * 🔥 替换 OSS/COS 外网 URL 为内网 URL
 * 
 * 云端 GPU 实例和 OSS/COS bucket 在同一区域时，使用内网地址更快更省钱
 * 
 * 阿里云 OSS：
 * - 外网：https://bucket.oss-region.aliyuncs.com/path
 * - 内网：https://bucket.oss-region-internal.aliyuncs.com/path
 * 
 * 腾讯云 COS：
 * - 外网：https://bucket-appId.cos.region.myqcloud.com/path
 * - 内网：https://bucket-appId.cos-internal.region.myqcloud.com/path
 */
function replaceOssUrlToInternal(code: string, ossBucket?: string, ossRegion?: string, ossAppId?: string, provider?: string): string {
  if (!ossBucket || !ossRegion) {
    return code; // 没有 OSS 信息，不替换
  }
  
  let replacedCode = code;
  
  // 🔥 阿里云 OSS URL 替换
  if (provider === 'aliyun' || !provider) {
    // 处理 ossRegion 格式（可能缺少 oss- 前缀）
    let normalizedRegion = ossRegion;
    if (!normalizedRegion.startsWith('oss-')) {
      normalizedRegion = `oss-${normalizedRegion}`;
    }
    
    // 替换阿里云 OSS 外网 URL 为内网 URL
    const aliyunPattern = new RegExp(
      `(https?://)${ossBucket}\\.${normalizedRegion}\\.aliyuncs\\.com`,
      'g'
    );
    const aliyunInternalUrl = `${ossBucket}.${normalizedRegion}-internal.aliyuncs.com`;
    replacedCode = replacedCode.replace(aliyunPattern, `$1${aliyunInternalUrl}`);
    
    if (replacedCode !== code) {
      console.log(`[GPU-WRAPPER] 阿里云 OSS URL 已替换为内网地址: ${aliyunInternalUrl}`);
    }
  }
  
  // 🔥 腾讯云 COS URL 替换
  if (provider === 'tencent' && ossAppId) {
    // 腾讯云 COS 外网 URL 格式：bucket-appId.cos.region.myqcloud.com
    const tencentPattern = new RegExp(
      `(https?://)${ossBucket}-${ossAppId}\\.cos\\.${ossRegion}\\.myqcloud\\.com`,
      'g'
    );
    // 腾讯云 COS 内网 URL 格式：bucket-appId.cos-internal.region.myqcloud.com
    const tencentInternalUrl = `${ossBucket}-${ossAppId}.cos-internal.${ossRegion}.myqcloud.com`;
    replacedCode = replacedCode.replace(tencentPattern, `$1${tencentInternalUrl}`);
    
    if (replacedCode !== code) {
      console.log(`[GPU-WRAPPER] 腾讯云 COS URL 已替换为内网地址: ${tencentInternalUrl}`);
    }
  }
  
  return replacedCode;
}

/**
 * 🔥 node 运行时入口判定（按扩展名；TS/JS 全家桶在云端由 node20/tsx 执行）
 */
const NODE_RUNTIME_EXTS = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx'];

export function isNodeEntry(entryPoint: string): boolean {
  const lower = entryPoint.toLowerCase();
  return NODE_RUNTIME_EXTS.some(ext => lower.endsWith(ext));
}

/**
 * 单文件 node 代码的入口名：含 import/export 用 .mjs（ESM），否则 .js（CJS）
 * （dynamic import() 两种模式都可用；require 在 .mjs 下 node20 不可用，故 CJS 优先保 .js）
 */
export function pickNodeSingleFileName(code: string): string {
  return /\b(import\s|import\(|export\s)/.test(code) ? 'main.mjs' : 'main.js';
}

/** node 入口的执行命令：TS/JSX 走 tsx（云端镜像已装），纯 JS 走 node */
function nodeCommandFor(entryPoint: string): string[] {
  const lower = entryPoint.toLowerCase();
  return ['.ts', '.mts', '.cts', '.tsx', '.jsx'].some(ext => lower.endsWith(ext))
    ? ['tsx']
    : ['node'];
}

/**
 * 包装用户代码（GPU 模式）
 *
 * 🔥 注入全局变量：_OUTPUT_DIR, _files, _charts
 * 
 * Provider 包装脚本会处理：
 * - try-except 包装
 * - 生成 result.json（提取 + 扫描填充）
 * - 上传文件
 */
export function wrapUserCodeForGpu(userCode: string, options: GpuWrapOptions): string {
  const { outputDir, ossBucket, ossRegion, ossAppId, provider } = options;

  // 🔥 替换 OSS/COS 外网 URL 为内网 URL（加速云端访问）
  const processedCode = replaceOssUrlToInternal(userCode, ossBucket, ossRegion, ossAppId, provider);

  // 🔥 注入全局变量：_OUTPUT_DIR, _files, _charts
  return `
# ============================================
# GPU 包装代码（预处理 + 注入全局变量）
# ============================================
import os

# 输出目录（用户代码使用此变量保存结果）
_OUTPUT_DIR = "${outputDir}"
os.makedirs(_OUTPUT_DIR, exist_ok=True)

# 🔥 全局变量：用于前端显示模型文件和图表
_files = []
_charts = []

# ============================================
# 用户代码开始
# ============================================
${processedCode}
`;
}

/**
 * 包装多文件项目代码（GPU 模式）
 * 
 * 🔥 注入全局变量 + 创建文件 + 执行入口
 * 
 * 修复：
 * 1. 创建专用项目目录 /tmp/project/，避免文件混杂
 * 2. 修复 os.makedirs('') 空路径 bug（根目录文件如 main.py）
 * 3. os.chdir 到项目目录 + sys.path 注入，确保 import 兄弟模块可用
 * 4. 使用 runpy.run_path 执行入口，保留 __file__ 和模块语义
 */
export function wrapMultiFileCode(codePackage: string, entryPoint: string, outputDir: string, ossBucket?: string, ossRegion?: string, ossAppId?: string, provider?: string): string {
  // 解析 base64 编码的打包内容
  let packageContent: string;
  try {
    packageContent = Buffer.from(codePackage, 'base64').toString('utf-8');
  } catch (e) {
    console.error('[GPU-WRAPPER] 解析打包内容失败:', e);
    return wrapUserCodeForGpu(`print("错误：无法解析打包内容");`, { outputDir, ossBucket, ossRegion, ossAppId, provider });
  }

  // 解析 JSON 格式的打包内容
  let files: { path: string; content: string }[];
  try {
    files = JSON.parse(packageContent);
    if (!Array.isArray(files)) {
      throw new Error('打包内容不是数组');
    }
  } catch (e) {
    console.error('[GPU-WRAPPER] 解析文件列表失败:', e);
    return wrapUserCodeForGpu(`print("错误：无法解析文件列表");`, { outputDir, ossBucket, ossRegion, ossAppId, provider });
  }

  console.log(`[GPU-WRAPPER] 解析打包内容: ${files.length} 个文件, 入口: ${entryPoint}`);

  // 🔥 替换每个文件内容中的 OSS/COS 外网 URL 为内网 URL
  const processedFiles = files.map(f => ({
    path: f.path.replace(/\\/g, '/'),
    content: replaceOssUrlToInternal(f.content, ossBucket, ossRegion, ossAppId, provider),
  }));

  // 🔥 将文件内容编码为 base64，避免特殊字符问题
  const encodedFiles = processedFiles.map(f => ({
    path: f.path,
    contentBase64: Buffer.from(f.content, 'utf-8').toString('base64'),
  }));

  // 🔥 生成创建文件的代码（写入 PROJECT_DIR 目录，路径来自 Job Bundle 契约）
  // 🔥 修复：os.path.dirname 对根目录文件返回空字符串的问题
  const fileCreationCode = encodedFiles.map(f => {
    const filePath = `${PROJECT_DIR}/${f.path}`;
    const dirName = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '';
    const makedirsLine = dirName
      ? `os.makedirs('${PROJECT_DIR}/${dirName}', exist_ok=True)`
      : `os.makedirs('${PROJECT_DIR}', exist_ok=True)`;
    return `
# 创建文件: ${f.path}
${makedirsLine}
with open('${filePath}', 'wb') as _f:
    _f.write(base64.b64decode('${f.contentBase64}'))
`;
  }).join('\n');

  // 🔥 按入口扩展名选运行时：node 全家桶（.js/.mjs/.ts/.tsx…）由 node/tsx 执行，
  //    其余（.py）走 runpy。node 用 subprocess 启动并透传退出码（退出码0=成功，通用协议不变）
  const nodeCmd = nodeCommandFor(entryPoint);
  const execSection = isNodeEntry(entryPoint)
    ? `
import subprocess as _sp
_entry = '${PROJECT_DIR}/${entryPoint}'
_cmd = ${JSON.stringify(nodeCmd)} + [_entry]
_env = dict(os.environ)
_env['TEEGAL_OUTPUT_DIR'] = '${outputDir}'
_proc = _sp.run(_cmd, cwd='${PROJECT_DIR}', env=_env)
sys.exit(_proc.returncode)
`
    : `
import runpy
runpy.run_path('${PROJECT_DIR}/${entryPoint}', run_name='__main__')
`;

  // 🔥 注入全局变量 + 创建文件 + 设置环境 + 执行入口
  return `
# ============================================
# GPU 包装代码（预处理 + 多文件）
# ============================================
import os
import sys
import base64

# 输出目录（用户代码使用此变量保存结果）
_OUTPUT_DIR = "${outputDir}"
os.makedirs(_OUTPUT_DIR, exist_ok=True)

# 🔥 全局变量：用于前端显示模型文件和图表
_files = []
_charts = []

# ============================================
# 创建项目目录并写入文件
# ============================================
os.makedirs('${PROJECT_DIR}', exist_ok=True)
${fileCreationCode}

# ============================================
# 设置执行环境
# ============================================
# 🔥 切换到项目目录，使相对路径（如 open('data.csv')）能正确解析
os.chdir('${PROJECT_DIR}')
# 🔥 将项目目录加入 sys.path，使 import 兄弟模块可用
if '${PROJECT_DIR}' not in sys.path:
    sys.path.insert(0, '${PROJECT_DIR}')

# ============================================
# 执行入口文件（保留 __file__ 和模块语义）
# ============================================
print(f"[teegal] 项目目录: ${PROJECT_DIR}")
print(f"[teegal] 执行入口: ${entryPoint}")
print(f"[teegal] 工作目录: {os.getcwd()}")
print(f"[teegal] 项目文件: ${encodedFiles.map(f => f.path).join(', ')}")

${execSection}
`;
}