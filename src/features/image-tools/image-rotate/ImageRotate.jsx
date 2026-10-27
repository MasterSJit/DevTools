import { useState, useCallback, useRef } from 'react';
import { Stack, Group, Button, Paper, Text, Slider, Badge } from '@mantine/core';
import { IconRotate, IconDownload, IconRefresh } from '@tabler/icons-react';
import ToolHeader from '@/shared/components/ToolHeader';
import FileDropZone from '@/shared/components/FileDropZone';
import ImagePreview from '@/shared/components/ImagePreview';

export default function ImageRotate() {
  const [sourceImage, setSourceImage] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [angle, setAngle] = useState(0);
  const canvasRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSourceImage({ url, width: img.width, height: img.height, name: file.name, size: file.size, img });
      setResultUrl(null);
      setAngle(0);
    };
    img.src = url;
  }, []);

  const applyTransform = useCallback((rotation, flipH = false, flipV = false) => {
    if (!sourceImage) return;
    const img = sourceImage.img;
    const rad = (rotation * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));
    const w = Math.round(img.width * absCos + img.height * absSin);
    const h = Math.round(img.width * absSin + img.height * absCos);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    if (flipH) ctx.scale(-1, 1);
    if (flipV) ctx.scale(1, -1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    canvas.toBlob((blob) => {
      setResultUrl(URL.createObjectURL(blob));
    }, 'image/png');
  }, [sourceImage]);

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement('a'); a.href = resultUrl; a.download = 'rotated.png'; a.click();
  };

  return (
    <Stack gap="md">
      <ToolHeader title="Image Rotate / Flip" description="Rotate and flip images with preview" icon={IconRotate} />
      {!sourceImage ? (
        <FileDropZone onFile={handleFile} accept={{ 'image/*': [] }} title="Drop an image" />
      ) : (
        <Stack gap="md">
          <Paper withBorder p="md">
            <Text size="sm" mb={8}>Rotation: {angle}°</Text>
            <Slider value={angle} onChange={setAngle} min={-180} max={180} step={1} marks={[{ value: -180, label: '-180' }, { value: 0, label: '0' }, { value: 180, label: '180' }]} />
          </Paper>

            <Group justify="center" gap="md">
                <Button variant="light" leftSection={<IconRotate size={16} style={{ transform: 'scaleX(-1)' }} />}
                    onClick={() => { const a = angle - 90; setAngle(a); applyTransform(a); }}>-90°</Button>
                <Button variant="light" leftSection={<IconRotate size={16} />}
                    onClick={() => { const a = angle + 90; setAngle(a); applyTransform(a); }}>+90°</Button>
                <Button variant="outline" leftSection={<IconRefresh size={16} style={{ transform: 'scaleX(-1)' }} />}
                    onClick={() => applyTransform(angle, true, false)}>Flip H</Button>
                <Button variant="outline" leftSection={<IconRefresh size={16} />}
                    onClick={() => applyTransform(angle, false, true)}>Flip V</Button>
                <Button onClick={() => applyTransform(angle)}>Apply Rotation</Button>
            </Group>

          <Group grow align="flex-start">
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Original</Text>
              <ImagePreview src={sourceImage.url} maxHeight={300} />
            </Paper>
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Result</Text>
              {resultUrl ? <ImagePreview src={resultUrl} maxHeight={300} /> : <Text c="dimmed" ta="center" py="xl">Apply transform</Text>}
            </Paper>
          </Group>

          {resultUrl && (
            <Group justify="center">
              <Button variant="light" leftSection={<IconDownload size={16} />} onClick={download}>Download</Button>
              <Button variant="subtle" color="red" onClick={() => { setSourceImage(null); setResultUrl(null); }}>Reset</Button>
            </Group>
          )}
        </Stack>
      )}
    </Stack>
  );
}