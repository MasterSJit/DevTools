import { useState, useCallback } from 'react';
import { Stack, Group, Button, Paper, Text, Slider, Select, Badge, SimpleGrid } from '@mantine/core';
import { IconPhoto, IconDownload, IconRefresh } from '@tabler/icons-react';
import ToolHeader from '@/shared/components/ToolHeader';
import FileDropZone from '@/shared/components/FileDropZone';
import ImagePreview from '@/shared/components/ImagePreview';
import { useImageTool } from '../shared/useImageTool';

export default function ImageCompress() {
  const { sourceImage, resultUrl, resultInfo, loading, loadImage, sendToWorker, downloadResult, reset } = useImageTool();
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState('image/webp');

  const handleFile = useCallback(async (file) => {
    await loadImage(file);
  }, [loadImage]);

  const compress = useCallback(async () => {
    if (!sourceImage?.file) return;
    const buffer = await sourceImage.file.arrayBuffer();
    sendToWorker(buffer, 'compress', { quality, format });
  }, [sourceImage, quality, format, sendToWorker]);

  const savings = sourceImage && resultInfo
    ? Math.round((1 - resultInfo.size / sourceImage.size) * 100)
    : null;

  return (
    <Stack gap="md">
      <ToolHeader title="Image Compressor" description="Compress images with quality control using browser-native codecs" icon={IconPhoto} />

      {!sourceImage ? (
        <FileDropZone onFile={handleFile}
          accept={{ 'image/png': [], 'image/jpeg': [], 'image/webp': [], 'image/avif': [], 'image/bmp': [], 'image/gif': [] }}
          title="Drop an image to compress" />
      ) : (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Original</Text>
              <ImagePreview src={sourceImage.url} maxHeight={300} />
              <Group mt="xs" justify="center">
                <Badge>{sourceImage.width} x {sourceImage.height}</Badge>
                <Badge color="blue">{(sourceImage.size / 1024).toFixed(1)} KB</Badge>
              </Group>
            </Paper>
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Compressed</Text>
              {resultUrl ? (
                <>
                  <ImagePreview src={resultUrl} maxHeight={300} />
                  <Group mt="xs" justify="center">
                    <Badge>{resultInfo?.width} x {resultInfo?.height}</Badge>
                    <Badge color="teal">{(resultInfo?.size / 1024).toFixed(1)} KB</Badge>
                    {savings !== null && <Badge color={savings > 0 ? 'green' : 'red'}>{savings > 0 ? '↓' : '↑'} {Math.abs(savings)}%</Badge>}
                  </Group>
                </>
              ) : (
                <Group h={300} justify="center"><Text c="dimmed">Click Compress</Text></Group>
              )}
            </Paper>
          </SimpleGrid>

          <Paper withBorder p="md">
            <Group>
              <Select label="Format" value={format} onChange={setFormat} w={160}
                data={[
                  { value: 'image/webp', label: 'WebP' },
                  { value: 'image/jpeg', label: 'JPEG' },
                  { value: 'image/png', label: 'PNG' },
                  { value: 'image/avif', label: 'AVIF' },
                ]} />
              <div style={{ flex: 1 }}>
                <Text size="sm" mb={4}>Quality: {quality}%</Text>
                <Slider value={quality} onChange={setQuality} min={1} max={100} />
              </div>
            </Group>
          </Paper>

          <Group justify="center">
            <Button onClick={compress} loading={loading} leftSection={<IconRefresh size={16} />}>Compress</Button>
            {resultUrl && <Button variant="light" leftSection={<IconDownload size={16} />} onClick={() => downloadResult()}>Download</Button>}
            <Button variant="subtle" color="red" onClick={reset}>Reset</Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}