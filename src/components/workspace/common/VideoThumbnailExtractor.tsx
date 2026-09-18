import { useEffect, useState, useRef } from "react";

interface VideoThumbnailExtractorProps {
  videoSrc: string;
  onThumbnailExtracted?: (thumbnail: string) => void;
  className?: string;
}

/**
 * 视频缩略图提取组件
 * 使用HTML5 Video API + Canvas提取视频首帧
 */
export const VideoThumbnailExtractor: React.FC<VideoThumbnailExtractorProps> = ({
  videoSrc,
  onThumbnailExtracted,
  className = "",
}) => {
  const [thumbnail, setThumbnail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const extractedRef = useRef(false); // 防止重复提取
  const callbackRef = useRef(onThumbnailExtracted); // 稳定的回调引用
  const retryCountRef = useRef(0); // 重试计数
  const maxRetriesRef = useRef(5); // 最大重试次数

  useEffect(() => {
    // 保持回调最新，但不触发重新注册监听
    callbackRef.current = onThumbnailExtracted;
  }, [onThumbnailExtracted]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !videoSrc) return;

    setIsLoading(true);
    setError("");

    const handleLoadedMetadata = () => {
      console.log("🎬 [VIDEO-THUMBNAIL] 视频元数据加载完成，等待数据加载");
    };

    const handleCanPlayThrough = () => {
      console.log("✅ [VIDEO-THUMBNAIL] 视频可以播放，开始定位");
      video.currentTime = Math.min(0.5, video.duration / 2);
    };

    const handleSeeked = () => {
      if (extractedRef.current) return;

      try {
        console.log("🎬 [VIDEO-THUMBNAIL] 视频定位到首帧，准备提取");

        const canvasWidth = video.videoWidth;
        const canvasHeight = video.videoHeight;

        if (!canvasWidth || !canvasHeight) {
          console.error("❌ [VIDEO-THUMBNAIL] 无法获取视频尺寸");
          setError("无法获取视频尺寸");
          setIsLoading(false);
          return;
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setError("无法获取Canvas上下文");
          setIsLoading(false);
          return;
        }

        const drawAndCheck = () => {
          if (extractedRef.current) return;

          // 绘制当前帧
          ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);

          // 空白帧检测（扩大采样并加入动态范围判断）
          const w = Math.min(32, canvasWidth);
          const h = Math.min(32, canvasHeight);
          const data = ctx.getImageData(0, 0, w, h).data;
          let sum = 0;
          let varianceProbe = 0;
          let minVal = 255;
          let maxVal = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const v = (r + g + b) / 3;
            sum += v;
            varianceProbe += Math.abs(r - g) + Math.abs(g - b);
            if (v < minVal) minVal = v;
            if (v > maxVal) maxVal = v;
          }
          const avg = sum / (data.length / 4);
          const dynamicRange = maxVal - minVal;

          // 判定“疑似空白”：几乎全黑、几乎全白、动态范围极低且差异极低
          const isLikelyBlank =
            avg < 3 ||
            avg > 252 ||
            (dynamicRange < 10 && varianceProbe < 8);

          if (isLikelyBlank && retryCountRef.current < maxRetriesRef.current) {
            retryCountRef.current += 1;

            const d = Math.max(video.duration || 0.1, 0.1);
            // 递增偏移序列，逐步远离当前位置
            const offsets = [0.2, 0.35, 0.5, 0.8, 1.2, 1.6];
            const offset = offsets[Math.min(retryCountRef.current - 1, offsets.length - 1)];
            let candidate = video.currentTime + offset;

            // 边界控制：避免超过末尾，必要时回退至中位帧
            if (candidate >= d - 0.05) {
              candidate = Math.min(d * 0.5, d - 0.05);
            }
            // 若推进太小（可能卡住），强制跳至四分位数
            if (candidate <= video.currentTime + 0.05) {
              candidate = Math.min(d * 0.25, d - 0.05);
            }

            console.warn(`⚠️ [VIDEO-THUMBNAIL] 疑似空白帧，重试第${retryCountRef.current}次，跳至 ${candidate.toFixed(2)}s`);
            video.currentTime = candidate;
            return; // 等待下一次 seeked
          }

          const thumbnailData = canvas.toDataURL("image/jpeg", 0.8);

          // 标记已提取
          extractedRef.current = true;

          console.log("✅ [VIDEO-THUMBNAIL] 缩略图提取成功", { width: canvasWidth, height: canvasHeight });

          // 最新回调
          if (callbackRef.current) {
            try {
              callbackRef.current(thumbnailData);
            } catch (callbackError) {
              console.error("❌ [VIDEO-THUMBNAIL] 父组件回调执行失败:", callbackError);
            }
          }

          setThumbnail(thumbnailData);
          setIsLoading(false);
          video.pause();
          cleanup();
        };

        // 等待实际渲染的一帧再绘制
        const anyVideo = video as unknown as { requestVideoFrameCallback?: (fn: () => void) => number };
        if (typeof anyVideo.requestVideoFrameCallback === "function") {
          anyVideo.requestVideoFrameCallback(() => drawAndCheck());
        } else {
          const onTU = () => {
            video.removeEventListener("timeupdate", onTU);
            drawAndCheck();
          };
          video.addEventListener("timeupdate", onTU, { once: true });
          setTimeout(() => {
            if (!extractedRef.current) drawAndCheck();
          }, 50);
        }
      } catch (err) {
        console.error("❌ [VIDEO-THUMBNAIL] 提取失败:", err);
        setError("缩略图提取失败");
        setIsLoading(false);
        video.pause();
        cleanup();
      }
    };

    const handleError = (e: Event) => {
      console.error("❌ [VIDEO-THUMBNAIL] 视频加载失败:", e);
      setError("视频加载失败");
      setIsLoading(false);
      video.pause();
      cleanup();
    };

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplaythrough", handleCanPlayThrough);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };

    // 监听视频加载事件
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplaythrough", handleCanPlayThrough, { once: true });
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);

    video.src = videoSrc;
    video.load();

    return cleanup;
  }, [videoSrc]); // 🔥 只依赖 videoSrc，避免抖动

  return (
    <>
      {/* 隐藏的video和canvas元素，始终存在用于提取缩略图 */}
      <video ref={videoRef} className="hidden" crossOrigin="anonymous" preload="metadata" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

      {/* 只在成功提取缩略图后显示图片 */}
      {thumbnail && (
        <img
          src={thumbnail}
          alt="视频缩略图"
          className={`object-cover ${className}`}
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </>
  );
};

/**
 * Hook版本：提取视频缩略图
 * 适用于需要在其他组件中使用缩略图数据的场景
 */
export const useVideoThumbnail = (videoSrc: string, width = 320, height = 180) => {
  const [thumbnail, setThumbnail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!videoSrc) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    const video = document.createElement("video");
    const canvas = document.createElement("canvas");

    const handleLoadedMetadata = () => {
      console.log("🎬 [USE-VIDEO-THUMBNAIL] 视频元数据加载完成，等待数据加载");
    };

    const handleCanPlay = () => {
      console.log("✅ [USE-VIDEO-THUMBNAIL] 视频可以播放，开始定位");
      video.currentTime = Math.min(0.5, video.duration / 2);
    };

    const handleSeeked = () => {
      try {
        console.log("🎬 [USE-VIDEO-THUMBNAIL] 视频定位到首帧，开始提取");

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        if (!videoWidth || !videoHeight) {
          console.error("❌ [USE-VIDEO-THUMBNAIL] 无法获取视频尺寸");
          setError("无法获取视频尺寸");
          setIsLoading(false);
          return;
        }

        // 设置canvas尺寸，保持宽高比
        const aspectRatio = videoWidth / videoHeight;
        let canvasWidth = width;
        let canvasHeight = height;

        if (aspectRatio > canvasWidth / canvasHeight) {
          canvasHeight = canvasWidth / aspectRatio;
        } else {
          canvasWidth = canvasHeight * aspectRatio;
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // 绘制视频首帧
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
          const thumbnailData = canvas.toDataURL("image/jpeg", 0.8);
          setThumbnail(thumbnailData);
          setIsLoading(false);

          console.log("✅ [USE-VIDEO-THUMBNAIL] 缩略图提取成功", { width: canvasWidth, height: canvasHeight });
        }
      } catch (err) {
        console.error("❌ [USE-VIDEO-THUMBNAIL] 提取失败:", err);
        setError("缩略图提取失败");
        setIsLoading(false);
      }
    };

    const handleError = () => {
      console.error("❌ [USE-VIDEO-THUMBNAIL] 视频加载失败");
      setError("视频加载失败");
      setIsLoading(false);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.src = videoSrc;
    video.load();

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
      video.src = "";
    };
  }, [videoSrc, width, height]);

  return { thumbnail, isLoading, error };
};

export default VideoThumbnailExtractor;
