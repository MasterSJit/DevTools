import { useState, useCallback } from 'react';
import { Stack, Group, Button, Paper, Text, Badge, Progress, ColorInput } from '@mantine/core';
import { IconEraser, IconDownload } from '@tabler/icons-react';
import ToolHeader from '@/shared/components/ToolHeader';
import FileDropZone from '@/shared/components/FileDropZone';

export default function ImageBgRemove() {
  const [sourceImage, setSourceImage] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [bgColor, setBgColor] = useState('');
  const [replaceBg, setReplaceBg] = useState(false);

  const handleFile = useCallback(async (file) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setSourceImage({ url, file, img, name: file.name, size: file.size, width: img.width, height: img.height });
    img.src = url;
    setResultUrl(null);
    setError(null);
  }, []);

  const removeBackground = useCallback(async () => {
    if (!sourceImage?.file) return;
    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      const imglyRemoveBackground = (await import('@imgly/background-removal')).default;
      const blob = await imglyRemoveBackground(sourceImage.file, {
        progress: (key, current, total) => {
          if (total > 0) setProgress(Math.round((current / total) * 100));
        },
      });

      let outputBlob = blob;
      if (replaceBg && bgColor) {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise((resolve) => { img.onload = resolve; img.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        outputBlob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        URL.revokeObjectURL(url);
      }

      setResultUrl(URL.createObjectURL(outputBlob));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [sourceImage, bgColor, replaceBg]);

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement('a'); a.href = resultUrl; a.download = 'no-bg.png'; a.click();
  };

  return (
    <Stack gap="md">
      <ToolHeader title="Background Remover" description="Remove image backgrounds using client-side AI (no server needed)" icon={IconEraser} />
      {!sourceImage ? (
        <FileDropZone onFile={handleFile} accept={{ 'image/*': [] }} title="Drop an image (model downloads ~40MB on first use)" />
      ) : (
        <Stack gap="md">
          <Group grow>
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Original</Text>
              <img src={sourceImage.url} style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} />
              <Group mt="xs" justify="center">
                <Badge>{sourceImage.width} x {sourceImage.height}</Badge>
                <Badge color="blue">{(sourceImage.size / 1024).toFixed(1)} KB</Badge>
              </Group>
            </Paper>
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Result</Text>
              {resultUrl ? (
                <div style={{ background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 16px 16px', borderRadius: 8 }}>
                  <img src={resultUrl} style={{ maxWidth: '100%', maxHeight: 300, display: 'block' }} />
                </div>
              ) : loading ? (
                <Stack align="center" py="xl">
                  <Text size="sm">Processing... (first run downloads the AI model)</Text>
                  <Progress value={progress} w="80%" striped animated />
                  <Badge>{progress}%</Badge>
                </Stack>
              ) : (
                <Text c="dimmed" ta="center" py="xl">Click Remove Background</Text>
              )}
            </Paper>
          </Group>

          {error && <Text c="red" size="sm" ta="center">{error}</Text>}

          <Paper withBorder p="md">
            <Group>
              <Button onClick={removeBackground} loading={loading} disabled={!sourceImage}>
                Remove Background
              </Button>
              <ColorInput label="Replace BG Color (optional)" value={bgColor} onChange={setBgColor}
                placeholder="Leave empty for transparent" w={220} />
            </Group>
          </Paper>

          {resultUrl && (
            <Group justify="center">
              <Button variant="light" leftSection={<IconDownload size={16} />} onClick={download}>Download PNG</Button>
              <Button variant="subtle" color="red" onClick={() => { setSourceImage(null); setResultUrl(null); }}>New Image</Button>
            </Group>
          )}
        </Stack>
      )}
    </Stack>
  );
}