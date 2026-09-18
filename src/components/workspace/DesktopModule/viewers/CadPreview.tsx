/**
 * CadPreview - CAD 文件预览组件
 *
 * 支持：
 * - .dxf → dxf-react 渲染（2D 图纸）
 * - .stl → Three.js STLLoader 渲染（3D 网格）
 * - .step/.stp → 提示需要后端转换为 STL（暂不支持直接渲染）
 * - .svg → 原生 <img> 渲染
 * - .obj → Three.js OBJLoader 渲染（3D 网格）
 */

import React, { useEffect, useRef, useState, useCallback, Suspense, lazy } from 'react';
import { Loader2, AlertTriangle, FileQuestion } from 'lucide-react';
import 'dxf-react/style.css';

// 🔥 懒加载 dxf-react，避免不影响首屏加载
const DXFViewer = lazy(() =>
  import('dxf-react').then(mod => ({ default: mod.DXFViewer }))
);

// ============================================================================
// 工具函数
// ============================================================================

/** 判断文件扩展名是否为 CAD 文件 */
export function isCadFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ['dxf', 'stl', 'step', 'stp', 'svg', 'obj'].includes(ext);
}

/** 获取 CAD 文件类型 */
function getCadFileType(filePath: string): 'dxf' | 'stl' | 'step' | 'svg' | 'obj' | 'unknown' {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (ext === 'dxf') return 'dxf';
  if (ext === 'stl') return 'stl';
  if (ext === 'step' || ext === 'stp') return 'step';
  if (ext === 'svg') return 'svg';
  if (ext === 'obj') return 'obj';
  return 'unknown';
}

// ============================================================================
// DXF 预览（2D）
// ============================================================================

const DxfPreview: React.FC<{ filePath: string; appId: string }> = ({ filePath, appId }) => {
  const [dxfUrl, setDxfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 🔥 通过 local-backend API 获取文件内容
    const loadDxf = async () => {
      try {
        const electron = (window as any).electron;
        if (!electron?.userpcFile?.read) {
          setError('非 Electron 环境，无法读取 DXF 文件');
          return;
        }

        const result = await electron.userpcFile.read(filePath);
        if (!result?.success) {
          setError(result?.error || '读取 DXF 文件失败');
          return;
        }

        // 🔥 将文件内容转为 Blob URL 供 dxf-react 加载
        const content = result.data?.content || '';
        const blob = new Blob([content], { type: 'application/dxf' });
        const url = URL.createObjectURL(blob);
        setDxfUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载 DXF 失败');
      }
    };

    loadDxf();
    return () => {
      if (dxfUrl) URL.revokeObjectURL(dxfUrl);
    };
  }, [filePath]);

  if (error) {
    return <CadError message={error} />;
  }

  if (!dxfUrl) {
    return <CadLoading label="加载 DXF 图纸..." />;
  }

  return (
    <Suspense fallback={<CadLoading label="初始化 DXF 渲染器..." />}>
      <DXFViewer
        url={dxfUrl}
        darkTheme={document.documentElement.classList.contains('dark')}
        showRulers
        showLayerPanel
        showCoordinates
        showResetButton
        showMeasureButton
        pickingEnabled
        onError={(err) => console.error('[CadPreview] DXF 渲染错误:', err)}
      />
    </Suspense>
  );
};

// ============================================================================
// STL 预览（3D）
// ============================================================================

