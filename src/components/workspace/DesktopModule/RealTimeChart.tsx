/**
 * 实时图表组件
 * 支持WebSocket实时数据推送，适用于量化交易、实时监控等场景
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface RealTimeChartProps {
  wsUrl?: string;  // WebSocket URL
  chartType?: 'line' | 'bar' | 'candlestick' | 'area';
  maxDataPoints?: number;  // 最大数据点数
  updateInterval?: number;  // 更新间隔（毫秒）
  onDataUpdate?: (data: any) => void;  // 数据更新回调
}

interface DataPoint {
  timestamp: number;
  value: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
  wsUrl,
  chartType = 'line',
  maxDataPoints = 100,
  updateInterval = 1000,
  onDataUpdate
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const chartInstanceRef = useRef<any>(null);

  // 初始化图表
  useEffect(() => {
    if (!containerRef.current) return;

    // 动态加载 ECharts
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
    script.onload = () => {
      // @ts-ignore
      chartInstanceRef.current = echarts.init(containerRef.current);
      updateChart();
    };
    document.head.appendChild(script);

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
      }
    };
  }, []);

  // WebSocket 连接
  useEffect(() => {
    if (!wsUrl) return;

    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('✅ WebSocket 连接成功');
          setIsConnected(true);
        };

        wsRef.current.onmessage = (event) => {
          try {
            const newData = JSON.parse(event.data);
            addDataPoint(newData);
          } catch (error) {
            console.error('❌ 数据解析失败:', error);
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('❌ WebSocket 错误:', error);
          setIsConnected(false);
        };

        wsRef.current.onclose = () => {
          console.log('🔌 WebSocket 连接关闭');
          setIsConnected(false);
          // 5秒后重连
          setTimeout(connectWebSocket, 5000);
        };
      } catch (error) {
        console.error('❌ WebSocket 连接失败:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [wsUrl]);

  // 添加数据点
  const addDataPoint = (newData: any) => {
    const dataPoint: DataPoint = {
      timestamp: newData.timestamp || Date.now(),
      value: newData.value,
      volume: newData.volume,
      open: newData.open,
      high: newData.high,
      low: newData.low,
      close: newData.close
    };

    setData(prevData => {
      const updatedData = [...prevData, dataPoint];
      
      // 保持最大数据点数
      if (updatedData.length > maxDataPoints) {
        updatedData.shift();
      }
      
      // 触发回调
      if (onDataUpdate) {
        onDataUpdate(dataPoint);
      }
      
      return updatedData;
    });
  };

  // 更新图表
  useEffect(() => {
    if (chartInstanceRef.current && data.length > 0) {
      updateChart();
    }
  }, [data, chartType]);

  const updateChart = () => {
    if (!chartInstanceRef.current) return;

    const timestamps = data.map(d => new Date(d.timestamp).toLocaleTimeString());
    const values = data.map(d => d.value);

    let option: any = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: timestamps,
        axisLine: { lineStyle: { color: '#666' } }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#666' } },
        splitLine: { lineStyle: { color: '#eee' } }
      }
    };

    switch (chartType) {
      case 'line':
        option.series = [{
          data: values,
          type: 'line',
          smooth: true,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
              ]
            }
          },
          lineStyle: { color: '#3b82f6', width: 2 },
          itemStyle: { color: '#3b82f6' }
        }];
        break;

      case 'bar':
        option.series = [{
          data: values,
          type: 'bar',
          itemStyle: {
            color: new (window as any).echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#83bff6' },
              { offset: 0.5, color: '#188df0' },
              { offset: 1, color: '#188df0' }
            ])
          }
        }];
        break;

      case 'area':
        option.series = [{
          data: values,
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.8 },
          lineStyle: { color: '#10b981', width: 2 },
          itemStyle: { color: '#10b981' }
        }];
        break;

      case 'candlestick':
        const candleData = data.map(d => [
          d.open || d.value,
          d.close || d.value,
          d.low || d.value,
          d.high || d.value
        ]);
        
        option.xAxis.data = timestamps;
        option.series = [{
          type: 'candlestick',
          data: candleData,
          itemStyle: {
            color: '#ef5350',
            color0: '#26a69a',
            borderColor: '#ef5350',
            borderColor0: '#26a69a'
          }
        }];
        break;
    }

    chartInstanceRef.current.setOption(option, true);
  };

  // 响应式调整
  useEffect(() => {
    const handleResize = () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* 连接状态指示器 */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs text-gray-600">
          {isConnected ? t('workspace.desktopModule.realTimeChart.connected') : t('workspace.desktopModule.realTimeChart.disconnected')}
        </span>
        {data.length > 0 && (
          <span className="text-xs text-gray-600">
            最新值: {data[data.length - 1].value.toFixed(2)}
          </span>
        )}
      </div>

      {/* 图表容器 */}
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          minHeight: '400px'
        }}
      />
    </div>
  );
};

export default RealTimeChart;
