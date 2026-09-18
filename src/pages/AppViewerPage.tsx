/**
 * 🔥 项目查看器独立窗口页面（浏览器式多 tab）
 * Electron 下点击项目卡片时在独立 BrowserWindow 中打开；窗口已存在时新项目以 tab 加入
 * 路由: #/app-viewer?appId=xxx&name=xxx
 * 窗口标题固定为 WorkBees（项目名在 tab 和 viewer 内显示，改名互不影响）
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, Minus, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DesktopAppViewer } from '@/components/workspace/DesktopModule/DesktopAppViewer';
import { useAuth } from '@/context/AuthContext';

interface AppTab {
  appId: string;
  name: string;
}

const AppViewerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initAppId = searchParams.get('appId') || '';
  const initName = searchParams.get('name') || '';
  const conversationId = searchParams.get('conversationId') || null;
  const { user } = useAuth();

  // 🔥 多 tab 状态：初始 tab 来自 URL，后续 tab 来自主进程 IPC
  const [tabs, setTabs] = useState<AppTab[]>(initAppId ? [{ appId: initAppId, name: initName }] : []);
  const [activeAppId, setActiveAppId] = useState<string>(initAppId);

  const isElectron = typeof window !== 'undefined' && (window as any).electron?.isElectron;
  const isMac = isElectron && (window as any).electron?.platform === 'darwin';
  const [isMaximized, setIsMaximized] = useState(false);

  // 监听最大化状态
  useEffect(() => {
    if (!isElectron) return;
    const check = async () => {
      if ((window as any).electron?.window) {
        setIsMaximized(await (window as any).electron.window.isMaximized());
      }
    };
    check();
    const interval = setInterval(check, 500);
    return () => clearInterval(interval);
  }, [isElectron]);

  // 🔥 监听主进程"新增 tab"（点击另一个项目卡片时）
  useEffect(() => {
    const electron = (window as any).electron;
    if (!electron?.onAddAppTab) return;
    return electron.onAddAppTab(({ appId, name }: { appId: string; name?: string }) => {
      setTabs(prev => {
        if (prev.some(t => t.appId === appId)) {
          return prev; // 已打开：仅激活（下方 setActiveAppId）
        }
        return [...prev, { appId, name: name || '' }];
      });
      setActiveAppId(appId);
    });
  }, []);

  // 🔥 通过 localStorage storage 事件通知主窗口刷新项目列表（跨窗口）
  const notifyMainWindow = useCallback((appId: string) => {
    try {
      localStorage.setItem('desktopAppUpdatedSignal', JSON.stringify({ appId, t: Date.now() }));
    } catch { /* 忽略 */ }
  }, []);

  // 关闭单个 tab：全部关闭则关窗口
  const closeTab = useCallback((appId: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.appId === appId);
      const next = prev.filter(t => t.appId !== appId);
      if (appId === activeAppId) {
        // 激活相邻 tab；没有 tab 则关窗口
        if (next.length === 0) {
          (window as any).electron?.window?.close();
        } else {
          const fallback = next[Math.min(idx, next.length - 1)];
          setActiveAppId(fallback.appId);
        }
      }
      notifyMainWindow(appId); // 关 tab 也刷新主窗口列表（项目可能被改过）
      return next;
    });
  }, [activeAppId, notifyMainWindow]);

  // 窗口关闭前通知主窗口刷新
  useEffect(() => {
    const handler = () => tabs.forEach(t => notifyMainWindow(t.appId));
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [tabs, notifyMainWindow]);

  if (!initAppId) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        缺少 appId 参数
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
      {/* 🔥 Chrome 式顶栏：tab 直接顶格（项目名在 tab 上），右侧窗口控制，无独立标题栏 */}
      <div
        className="flex items-end gap-1 px-2 pt-1.5 bg-gray-50 border-b flex-shrink-0"
        style={isElectron ? { WebkitAppRegion: 'drag' } as any : {}}
      >
        {/* macOS 红绿灯留白 */}
        {isMac && <div className="w-16 shrink-0" />}

        {/* 项目 tab 栏（浏览器式）—— 🔥 no-drag：drag 区会吞掉 tab 点击/关闭事件；tab 区不拉伸，右侧留 drag 空白 */}
        <div
          className="flex items-end gap-1 min-w-0 overflow-x-auto shrink"
          style={isElectron ? { WebkitAppRegion: 'no-drag' } as any : {}}
        >
          {tabs.map(tab => (
            <div
              key={tab.appId}
              onClick={() => setActiveAppId(tab.appId)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg cursor-pointer text-xs max-w-44 min-w-0 transition-colors ${
                tab.appId === activeAppId
                  ? 'bg-white text-gray-800 border border-b-0 border-gray-200 font-medium'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="truncate select-none">{tab.name || tab.appId.slice(0, 8)}</span>
              {/* 🔥 常显 ghost 关闭按钮（不依赖 hover，避免用户找不到） */}
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.appId); }}
                className={`shrink-0 flex items-center justify-center h-4 w-4 rounded transition-colors ${
                  tab.appId === activeAppId
                    ? 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                    : 'text-gray-400 hover:bg-gray-300 hover:text-gray-600'
                }`}
                title="关闭"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* 🔥 drag 垫片：tab 右侧空白区拖动窗口（Chrome 式），最少留 80px 保证抓得到 */}
        <div className="flex-1 min-w-20 h-full" />

        {/* 右侧窗口控制 */}
        <div
          className="flex items-center gap-1 self-center pl-1 shrink-0"
          style={isElectron ? { WebkitAppRegion: 'no-drag' } as any : {}}
        >
          {isElectron && !isMac && (
            <>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={() => (window as any).electron?.window?.minimize()}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={() => (window as any).electron?.window?.maximize()}>
                <Square className={`h-3 w-3 ${isMaximized ? 'rotate-90' : ''}`} />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-red-500 hover:text-white"
                onClick={() => (window as any).electron?.window?.close()}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Viewer 主体：全部保持挂载（keep-alive），激活的显示，其余隐藏——切换 tab 不丢编辑状态 */}
      <div className="flex-1 min-h-0 relative">
        {tabs.map(tab => (
          <div key={tab.appId} className="absolute inset-0" style={{ display: tab.appId === activeAppId ? 'block' : 'none' }}>
            <DesktopAppViewer
              appId={tab.appId}
              userId={user?.id || ''}
              isOpen={tab.appId === activeAppId}
              onClose={() => closeTab(tab.appId)}
              onAppUpdated={() => notifyMainWindow(tab.appId)}
              conversationId={conversationId}
              embedded
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppViewerPage;
