/**
 * ProjectPackager - 项目文件打包工具
 * 
 * 🔥 将整个项目目录打包成 zip 格式，用于发送给后端执行
 * 
 * 流程：
 * 1. 扫描 apps/{appId} 目录下所有文件
 * 2. 排除 history 目录和隐藏文件
 * 3. 打包成 zip（base64 编码）
 * 4. 返回打包结果
 */

import pako from 'pako';
import { getAppBasePath } from './AppPathHelper';

// 🔥 文件信息
export interface ProjectFile {
  path: string;           // 相对路径，如 "utils/helper.py"
  content: string;        // 文件内容
  size: number;           // 文件大小
}

// 🔥 打包结果
export interface ProjectPackage {
  appId: string;
  files: ProjectFile[];   // 文件列表
  mainFile: string;       // 主入口文件
  totalSize: number;      // 总大小
  zipBase64: string;      // zip 文件的 base64 编码
  entryPoint: string;     // 执行入口
}

/**
 * 🔥 扫描项目目录，获取所有文件
 */
export async function scanProjectFiles(appId: string): Promise<ProjectFile[]> {
  const electron = (window as any).electron;
  
  if (!electron?.readDirectory) {
    console.warn('[ProjectPackager] 非 Electron 环境，无法扫描目录');
    return [];
  }

  const projectDir = await getAppBasePath(appId);

  console.log(`[ProjectPackager] 扫描项目目录: ${projectDir}`);

  const files: ProjectFile[] = [];

  // 递归扫描目录
  const scanDir = async (dir: string, relativePath: string = '') => {
    try {
      const result = await electron.readDirectory(dir);
      
      if (!result.success || !result.files) {
        return;
      }

      for (const item of result.files) {
        // 跳过隐藏文件
        if (item.name.startsWith('.')) continue;
        // 跳过 history 目录
        if (item.name === 'history') continue;
        // 跳过 node_modules
        if (item.name === 'node_modules') continue;
        // 跳过 __pycache__
        if (item.name === '__pycache__') continue;

        const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;

        if (item.type === 'directory') {
          // 递归扫描子目录
          await scanDir(item.path, itemRelativePath);
        } else if (item.type === 'file') {
          // 读取文件内容
          try {
            const readResult = await electron.userpcFile?.read(item.path);
            const content = readResult?.data?.content || readResult?.content || '';
            
            files.push({
              path: itemRelativePath,
              content,
              size: content.length,
            });
            
            console.log(`[ProjectPackager] 读取文件: ${itemRelativePath} (${content.length} 字符)`);
          } catch (error) {
            console.warn(`[ProjectPackager] 读取文件失败: ${itemRelativePath}`, error);
          }
        }
      }
    } catch (error) {
      console.error(`[ProjectPackager] 扫描目录失败: ${dir}`, error);
    }
  };

  await scanDir(projectDir);

  console.log(`[ProjectPackager] 扫描完成: ${files.length} 个文件`);
  return files;
}

/**
 * 🔥 检测主入口文件
 * 
 * 优先级：
 * 1. main.py
 * 2. train.py
 * 3. app.py
 * 4. run.py
 * 5. 第一个 .py 文件
 */
export function detectMainFile(files: ProjectFile[]): string {
  const priorities = ['main.py', 'train.py', 'app.py', 'run.py', 'start.py'];
  
  for (const name of priorities) {
    const file = files.find(f => f.path === name || f.path.endsWith(`/${name}`));
    if (file) {
      return file.path;
    }
  }
  
  // 返回第一个 .py 文件
  const pyFile = files.find(f => f.path.endsWith('.py'));
  return pyFile?.path || 'main.py';
}

/**
 * 🔥 创建 zip 文件（JSON 格式，base64 编码）
 * 
 * 🔥 修复：使用 JSON 格式，与后端 GpuWrapper.ts 的 wrapMultiFileCode 期望格式一致
 */
export function createZipBase64(files: ProjectFile[]): string {
  // 🔥 使用 JSON 格式，后端期望的格式是 [{path: "...", content: "..."}]
  const jsonData = files.map(f => ({
    path: f.path,
    content: f.content,
  }));
  
  const jsonStr = JSON.stringify(jsonData);
  
  // 编码为 base64
  return btoa(unescape(encodeURIComponent(jsonStr)));
}

/**
 * 🔥 解析打包内容（用于调试）
 * 
 * 🔥 修复：支持 JSON 格式解析
 */
export function parseZipBase64(zipBase64: string): ProjectFile[] {
  try {
    const jsonStr = decodeURIComponent(escape(atob(zipBase64)));
    const jsonData = JSON.parse(jsonStr);
    
    if (!Array.isArray(jsonData)) {
      console.error('[ProjectPackager] JSON 格式错误：不是数组');
      return [];
    }
    
    return jsonData.map((item: any) => ({
      path: item.path || '',
      content: item.content || '',
      size: (item.content || '').length,
    }));
  } catch (error) {
    console.error('[ProjectPackager] 解析失败:', error);
    return [];
  }
}

/**
 * 🔥 打包整个项目
 */
export async function packageProject(appId: string): Promise<ProjectPackage> {
  console.log(`[ProjectPackager] 开始打包项目: ${appId}`);
  
  // 1. 扫描文件
  const files = await scanProjectFiles(appId);
  
  if (files.length === 0) {
    throw new Error('项目目录为空，无法打包');
  }
  
  // 2. 检测主入口
  const mainFile = detectMainFile(files);
  
  // 3. 计算总大小
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  
  // 4. 打包成 base64
  const zipBase64 = createZipBase64(files);
  
  console.log(`[ProjectPackager] 打包完成: ${files.length} 个文件, 总大小 ${totalSize} 字符, base64 长度 ${zipBase64.length}`);
  
  return {
    appId,
    files,
    mainFile,
    totalSize,
    zipBase64,
    entryPoint: mainFile,
  };
}

/**
 * 🔥 获取项目的代码内容（兼容旧逻辑）
 * 
 * 如果项目只有一个文件，返回该文件内容
 * 如果项目有多个文件，返回打包后的 base64
 */
export async function getProjectCode(appId: string): Promise<{
  code: string;
  isMultiFile: boolean;
  files: ProjectFile[];
  mainFile: string;
  zipBase64?: string;
}> {
  const files = await scanProjectFiles(appId);
  
  if (files.length === 0) {
    return {
      code: '',
      isMultiFile: false,
      files: [],
      mainFile: '',
    };
  }
  
  if (files.length === 1) {
    // 单文件：直接返回内容
    return {
      code: files[0].content,
      isMultiFile: false,
      files,
      mainFile: files[0].path,
    };
  }
  
  // 多文件：打包
  const mainFile = detectMainFile(files);
  const zipBase64 = createZipBase64(files);
  
  return {
    code: zipBase64,
    isMultiFile: true,
    files,
    mainFile,
    zipBase64,
  };
}

export default {
  scanProjectFiles,
  detectMainFile,
  createZipBase64,
  parseZipBase64,
  packageProject,
  getProjectCode,
};
