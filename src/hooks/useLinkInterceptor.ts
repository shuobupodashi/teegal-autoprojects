import { useEffect } from 'react';

/**
 * 🔥 全局链接拦截 Hook
 * 拦截所有链接点击，让外部链接在系统浏览器中打开
 * 防止 Electron 应用内跳转导致无法返回
 */
export function useLinkInterceptor() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // 查找最近的 <a> 标签
      const link = target.closest('a');
      
      if (link) {
        const href = link.getAttribute('href');
        
        // 如果是外部链接 (http/https)
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          e.preventDefault();
          e.stopPropagation();
          
          // 使用 Electron 打开外部链接
          const electron = (window as any).electron;
          if (electron?.openExternal) {
            electron.openExternal(href);
          } else {
            // 降级处理：在新窗口打开
            window.open(href, '_blank', 'noopener,noreferrer');
          }
          
          return false;
        }
        
        // 如果是 mailto 或 tel 链接
        if (href && (href.startsWith('mailto:') || href.startsWith('tel:'))) {
          e.preventDefault();
          e.stopPropagation();
          
          const electron = (window as any).electron;
          if (electron?.openExternal) {
            electron.openExternal(href);
          }
          
          return false;
        }
      }
    };

    // 在 document 级别监听点击事件
    document.addEventListener('click', handleClick, true);
    
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, []);
}

export default useLinkInterceptor;
