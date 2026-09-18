/**
 * OfficeViewer - Office 文档预览组件
 *
 * 支持：.doc/.docx/.xls/.xlsx/.ppt/.pptx
 * - .docx → docx-preview 内嵌渲染（分页排版，还原度高）
 * - .xlsx/.xls → SheetJS 解析渲染表格 + sheet 切换
 * - .doc/.ppt/.pptx → 轻量方案无法还原，显示「本地打开」按钮（系统默认程序）
 * - HTTP URL → 微软在线 Office Viewer（需文件可公网访问）
 *
 * 重库均走 dynamic import，仅在用户实际打开对应格式时加载，启动零开销
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, FileText, FileSpreadsheet, Presentation, FolderOpen, ExternalLink } from 'lucide-react';

/** 判断文件扩展名是否为 Office 文档 */
export function isOfficeFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
}

/** Office 渲染分流：docx 用 docx-preview，excel 用 SheetJS，其余本地打开 */
type OfficeKind = 'docx' | 'excel' | 'word-legacy' | 'ppt';

function getOfficeKind(filePath: string): OfficeKind {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (ext === 'docx') return 'docx';
  if (ext === 'xls' || ext === 'xlsx') return 'excel';
  if (ext === 'doc') return 'word-legacy';
  return 'ppt'; // ppt / pptx
}

/** 读取本地文件为 ArrayBuffer（优先 readBuffer，降级 base64 解码） */
async function readFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
  const electron = (window as any).electron;
  if (!electron?.userpcFile?.read && !electron?.userpcFile?.readBuffer) {
    throw new Error('非桌面应用环境，无法读取本地文件');
  }
  if (electron.userpcFile?.readBuffer) {
    const result = await electron.userpcFile.readBuffer(filePath);
    if (!result?.success) throw new Error(result?.error || '读取文件失败');
    return result.data?.buffer;
  }
  // 降级：base64 → ArrayBuffer
  const result = await electron.userpcFile.read(filePath, 'base64');
  if (!result?.success) throw new Error(result?.error || '读取文件失败');
  const base64 = result.data?.content || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

interface OfficeViewerProps {
  filePath: string;
  fileName?: string;
}

export const OfficeViewer: React.FC<OfficeViewerProps> = ({ filePath, fileName }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(false);
  /** xlsx 渲染数据 */
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const kind = getOfficeKind(filePath);
  const displayName = fileName || filePath.split('/').pop() || filePath.split('\\').pop() || filePath;

  /** 🔥 docx 内嵌渲染（docx-preview） */
  const renderDocx = async () => {
    setLoading(true);
    setError('');
    try {
      const buffer = await readFileAsArrayBuffer(filePath);
      const container = docxContainerRef.current;
      if (!container) return;
      container.innerHTML = '';
      const docx = await import('docx-preview');
      await docx.renderAsync(buffer, container, null, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
      });
    } catch (e: any) {
      setError(e?.message || '文档解析失败');
    } finally {
      setLoading(false);
    }
  };

  /** 🔥 excel 表格渲染（SheetJS，显示前 200 行） */
  const renderExcel = async () => {
    setLoading(true);
    setError('');
    try {
      const buffer = await readFileAsArrayBuffer(filePath);
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buffer, { type: 'array' });
      const data = wb.SheetNames.slice(0, 20).map(name => {
        const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
        return {
          name,
          rows: rows.slice(0, 200).map(r => r.map(c => String(c ?? ''))),
        };
      });
      if (data.length === 0) {
        setError('表格内容为空');
        return;
      }
      setSheets(data);
      setActiveSheet(0);
    } catch (e: any) {
      setError(e?.message || '表格解析失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSheets([]);
    setError('');
    setOpened(false);
    if (kind === 'docx') {
      // 等 ref 挂载后再渲染
      requestAnimationFrame(() => renderDocx());
    } else if (kind === 'excel') {
      renderExcel();
    }
  }, [filePath]);

  /** 🔥 用系统默认程序打开本地文件（仅用户点击按钮时触发） */
  const openWithSystemApp = async () => {
    const electron = (window as any).electron;
    if (!electron?.openPath) {
      setError('无法调用系统程序（仅在桌面应用中可用）');
      return;
    }
    const result = await electron.openPath(filePath);
    if (!result?.success) {
      setError(result?.error || '调用系统程序失败');
      return;
    }
    setOpened(true);
    setError('');
  };

  // HTTP URL → 嵌入微软在线 Office Viewer（支持全部格式）
  if (filePath.startsWith('http')) {
    const encoded = encodeURIComponent(filePath);
    return (
      <iframe
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`}
        className="w-full h-full border-0"
        title="Office 文档预览"
      />
    );
  }

  // 🔥 docx 容器需常驻挂载（否则 ref 失效无法渲染），loading 走 overlay，不走此分支
  if (loading && kind !== 'docx') {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-500">解析文档中...</span>
      </div>
    );
  }

  if (error && kind !== 'docx') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <AlertTriangle className="h-10 w-10 text-orange-400 mb-2" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // docx → 内嵌渲染结果（容器常驻挂载，loading/error 以 overlay 覆盖，避免 ref 失效）
  if (kind === 'docx') {
    return (
      <div className="relative h-full overflow-auto bg-gray-100 p-4">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-500">解析文档中...</span>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <AlertTriangle className="h-10 w-10 text-orange-400 mb-2" />
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        )}
        <div ref={docxContainerRef} className="mx-auto bg-white shadow-md min-h-full" style={{ maxWidth: '9in' }} />
      </div>
    );
  }

  // excel → 表格渲染 + sheet 切换
  if (kind === 'excel' && sheets.length > 0) {
    const current = sheets[activeSheet];
    return (
      <div className="flex flex-col h-full bg-white">
        {/* sheet 切换 tabs */}
        {sheets.length > 1 && (
          <div className="flex items-center gap-1 px-2 pt-2 border-b border-gray-200 overflow-x-auto shrink-0">
            {sheets.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setActiveSheet(i)}
                className={`px-3 py-1.5 text-xs whitespace-nowrap rounded-t transition-colors ${
                  i === activeSheet ? 'bg-blue-50 text-blue-600 font-medium border-b-2 border-blue-500' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-auto p-3">
          <table className="border-collapse text-xs">
            <tbody>
              {current.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`border border-gray-200 px-2 py-1 max-w-[240px] truncate ${
                        ri === 0 ? 'bg-gray-50 font-medium' : ''
                      }`}
                      title={cell}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {current.rows.length >= 200 && (
            <p className="mt-2 text-xs text-gray-400">仅显示前 200 行，完整内容请本地打开</p>
          )}
        </div>
      </div>
    );
  }

  // word-legacy / ppt → 轻量方案无法还原，显示本地打开按钮
  const ICON = kind === 'ppt' ? <Presentation className="h-12 w-12 text-orange-500" /> : <FileText className="h-12 w-12 text-blue-500" />;
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 p-6">
      {ICON}
      <p className="mt-3 text-sm font-medium">{displayName}</p>
      <p className="mt-2 text-xs text-gray-400 text-center max-w-md">
        {kind === 'ppt' ? 'PPT 演示文稿' : '旧版 Word 文档'}暂不支持内嵌预览{opened ? '，已使用系统程序打开' : ''}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={openWithSystemApp}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          本地打开
        </button>
        {(window as any).electron?.showItemInFolder && (
          <button
            onClick={() => (window as any).electron.showItemInFolder(filePath)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            打开所在文件夹
          </button>
        )}
      </div>
    </div>
  );
};

export default OfficeViewer;
