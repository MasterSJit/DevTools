import { useState, useCallback, useRef, useEffect } from 'react';
import { Stack, Group, Button, Paper, Text, Select, Badge } from '@mantine/core';
import { IconCrop, IconDownload } from '@tabler/icons-react';
import ToolHeader from '@/shared/components/ToolHeader';
import FileDropZone from '@/shared/components/FileDropZone';
import { useImageTool } from '../shared/useImageTool';

export default function ImageCrop() {
  const { sourceImage, resultUrl, resultBlob, resultInfo, loading, loadImage, downloadResult, reset } = useImageTool();
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 200, h: 200 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [aspectRatio, setAspectRatio] = useState('free');
  const imgRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    const img = await loadImage(file);
    imgRef.current = img;
  }, [loadImage]);

  useEffect(() => {
    if (sourceImage) {
      const maxW = Math.min(sourceImage.width, 400);
      const maxH = Math.min(sourceImage.height, 400);
      setCrop({ x: 0, y: 0, w: Math.min(maxW, sourceImage.width), h: Math.min(maxH, sourceImage.height) });
    }
  }, [sourceImage]);

  const handleMouseDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!dragging || !dragStart || !sourceImage) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = sourceImage.width / rect.width;
    const scaleY = sourceImage.height / rect.height;
    let x = Math.max(0, Math.min((e.clientX - rect.left) * scaleX, sourceImage.width));
    let y = Math.max(0, Math.min((e.clientY - rect.top) * scaleY, sourceImage.height));
    let w = x - crop.x * (rect.width / sourceImage.width) * scaleX;
    // Simplified: set crop from start point to current
    setCrop((prev) => ({
      ...prev,
      x: Math.round(Math.min(dragStart.x * scaleX, x)),
      y: Math.round(Math.min(dragStart.y * scaleY, y)),
      w: Math.round(Math.abs(x - dragStart.x * scaleX)),
      h: Math.round(Math.abs(y - dragStart.y * scaleY)),
    }));
  };

  const handleMouseUp = () => { setDragging(false); };

  const doCrop = useCallback(() => {
    if (!sourceImage) return;
    const canvas = document.createElement('canvas');
    canvas.width = crop.w;
    canvas.height = crop.h;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        // Use the hook's setter directly
        useImageTool.setState?.({ resultUrl: url, resultBlob: blob, resultInfo: { width: crop.w, height: crop.h, size: blob.size, format: 'image/png' } });
      }, 'image/png');
    };
    img.src = sourceImage.url;
  }, [sourceImage, crop]);

  const handleCrop = useCallback(() => {
    if (!sourceImage) return;
    const canvas = document.createElement('canvas');
    canvas.width = crop.w;
    canvas.height = crop.h;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        // Trigger a re-render by storing in state
        window.__cropResult = { url, blob, w: crop.w, h: crop.h };
        // Force result display
        setResultUrlLocal(url);
        setResultBlobLocal(blob);
      }, 'image/png');
    };
    img.src = sourceImage.url;
  }, [sourceImage, crop]);

  const [resultUrlLocal, setResultUrlLocal] = useState(null);
  const [resultBlobLocal, setResultBlobLocal] = useState(null);

  const handleDownload = () => {
    if (!resultBlobLocal) return;
    const url = URL.createObjectURL(resultBlobLocal);
    const a = document.createElement('a'); a.href = url; a.download = 'cropped.png'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack gap="md">
      <ToolHeader title="Image Cropper" description="Crop images by selecting the area you want to keep" icon={IconCrop} />
      {!sourceImage ? (
        <FileDropZone onFile={handleFile} accept={{ 'image/*': [] }} title="Drop an image to crop" />
      ) : (
        <Stack gap="md">
          <Paper withBorder p="md">
            <Text size="xs" fw={500} c="dimmed" mb={4}>Click and drag to select crop area</Text>
            <div style={{ position: 'relative', display: 'inline-block', cursor: 'crosshair', maxWidth: '100%' }}
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
              <img src={sourceImage.url} style={{ maxWidth: '100%', maxHeight: 500, display: 'block', userSelect: 'none' }} draggable={false} />
              <div style={{
                position: 'absolute',
                left: `${(crop.x / sourceImage.width) * 100}%`,
                top: `${(crop.y / sourceImage.height) * 100}%`,
                width: `${(crop.w / sourceImage.width) * 100}%`,
                height: `${(crop.h / sourceImage.height) * 100}%`,
                border: '2px dashed #8B5CF6',
                background: 'rgba(139, 92, 246, 0.1)',
                pointerEvents: 'none',
              }} />
            </div>
            <Group mt="xs">
              <Badge>X: {crop.x}</Badge>
              <Badge>Y: {crop.y}</Badge>
              <Badge>W: {crop.w}</Badge>
              <Badge>H: {crop.h}</Badge>
            </Group>
          </Paper>

          {resultUrlLocal && (
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Cropped Result</Text>
              <img src={resultUrlLocal} style={{ maxWidth: '100%', maxHeight: 300 }} />
            </Paper>
          )}

          <Group justify="center">
            <Button onClick={handleCrop} disabled={crop.w < 1 || crop.h < 1}>Crop</Button>
            {resultUrlLocal && <Button variant="light" leftSection={<IconDownload size={16} />} onClick={handleDownload}>Download</Button>}
            <Button variant="subtle" color="red" onClick={() => { reset(); setResultUrlLocal(null); setResultBlobLocal(null); }}>Reset</Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}