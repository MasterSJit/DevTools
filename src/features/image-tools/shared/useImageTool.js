import { useState, useCallback, useRef, useEffect } from 'react';

export function useImageTool() {
  const [sourceImage, setSourceImage] = useState(null);   // { url, file, width, height, size, name }
  const [resultUrl, setResultUrl] = useState(null);
  const [resultBlob, setResultBlob] = useState(null);
  const [resultInfo, setResultInfo] = useState(null);      // { width, height, size, format }
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef(null);
  const workerRef = useRef(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('@/shared/workers/image.worker.js', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e) => {
      const { success, data, width, height, size, format, error } = e.data;
      if (success) {
        const blob = new Blob([data], { type: format });
        const url = URL.createObjectURL(blob);
        setResultUrl(url);
        setResultBlob(blob);
        setResultInfo({ width, height, size, format });
      }
      setLoading(false);
      setProgress(100);
    };
    return () => workerRef.current?.terminate();
  }, []);

  const loadImage = useCallback((file) => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setSourceImage({ url, file, width: img.width, height: img.height, size: file.size, name: file.name });
        setResultUrl(null);
        setResultBlob(null);
        setResultInfo(null);
        resolve(img);
      };
      img.src = url;
    });
  }, []);

  const loadAsArrayBuffer = useCallback(async (file) => {
    return file.arrayBuffer();
  }, []);

  const sendToWorker = useCallback((imageData, action, options) => {
    setLoading(true);
    setProgress(0);
    workerRef.current?.postMessage({ action, imageData, options });
  }, []);

  const downloadResult = useCallback((filename) => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `output.${resultInfo?.format?.split('/')[1] || 'png'}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [resultBlob, resultInfo]);

  const reset = useCallback(() => {
    if (sourceImage?.url) URL.revokeObjectURL(sourceImage.url);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setSourceImage(null);
    setResultUrl(null);
    setResultBlob(null);
    setResultInfo(null);
  }, [sourceImage, resultUrl]);

  return {
    sourceImage, setSourceImage,
    resultUrl, setResultUrl,
    resultBlob, setResultBlob,
    resultInfo, setResultInfo,
    loading, progress,
    loadImage, loadAsArrayBuffer,
    sendToWorker, downloadResult, reset,
    canvasRef,
    workerRef,
  };
}