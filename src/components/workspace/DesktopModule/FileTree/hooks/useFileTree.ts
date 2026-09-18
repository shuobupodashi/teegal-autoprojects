/**
 * 文件树状态管理 Hook
 * 
 * 🔥 简化架构：
 * - files/ 目录：当前工作目录（最新版本）
 * - history/ 目录：上一个 commit 版本（每个文件只保留一个版本）
 * 
 * 🔥 跨平台：所有目录操作通过 Electron IPC API（read-directory），
 * 不依赖 PowerShell/Bash 命令，Windows/macOS/Linux 通用。
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { FileNode, FileHistory, FileVersion, FileTreeState } from '../types';
import { sortFileNodes, filterFileNodes } from '../utils';
import { getAppBasePath, getAppHistoryPath } from '@/utils/apptool/AppPathHelper';

/**
 * 🔥 模块级缓存：按 appId 缓存文件树数据
 * 
 * 避免每次打开 Dialog 都重新扫描目录：
 * - 首次打开：正常加载（显示 loading）
 * - 再次打开：立即返回缓存数据，后台静默刷新
 */
interface FileTreeCache {
  files: FileNode[];
  history: FileHistory[];
  timestamp: number;
}
const fileTreeCache = new Map<string, FileTreeCache>();

const CACHE_TTL = 30 * 1000; // 30秒内不重复加载