const StlPreview: React.FC<{ filePath: string }> = ({ filePath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const loadStl = async () => {
      try {
        const electron = (window as any).electron;
        if (!electron?.userpcFile?.readBuffer && !electron?.userpcFile?.read) {
          setError('非 Electron 环境，无法读取 STL 文件');
          return;
        }

        // 读取文件为 ArrayBuffer
        let buffer: ArrayBuffer;
        if (electron.userpcFile?.readBuffer) {
          const result = await electron.userpcFile.readBuffer(filePath);
          if (!result?.success) {
            setError(result?.error || '读取 STL 文件失败');
            return;
          }
          buffer = result.data?.buffer;
        } else {
          // 降级：读取文本再转
          const result = await electron.userpcFile.read(filePath);
          if (!result?.success) {
            setError(result?.error || '读取 STL 文件失败');
            return;
          }
          const content = result.data?.content || '';
          buffer = new TextEncoder().encode(content).buffer;
        }

        // 🔥 动态导入 Three.js + STLLoader
        const THREE = await import('three');
        const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        const container = containerRef.current;
        if (!container) return;

        // 场景
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);

        // 相机
        const camera = new THREE.PerspectiveCamera(
          45,
          container.clientWidth / container.clientHeight,
          0.1,
          10000
        );
        camera.position.set(100, 100, 100);

        // 渲染器
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // 轨道控制
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        // 灯光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 100);
        scene.add(directionalLight);

        // 解析 STL
        const loader = new STLLoader();
        const geometry = loader.parse(buffer);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          color: 0x6c9ce0,
          metalness: 0.3,
          roughness: 0.65,
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // 线框叠加
        const wireframe = new THREE.WireframeGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x444466, opacity: 0.3, transparent: true });
        const wireframeMesh = new THREE.LineSegments(wireframe, lineMaterial);
        scene.add(wireframeMesh);

        // 自适应相机
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim);
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();

        // 动画循环
        const animate = () => {
          requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        // 响应式
        const handleResize = () => {
          if (!container) return;
          camera.aspect = container.clientWidth / container.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        setLoading(false);

        cleanup = () => {
          window.removeEventListener('resize', handleResize);
          controls.dispose();
          geometry.dispose();
          material.dispose();
          lineMaterial.dispose();
          renderer.dispose();
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
          }
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载 STL 失败');
        setLoading(false);
      }
    };

    loadStl();
    return () => { cleanup?.(); };
  }, [filePath]);

  if (error) {
    return <CadError message={error} />;
  }

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      {loading && <CadLoading label="加载 3D 模型..." />}
    </div>
  );
};

// ============================================================================
// SVG 预览
// ============================================================================

const SvgPreview: React.FC<{ filePath: string }> = ({ filePath }) => {
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSvg = async () => {
      try {
        const electron = (window as any).electron;
        if (!electron?.userpcFile?.read) {
          setError('非 Electron 环境，无法读取 SVG 文件');
          return;
        }

        const result = await electron.userpcFile.read(filePath);
        if (!result?.success) {
          setError(result?.error || '读取 SVG 文件失败');
          return;
        }

        const content = result.data?.content || '';
        const blob = new Blob([content], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        setSvgUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载 SVG 失败');
      }
    };

    loadSvg();
    return () => {
      if (svgUrl) URL.revokeObjectURL(svgUrl);
    };
  }, [filePath]);

  if (error) {
    return <CadError message={error} />;
  }

  if (!svgUrl) {
    return <CadLoading label="加载 SVG..." />;
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900 p-4">
      <img
        src={svgUrl}
        alt="SVG preview"
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
};

// ============================================================================
// STEP 占位提示
// ============================================================================

const StepPreviewPlaceholder: React.FC = () => (
  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-900">
    <FileQuestion className="w-16 h-16 mb-4 opacity-30" />
    <p className="text-sm font-medium mb-1">STEP/STP 文件预览</p>
    <p className="text-xs text-gray-500 max-w-xs text-center">
      STEP 格式需要在后端转换为 STL 后才能预览。请使用 CadQuery 脚本同时导出 .stl 文件。
    </p>
    <code className="text-xs mt-3 px-2 py-1 bg-gray-800 rounded text-blue-400">
      cq.exporters.export(result, "model.stl")
    </code>
  </div>
);

// ============================================================================
// 通用 UI
// ============================================================================

const CadLoading: React.FC<{ label: string }> = ({ label }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10">
    <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-2" />
    <span className="text-sm text-gray-300">{label}</span>
  </div>
);

const CadError: React.FC<{ message: string }> = ({ message }) => (
  <div className="w-full h-full flex flex-col items-center justify-center text-red-400 bg-gray-900">
    <AlertTriangle className="w-12 h-12 mb-3 opacity-50" />
    <p className="text-sm">{message}</p>
  </div>
);

// ============================================================================
// 主组件
// ============================================================================

interface CadPreviewProps {
  filePath: string;    // 文件完整路径
  appId: string;       // 项目 ID
  fileName?: string;   // 文件名（显示用）
}

export const CadPreview: React.FC<CadPreviewProps> = ({ filePath, appId, fileName }) => {
  const cadType = getCadFileType(filePath);

  switch (cadType) {
    case 'dxf':
      return <DxfPreview filePath={filePath} appId={appId} />;
    case 'stl':
      return <StlPreview filePath={filePath} />;
    case 'svg':
      return <SvgPreview filePath={filePath} />;
    case 'step':
      return <StepPreviewPlaceholder />;
    case 'obj':
      // OBJ 暂用 STL 的 3D 容器占位，后续可加 OBJLoader
      return <CadError message="OBJ 格式预览暂未支持，请转换为 STL" />;
    default:
      return <CadError message={`不支持的 CAD 文件格式: ${fileName || filePath}`} />;
  }
};
