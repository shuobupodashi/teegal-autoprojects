import React, { useRef, useState, useCallback, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Undo2, GitCommit } from 'lucide-react';

interface DiffViewerProps {
  oldCode: string;
  newCode: string;
  onRevert?: () => void; // 🔥 回退回调
  onAccept?: () => void; // 🔥 接受回调（=commit，清空历史版本）
}

interface DiffLine {
  type: 'added' | 'deleted' | 'unchanged';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ 
  oldCode, 
  newCode,
  onRevert,
  onAccept
}) => {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  // 🔥 记录 scroll container 的可视区域高度（减去水平滚动条），用于 minimap 精确映射
  const [viewHeight, setViewHeight] = useState(0);

  // 🔥 同步测量 scroll container 的 clientHeight（包含水平滚动条扣除）
  useLayoutEffect(() => {
    const measure = () => {
      if (scrollContainerRef.current) {
        setViewHeight(scrollContainerRef.current.clientHeight);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (scrollContainerRef.current) {
      observer.observe(scrollContainerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // 🔥 滚动时更新位置，驱动 minimap viewport indicator 同步
  // ⚠️ 必须放在下方两个 early return 之前：否则"无历史版本/代码一致"的渲染只执行 6 个 hook，
  // 加载到历史版本后走完整路径变成 7 个 → hook 数不一致 → React error #300（Rendered more hooks）
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setScrollTop(scrollContainerRef.current.scrollTop);
    }
  }, []);

  // 1. 如果没有历史版本
  if (!oldCode) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/50">
        <div className="text-sm font-medium">暂无历史版本记录</div>
      </div>
    );
  }

  // 2. 如果代码完全一致（先标准化行尾符再比较）
  const normalize = (s: string) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalize(oldCode) === normalize(newCode)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/50">
        <div className="text-sm font-medium">当前版本与上一版本完全一致</div>
      </div>
    );
  }

  // 🔥 标准化行尾符：CRLF→LF，去除行尾空白，避免行尾差异导致整文件重写
  const normalizeLine = (line: string) => line.replace(/\r$/, '').trimEnd();
  const oldLines = oldCode.split('\n').map(normalizeLine);
  const newLines = newCode.split('\n').map(normalizeLine);
  
  // 使用动态规划思想实现最长公共子序列算法来辅助diff
  const m = oldLines.length;
  const n = newLines.length;
  
  // 创建二维数组记录LCS
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // 根据LCS回溯找出差异
  const diffLines: DiffLine[] = [];
  let i = m, j = n;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // 相同行
      diffLines.unshift({
        type: 'unchanged',
        oldLineNumber: i,
        newLineNumber: j,
        content: oldLines[i - 1]
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // 新增行
      diffLines.unshift({
        type: 'added',
        oldLineNumber: null,
        newLineNumber: j,
        content: newLines[j - 1]
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      // 删除行
      diffLines.unshift({
        type: 'deleted',
        oldLineNumber: i,
        newLineNumber: null,
        content: oldLines[i - 1]
      });
      i--;
    }
  }

  // 🔥 统计新增/删除行数
  const addedCount = diffLines.filter(l => l.type === 'added').length;
  const deletedCount = diffLines.filter(l => l.type === 'deleted').length;

  // 🔥 点击 minimap 跳转（点击位置居中显示，基于 viewHeight 映射区域）
  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    
    const scrollContainer = scrollContainerRef.current;
    const mapHeight = viewHeight || rect.height; // 🔥 用 scroll container 的可视高度，而非 minimap 高度
    const percentage = clickY / mapHeight;
    
    const scrollRange = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    scrollContainer.scrollTop = percentage * scrollRange - scrollContainer.clientHeight / 2;
  };

  // 🔥 滚动回调已移至组件顶部（early return 之前），见上方 handleScroll 定义

  return (
    <div className="diff-viewer w-full h-full bg-white overflow-hidden flex flex-col relative">
      {/* 🔥 顶部工具栏：回退 + 接受按钮 */}
      {(onRevert || onAccept) && (
        <div className="flex items-center justify-center px-4 py-2 bg-gray-50 border-b border-gray-200 sticky top-0 z-10 gap-8">
          <div className="text-xs text-gray-500">
            <span className="text-green-600">+{addedCount}</span>
            <span className="mx-1 text-red-600">-{deletedCount}</span>
          </div>
          <div className="flex gap-2">
            {onRevert && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRevert}
                className="h-7 px-2 text-xs bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5 mr-1" />
                回退
              </Button>
            )}
            {onAccept && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAccept}
                className="h-7 px-2 text-xs bg-white hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-colors"
              >
                <GitCommit className="w-3.5 h-3.5 mr-1" />
                接受
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* 🔥 主内容区域：diff 内容 + minimap */}
      <div className="flex-1 flex overflow-hidden">
        {/* 🔥 diff 内容 */}
        <div 
          ref={scrollContainerRef}
          className="font-mono text-sm min-w-0 flex-1 overflow-auto"
          onScroll={handleScroll}
        >
          {diffLines.map((line, index) => (
            <div 
              key={`${line.oldLineNumber}-${line.newLineNumber}-${index}`} 
              className={`flex border-b border-gray-100 last:border-b-0 min-w-fit ${
                line.type === 'added' ? 'bg-green-50 text-green-800' : 
                line.type === 'deleted' ? 'bg-red-50 text-red-800 line-through' : 
                'bg-white'
              }`}
            >
              <div className="w-12 flex-shrink-0 bg-gray-50 text-right pr-2 text-xs text-gray-400 border-r border-gray-200 py-1 select-none">
                {line.oldLineNumber !== null ? line.oldLineNumber : ''}
              </div>
              <div className="w-12 flex-shrink-0 bg-gray-50 text-right pr-2 text-xs text-gray-400 border-r border-gray-200 py-1 select-none">
                {line.newLineNumber !== null ? line.newLineNumber : ''}
              </div>
              <div className="px-4 py-1 font-mono whitespace-pre text-sm">
                <span>{line.content}</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* 🔥 Minimap：显示修改概览 + 可视区域指示器 */}
        <div 
          ref={minimapRef}
          className="w-3 bg-gray-100 border-l border-gray-200 relative cursor-pointer flex-shrink-0"
          onClick={handleMinimapClick}
          title="点击跳转到对应位置"
        >
          {/* 🔥 修改标记 — 映射区域高度 = scroll container 的 clientHeight（viewHeight），排除水平滚动条偏差 */}
          <div className="absolute left-0 right-0 overflow-hidden" style={{ height: viewHeight || undefined, top: 0 }}>
            {diffLines.map((line, index) => {
              const topPercent = (index / diffLines.length) * 100;
              const heightPercent = 100 / diffLines.length;
              
              return (
                <div
                  key={index}
                  className={`absolute left-0 right-0 ${
                    line.type === 'added' ? 'bg-green-400' : 
                    line.type === 'deleted' ? 'bg-red-400' : 
                    'bg-transparent'
                  }`}
                  style={{
                    top: `${topPercent}%`,
                    height: `${Math.max(heightPercent, 1)}px`
                  }}
                />
              );
            })}
          </div>
          {/* 🔥 当前可视区域指示器 — 用 viewHeight 作为映射基准，像素级精确 */}
          {(() => {
            const container = scrollContainerRef.current;
            if (!container) return null;
            const mapH = viewHeight || (minimapRef.current?.clientHeight || 1);
            const scale = mapH / container.scrollHeight;
            return (
              <div 
                className="absolute left-0 right-0 bg-blue-400 opacity-20 pointer-events-none"
                style={{
                  top: `${scrollTop * scale}px`,
                  height: `${Math.max(container.clientHeight * scale, 4)}px`
                }}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;