export function useFileTree(appId: string) {
  const [state, setState] = useState<FileTreeState>(() => {
    // 🔥 初始化时先读缓存，避免白屏
    const cached = fileTreeCache.get(appId);
    if (cached) {
      return {
        files: cached.files,
        history: cached.history,
        loading: false, // 有缓存时不显示 loading
        error: '',
      };
    }
    return {
      files: [],
      history: [],
      loading: true,
      error: '',
    };
  });

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // 🔥 使用 ref 保存最新的 expandedDirs，避免 refresh 函数依赖 expandedDirs 导致频繁重建
  const expandedDirsRef = useRef(expandedDirs);
  useEffect(() => {
    expandedDirsRef.current = expandedDirs;
  }, [expandedDirs]);

  /**
   * 加载文件树
   */
  const loadFileTree = useCallback(async (silent = false) => {
    if (!appId) return;

    // 🔥 检查缓存是否未过期，未过期则跳过
    const cached = fileTreeCache.get(appId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[FileTree] 使用缓存，跳过加载:', appId);
      setState({
        files: cached.files,
        history: cached.history,
        loading: false,
        error: '',
      });
      return;
    }

    // 🔥 silent 模式不设置 loading: true，避免子组件（ChangeList）因卸载丢失状态
    if (!silent) {
      setState(prev => ({ ...prev, loading: true, error: '' }));
    }

    try {
      const electron = (window as any).electron;

      // 🔥 获取文件目录（支持导入项目的自定义路径）
      const filesDir = await getAppBasePath(appId);
      const historyDir = await getAppHistoryPath(appId);

      // 🔥 加载 files 目录（当前版本，排除 history 子目录）
      const allFiles = await scanDirectory(filesDir);
      const files = allFiles.filter(f => f.name !== 'history'); // 🔥 排除 history 目录

      // 🔥 加载 history 目录（每个文件只保留一个版本）
      const history = await scanHistoryDirectory(historyDir);

      const sortedFiles = sortFileNodes(filterFileNodes(files));
      const sortedHistory = history.sort((a, b) => a.fileName.localeCompare(b.fileName));

      setState({
        files: sortedFiles,
        history: sortedHistory,
        loading: false,
        error: '',
      });

      // 🔥 写入缓存
      fileTreeCache.set(appId, {
        files: sortedFiles,
        history: sortedHistory,
        timestamp: Date.now(),
      });

      console.log('[FileTree] 加载完成:', { filesCount: sortedFiles.length, historyCount: sortedHistory.length });

    } catch (error: any) {
      console.error('[FileTree] 加载失败:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || '加载文件树失败',
      }));
    }
  }, [appId]);

  /**
   * 扫描目录
   * 🔥 跨平台：使用 Electron IPC API（read-directory），不依赖 PowerShell
   */
  const scanDirectory = async (dir: string): Promise<FileNode[]> => {
    try {
      const electron = (window as any).electron;

      if (electron?.readDirectory) {
        const result = await electron.readDirectory(dir);
        if (result.success && result.files) {
          return result.files.map((f: any) => ({
            name: f.name,
            path: f.path,
            relativePath: f.relativePath || f.name,
            type: f.type,
            ext: f.ext,
            size: f.size,
            children: f.children,
          }));
        }
      }

      return [];

    } catch (error) {
      console.error('[FileTree] 扫描目录失败:', dir, error);
      return [];
    }
  };

  /**
   * 🔥 扫描 history 目录（每个文件只保留一个版本）
   * 🔥 支持嵌套目录结构：history/DRL/main.py/v1.py
   */
  const scanHistoryDirectory = async (dir: string): Promise<FileHistory[]> => {
    try {
      const electron = (window as any).electron;

      // 🔥 检查 history 目录是否存在
      if (electron?.readDirectory) {
        const result = await electron.readDirectory(dir);
        if (!result.success) return [];

        const histories: FileHistory[] = [];

        // 🔥 递归扫描 history 目录，找到所有版本文件
        await scanHistoryRecursive(dir, '', histories);

        return histories;
      }

      return [];

    } catch (error) {
      console.error('[FileTree] 扫描 history 目录失败:', dir, error);
      return [];
    }
  };

  /**
   * 🔥 递归扫描 history 目录
   * 🔥 限制最大递归深度为 5 层，防止目录嵌套过深导致性能问题
   */
  const scanHistoryRecursive = async (
    currentDir: string,
    relativePath: string,
    histories: FileHistory[],
    depth: number = 0
  ): Promise<void> => {
    // 🔥 限制递归深度
    if (depth > 5) {
      console.warn('[FileTree] history 目录嵌套深度超过 5 层，跳过:', currentDir);
      return;
    }

    try {
      const electron = (window as any).electron;

      if (!electron?.readDirectory) return;

      const result = await electron.readDirectory(currentDir);
      if (!result.success || !result.files) return;

      for (const item of result.files) {
        if (item.type === 'directory') {
          // 🔥 继续递归
          const newRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;
          await scanHistoryRecursive(item.path, newRelativePath, histories, depth + 1);
        } else if (item.type === 'file' && item.name.match(/^v\d+\./)) {
          // 🔥 找到版本文件
          // relativePath 就是原始文件路径（如 DRL/main.py）
          const fileName = relativePath || item.name.replace(/^v\d+\./, '');
          
          histories.push({
            fileName: fileName,
            filePath: '',
            version: {
              versionName: item.name,
              path: item.path,
              createdAt: item.modifiedTime || new Date().toISOString(),
            },
          });
        }
      }

    } catch (error) {
      console.error('[FileTree] 递归扫描 history 失败:', currentDir, error);
    }
  };

  /**
   * 展开/折叠目录
   */
  const toggleDir = useCallback(async (path: string) => {
    const isCurrentlyExpanded = expandedDirs.has(path);
    
    if (isCurrentlyExpanded) {
      // 折叠
      setExpandedDirs(prev => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    } else {
      // 展开 - 先加载子目录
      await loadSubDirectory(path);
      setExpandedDirs(prev => {
        const newSet = new Set(prev);
        newSet.add(path);
        return newSet;
      });
    }
  }, [expandedDirs]);

  /**
   * 加载子目录
   */
  const loadSubDirectory = async (dirPath: string) => {
    try {
      const electron = (window as any).electron;

      if (!electron?.readDirectory) return;

      const result = await electron.readDirectory(dirPath);
      if (!result.success || !result.files) return;

      // 找到对应的节点并添加 children
      setState(prev => {
        const updateNodeChildren = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.path === dirPath) {
              // 找到目标节点，添加 children
              return {
                ...node,
                children: result.files.map((f: any) => ({
                  name: f.name,
                  path: f.path,
                  relativePath: f.relativePath || f.name,
                  type: f.type,
                  ext: f.ext,
                  size: f.size,
                  children: f.type === 'directory' ? [] : undefined,
                })),
              };
            }
            if (node.children) {
              return {
                ...node,
                children: updateNodeChildren(node.children),
              };
            }
            return node;
          });
        };

        return {
          ...prev,
          files: updateNodeChildren(prev.files),
        };
      });

    } catch (error) {
      console.error('[FileTree] 加载子目录失败:', dirPath, error);
    }
  };

  /**
   * 判断目录是否展开
   */
  const isDirExpanded = useCallback((path: string) => {
    return expandedDirs.has(path);
  }, [expandedDirs]);

  /**
   * 刷新文件树
   * 🔥 强制刷新（忽略缓存），用于文件变更事件
   * 🔥 使用 ref 读取 expandedDirs，避免函数依赖 expandedDirs 导致重建
   */
  const refresh = useCallback(async () => {
    // 🔥 强制刷新前清除缓存
    fileTreeCache.delete(appId);

    // 🔥 保存当前展开的目录（从 ref 读取）
    const currentExpandedDirs = new Set(expandedDirsRef.current);

    // 🔥 静默刷新：不设 loading: true，避免 ChangeList 被卸载丢失 diffStats
    await loadFileTree(true);

    // 🔥 重新加载已展开目录的子目录
    for (const dirPath of currentExpandedDirs) {
      await loadSubDirectory(dirPath);
    }

    // 🔥 恢复展开状态
    setExpandedDirs(currentExpandedDirs);
  }, [loadFileTree, appId]);

  /**
   * 初始加载
   * 🔥 只依赖 appId，不依赖 loadFileTree（loadFileTree 只依赖 appId，引用稳定）
   */
  useEffect(() => {
    const cached = fileTreeCache.get(appId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // 🔥 缓存未过期，跳过加载
      console.log('[FileTree] 使用缓存，跳过加载:', appId);
      return;
    }
    // 🔥 无缓存或已过期，静默刷新（不显示 loading，避免闪烁）
    loadFileTree();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  /**
   * 🔥 如果顶层只有一个文件夹，自动展开
   * 多个顶层节点时不自动展开
   */
  const autoExpandedRef = useRef(false);
  useEffect(() => {
    // 🔥 切换 appId 时重置
    autoExpandedRef.current = false;
  }, [appId]);
  useEffect(() => {
    if (state.loading || state.files.length === 0) return;
    if (autoExpandedRef.current) return; // 只自动展开一次

    if (state.files.length === 1 && state.files[0].type === 'directory') {
      autoExpandedRef.current = true;
      const dirPath = state.files[0].path;
      if (!expandedDirs.has(dirPath)) {
        loadSubDirectory(dirPath);
        setExpandedDirs(prev => {
          const newSet = new Set(prev);
          newSet.add(dirPath);
          return newSet;
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loading, state.files]);

  /**
   * 🔥 监听 agent 文件操作事件，自动刷新（带防抖）
   * agent 短时间内可能保存多个文件，防抖避免频繁刷新
   * 🔥 只依赖 appId，refresh 通过 ref 调用，避免函数引用变化导致重新注册
   */
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const handleFilesChanged = (event: CustomEvent) => {
      const { appId: changedAppId } = event.detail || {};
      
      // 只刷新当前 appId 的文件树
      if (changedAppId === appId) {
        // 🔥 防抖：500ms 内多次事件只执行一次刷新
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
        }
        refreshTimerRef.current = setTimeout(() => {
          console.log('[FileTree] 收到文件变更事件，刷新文件树（防抖）');
          refreshRef.current();
          refreshTimerRef.current = null;
        }, 500);
      }
    };

    window.addEventListener('trainProjectFilesChanged', handleFilesChanged as EventListener);
    
    return () => {
      window.removeEventListener('trainProjectFilesChanged', handleFilesChanged as EventListener);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [appId]);

  return {
    ...state,
    expandedDirs,
    toggleDir,
    isDirExpanded,
    refresh,
    loadFileTree,
  };
}

/**
 * 🔥 清除指定 appId 的文件树缓存
 * 在删除应用时调用，避免残留缓存
 */
export function clearFileTreeCache(appId?: string) {
  if (appId) {
    fileTreeCache.delete(appId);
  } else {
    fileTreeCache.clear();
  }
}
