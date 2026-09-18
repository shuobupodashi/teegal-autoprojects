import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Download, Copy, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileAttachment } from '../../types/ChatTypes';
import { useTranslation } from 'react-i18next';
import Editor from 'react-simple-code-editor';
import * as Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; // HTML/XML
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-regex';
import './code-viewer-theme.css';

interface CodeFileViewerProps {
  file: FileAttachment;
  isOpen: boolean;
  onClose: () => void;
}

// 文件扩展名到语言类型的映射
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  'py': 'python',
  'python': 'python',
  'js': 'javascript',
  'javascript': 'javascript',
  'ts': 'typescript',
  'typescript': 'typescript',
  'tsx': 'tsx',
  'jsx': 'jsx',
  'json': 'json',
  'yaml': 'yaml',
  'yml': 'yaml',
  'md': 'markdown',
  'markdown': 'markdown',
  'css': 'css',
  'scss': 'css',
  'sass': 'css',
  'less': 'css',
  'html': 'html',
  'htm': 'html',
  'xml': 'xml',
  'sql': 'sql',
  'sh': 'bash',
  'bash': 'bash',
  'zsh': 'bash',
  'dockerfile': 'docker',
  'graphql': 'graphql',
  'gql': 'graphql',
  'txt': 'text',
  'log': 'text',
  'ini': 'ini',
  'conf': 'ini',
  'env': 'ini',
};

// 获取文件的语言类型
const getLanguageFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_TO_LANGUAGE[ext] || 'text';
};

// 获取 Prism 高亮函数
const getPrismHighlighter = (language: string) => {
  const prismLanguage = Prism.languages[language];
  if (prismLanguage) {
    return (code: string) => Prism.highlight(code, prismLanguage, language);
  }
  // 如果没有找到对应语言，返回纯文本
  return (code: string) => code;
};

const CodeFileViewer: React.FC<CodeFileViewerProps> = ({ 
  file, 
  isOpen, 
  onClose 
}) => {
  const { t } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  const language = getLanguageFromFileName(file.name);
  const highlight = getPrismHighlighter(language);

  useEffect(() => {
    const loadContent = async () => {
      if (!isOpen) return;
      
      setLoading(true);
      setError('');
      
      try {
        // 🔥 优先处理本地文件路径
        const localPath = (file as any).localPath;
        if (localPath) {
          try {
            const electron = (window as any).electron;
            if (electron) {
              const readResult = await electron.readLocalFile({ localPath });
              if (readResult.success) {
                // 🔥 使用 TextDecoder 正确解码 UTF-8 内容
                const binaryString = atob(readResult.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const decodedContent = new TextDecoder('utf-8').decode(bytes);
                setContent(decodedContent);
                setLoading(false);
                return;
              }
            }
          } catch (err) {
            console.error('本地文件读取失败:', err);
          }
        }
        
        // 🔥 处理 file:// 协议的本地文件路径
        if (file.content?.startsWith('file://')) {
          const filePath = file.content.replace('file://', '');
          try {
            const electron = (window as any).electron;
            if (electron) {
              const readResult = await electron.readLocalFile({ localPath: filePath });
              if (readResult.success) {
                // 🔥 使用 TextDecoder 正确解码 UTF-8 内容
                const binaryString = atob(readResult.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const decodedContent = new TextDecoder('utf-8').decode(bytes);
                setContent(decodedContent);
                setLoading(false);
                return;
              }
            }
          } catch (err) {
            console.error('file:// 路径读取失败:', err);
          }
        }
        
        // 优先使用 content 字段（如果是文本内容）
        if (file.content && typeof file.content === 'string') {
          // 检查是否是 data URL 或 URL
          if (file.content.startsWith('data:') || file.content.startsWith('http')) {
            // 需要从 URL 获取内容
            const response = await fetch(file.content);
            const text = await response.text();
            setContent(text);
          } else {
            // 直接是文本内容
            setContent(file.content);
          }
        } else if (file.url) {
          // 从 URL 获取内容
          const response = await fetch(file.url);
          const text = await response.text();
          setContent(text);
        } else {
          setError('无法获取文件内容');
        }
      } catch (err) {
        console.error('加载代码文件失败:', err);
        setError('加载文件内容失败');
      } finally {
        setLoading(false);
      }
    };
    
    loadContent();
  }, [isOpen, file]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name || 'download.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[1200px] h-[85vh] p-0 flex flex-col overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>{file.name || '代码文件'}</DialogTitle>
        </VisuallyHidden>
        
        {/* 头部工具栏 - pr-16 为关闭按钮留出空间 */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50 pr-16">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileCode className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <span className="font-medium truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0">
              {language}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8"
            >
              <Copy className="w-4 h-4 mr-1" />
              复制
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-8"
            >
              <Download className="w-4 h-4 mr-1" />
              下载
            </Button>
          </div>
        </div>
        
        {/* 代码内容区域 */}
        {/* 🔥 code-file-viewer：code-viewer-theme.css（VS Code Dark+）的作用域锚点，
            防止这套深色全局 token 样式盖掉 CodeEditor 的亮色主题 */}
        <div className="code-file-viewer flex-1 overflow-auto bg-[#1e1e1e]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              加载中...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              {error}
            </div>
          ) : (
            <div className="min-h-full p-4">
              <Editor
                value={content}
                onValueChange={() => {}} // 只读，不处理变更
                highlight={highlight}
                padding={16}
                className="font-mono text-sm"
                style={{
                  fontFamily: '"Fira Code", "Monaco", "Consolas", monospace',
                  fontSize: 14,
                  backgroundColor: 'transparent',
                  minHeight: '100%',
                }}
                textareaClassName="code-editor-textarea"
                preClassName="code-editor-pre"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CodeFileViewer;
