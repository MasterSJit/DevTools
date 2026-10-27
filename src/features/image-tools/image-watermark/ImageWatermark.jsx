import { useState, useCallback, useRef, useEffect } from 'react';
import { Stack, Group, Button, Paper, Text, TextInput, Slider, Select, ColorInput, NumberInput } from '@mantine/core';
import { IconTypography, IconDownload } from '@tabler/icons-react';
import ToolHeader from '@/shared/components/ToolHeader';
import FileDropZone from '@/shared/components/FileDropZone';

export default function ImageWatermark() {
  const [sourceImage, setSourceImage] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [text, setText] = useState('© DevForge');
  const [fontSize, setFontSize] = useState(32);
  const [opacity, setOpacity] = useState(50);
  const [position, setPosition] = useState('center');
  const [color, setColor] = useState('#ffffff');

  const handleFile = useCallback(async (file) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setSourceImage({ url, img, name: file.name, width: img.width, height: img.height });
    img.src = url;
    setResultUrl(null);
  }, []);

  const apply = useCallback(() => {
    if (!sourceImage) return;
    const { img, width, height } = sourceImage;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    const positions = {
      'center': [(width - metrics.width) / 2, height / 2],
      'top-left': [20, fontSize],
      'top-right': [width - metrics.width - 20, fontSize],
      'bottom-left': [20, height - fontSize],
      'bottom-right': [width - metrics.width - 20, height - fontSize],
      'tile': null,
    };

    if (position === 'tile') {
      const gapX = metrics.width + 100;
      const gapY = fontSize * 4;
      for (let y = 0; y < height; y += gapY) {
        for (let x = 0; x < width; x += gapX) {
          ctx.save();
          ctx.translate(x + gapX / 2, y + gapY / 2);
          ctx.rotate(-Math.PI / 6);
          ctx.fillText(text, -metrics.width / 2, 0);
          ctx.restore();
        }
      }
    } else {
      const [x, y] = positions[position];
      ctx.fillText(text, x, y);
    }

    canvas.toBlob((blob) => setResultUrl(URL.createObjectURL(blob)), 'image/png');
  }, [sourceImage, text, fontSize, opacity, position, color]);

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement('a'); a.href = resultUrl; a.download = 'watermarked.png'; a.click();
  };

  return (
    <Stack gap="md">
      <ToolHeader title="Image Watermark" description="Add text watermarks to images with position and style controls" icon={IconTypography} />
      {!sourceImage ? (
        <FileDropZone onFile={handleFile} accept={{ 'image/*': [] }} title="Drop an image" />
      ) : (
        <Stack gap="md">
          <Paper withBorder p="md">
            <Group>
              <TextInput label="Watermark Text" value={text} onChange={(e) => setText(e.currentTarget.value)} style={{ flex: 1 }} />
              <NumberInput label="Font Size" value={fontSize} onChange={setFontSize} min={8} max={200} w={120} />
              <ColorInput label="Color" value={color} onChange={setColor} w={140} />
            </Group>
            <Group mt="md">
              <div style={{ flex: 1 }}>
                <Text size="sm" mb={4}>Opacity: {opacity}%</Text>
                <Slider value={opacity} onChange={setOpacity} min={5} max={100} />
              </div>
              <Select label="Position" value={position} onChange={setPosition} w={160}
                data={[
                  { value: 'center', label: 'Center' },
                  { value: 'top-left', label: 'Top Left' },
                  { value: 'top-right', label: 'Top Right' },
                  { value: 'bottom-left', label: 'Bottom Left' },
                  { value: 'bottom-right', label: 'Bottom Right' },
                  { value: 'tile', label: 'Tile / Repeat' },
                ]} />
            </Group>
          </Paper>

          <Group grow>
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Original</Text>
              <img src={sourceImage.url} style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} />
            </Paper>
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Result</Text>
              {resultUrl ? <img src={resultUrl} style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} /> : <Text c="dimmed" ta="center" py="xl">Apply watermark</Text>}
            </Paper>
          </Group>

          <Group justify="center">
            <Button onClick={apply}>Apply Watermark</Button>
            {resultUrl && <Button variant="light" leftSection={<IconDownload size={16} />} onClick={download}>Download</Button>}
            <Button variant="subtle" color="red" onClick={() => { setSourceImage(null); setResultUrl(null); }}>Reset</Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}