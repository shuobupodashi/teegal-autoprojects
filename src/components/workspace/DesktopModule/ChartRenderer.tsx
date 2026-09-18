/**
 * 图表渲染组件
 * 支持图片、HTML 等图表类型
 */

import React, { useEffect, useRef } from 'react';

interface ChartData {
  type: 'image' | 'image/png' | 'image/jpeg' | 'image/gif' | 'image/svg+xml' | 'html';
  data?: string;
  url?: string; // 🔥 新增：支持URL方式
  title?: string;
  name?: string;
}

interface ChartRendererProps {
  chart: ChartData;
  width?: number;
  height?: number;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  chart,
  width = 600,
  height = 400
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    switch (chart.type) {
      case 'html':
        renderHTMLChart();
        break;
      case 'image/png':
      case 'image/jpeg':
      case 'image/gif':
      case 'image/svg+xml':
      case 'image':
        renderImageChart();
        break;
      default:
        console.warn('⚠️ 不支持的图表类型:', chart.type);
    }
  }, [chart]);

  const renderImageChart = () => {
    try {
      if (!containerRef.current) return;

      containerRef.current.innerHTML = '';

      const img = document.createElement('img');
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = 'auto';

      // 🔥 优先使用 url，其次使用 data
      const imageSource = chart.url || chart.data;

      if (!imageSource) {
        console.warn('⚠️ 图表没有 url 或 data 字段:', chart);
        return;
      }

      if (imageSource.startsWith('data:')) {
        img.src = imageSource;
      } else if (imageSource.startsWith('http') || imageSource.startsWith('/')) {
        img.src = imageSource;
      } else {
        const mimeType = chart.type === 'image/svg+xml' ? 'image/svg+xml' :
                        chart.type === 'image/jpeg' ? 'image/jpeg' :
                        chart.type === 'image/gif' ? 'image/gif' : 'image/png';
        img.src = `data:${mimeType};base64,${imageSource}`;
      }

      containerRef.current.appendChild(img);
    } catch (error) {
      console.error('❌ 图片渲染失败:', error);
    }
  };

  const renderHTMLChart = () => {
    try {
      if (!containerRef.current) return;

      // 🔥 优先使用 data，其次从 url 加载
      if (chart.data) {
        containerRef.current.innerHTML = chart.data;
      } else if (chart.url) {
        // 从 URL 加载 HTML 内容
        fetch(chart.url)
          .then(response => response.text())
          .then(html => {
            if (containerRef.current) {
              containerRef.current.innerHTML = html;
            }
          })
          .catch(error => {
            console.error('❌ 加载 HTML 失败:', error);
          });
      }
    } catch (error) {
      console.error('❌ HTML 渲染失败:', error);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        maxWidth: width ? `${width}px` : '100%',
        width: '100%',
        height: 'auto',
        minHeight: '200px'
      }}
      className="chart-container"
    />
  );
};

export default ChartRenderer;
