import React, { useMemo } from 'react';

interface LinkTextProps {
  text: string;
  className?: string;
}

/**
 * 🔥 链接文本组件
 * 自动识别文本中的 URL 并渲染为可点击链接
 * 点击时会在系统浏览器中打开
 */
const LinkText: React.FC<LinkTextProps> = ({ text, className = '' }) => {
  const urlRegex = useMemo(() => {
    // 🔥 URL 路径中允许包含中文字符（如 OSS 文件名含中文）
    // 匹配 https:// 开头，到空白/引号/反引号/右括号/右方括号为止
    return /(https?:\/\/[^\s<>'"\u0060)\]]+)/gi;
  }, []);

  // 将文本分割为普通文本和链接
  const parts = useMemo(() => {
    const result: Array<{ type: 'text' | 'link'; content: string }> = [];
    let lastIndex = 0;
    let match;

    // 重置正则表达式
    urlRegex.lastIndex = 0;

    while ((match = urlRegex.exec(text)) !== null) {
      // 添加链接前的文本
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: text.slice(lastIndex, match.index)
        });
      }

      // 添加链接
      result.push({
        type: 'link',
        content: match[0]
      });

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余的文本
    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }

    return result;
  }, [text, urlRegex]);

  const handleLinkClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();

    const electron = (window as any).electron;
    if (electron?.openExternal) {
      electron.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (parts.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'link') {
          return (
            <a
              key={index}
              href={part.content}
              onClick={(e) => handleLinkClick(e, part.content)}
              className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
              title="点击在浏览器中打开"
            >
              {part.content}
            </a>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </span>
  );
};

export default LinkText;
