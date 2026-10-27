import { useState, useCallback } from 'react';
import { Stack, Group, Button, Paper, Text, Select, Badge, SimpleGrid, Slider } from '@mantine/core';
import { IconRefresh, IconDownload } from '@tabler/icons-react';
import ToolHeader from '@/shared/components/ToolHeader';
import FileDropZone from '@/shared/components/FileDropZone';
import ImagePreview from '@/shared/components/ImagePreview';
import { useImageTool } from '../shared/useImageTool';

export default function ImageConvert() {
  const { sourceImage, resultUrl, resultInfo, loading, loadImage, sendToWorker, downloadResult, reset } = useImageTool();
  const [targetFormat, setTargetFormat] = useState('image/png');
  const [quality, setQuality] = useState(90);

  const handleFile = useCallback(async (file) => {
    await loadImage(file);
  }, [loadImage]);

  const convert = useCallback(async () => {
    if (!sourceImage?.file) return;
    const buffer = await sourceImage.file.arrayBuffer();
    sendToWorker(buffer, 'convert', { format: targetFormat, quality });
  }, [sourceImage, targetFormat, quality, sendToWorker]);

  const ext = targetFormat.split('/')[1];

  return (
    <Stack gap="md">
      <ToolHeader title="Image Converter" description="Convert between PNG, JPEG, WebP, AVIF, BMP, GIF formats" icon={IconRefresh} />
      {!sourceImage ? (
        <FileDropZone onFile={handleFile} accept={{ 'image/*': [] }} title="Drop an image to convert" />
      ) : (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Original</Text>
              <ImagePreview src={sourceImage.url} maxHeight={300} />
              <Group mt="xs" justify="center">
                <Badge>{sourceImage.name}</Badge>
                <Badge color="blue">{(sourceImage.size / 1024).toFixed(1)} KB</Badge>
              </Group>
            </Paper>
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Converted</Text>
              {resultUrl ? (
                <>
                  <ImagePreview src={resultUrl} maxHeight={300} />
                  <Group mt="xs" justify="center">
                    <Badge color="teal">{ext.toUpperCase()}</Badge>
                    <Badge color="green">{(resultInfo?.size / 1024).toFixed(1)} KB</Badge>
                  </Group>
                </>
              ) : (
                <Group h={300} justify="center"><Text c="dimmed">Select format and convert</Text></Group>
              )}
            </Paper>
          </SimpleGrid>

          <Paper withBorder p="md">
            <Group>
              <Select label="Target Format" value={targetFormat} onChange={setTargetFormat} w={180}
                data={[
                  { value: 'image/png', label: 'PNG' },
                  { value: 'image/jpeg', label: 'JPEG' },
                  { value: 'image/webp', label: 'WebP' },
                  { value: 'image/avif', label: 'AVIF' },
                  { value: 'image/bmp', label: 'BMP' },
                ]} />
              {(targetFormat === 'image/jpeg' || targetFormat === 'image/webp' || targetFormat === 'image/avif') && (
                <div style={{ flex: 1 }}>
                  <Text size="sm" mb={4}>Quality: {quality}%</Text>
                  <Slider value={quality} onChange={setQuality} min={1} max={100} />
                </div>
              )}
            </Group>
          </Paper>

          <Group justify="center">
            <Button onClick={convert} loading={loading}>Convert to {ext.toUpperCase()}</Button>
            {resultUrl && <Button variant="light" leftSection={<IconDownload size={16} />}
              onClick={() => downloadResult(`converted.${ext}`)}>Download</Button>}
            <Button variant="subtle" color="red" onClick={reset}>Reset</Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}