import { useState, useCallback, useEffect } from 'react';
import { Stack, Group, Button, Paper, Text, NumberInput, Switch, Badge, SimpleGrid } from '@mantine/core';
import { IconArrowsMaximize, IconDownload, IconLink } from '@tabler/icons-react';
import ToolHeader from '@/shared/components/ToolHeader';
import FileDropZone from '@/shared/components/FileDropZone';
import ImagePreview from '@/shared/components/ImagePreview';
import { useImageTool } from '../shared/useImageTool';

export default function ImageResize() {
  const { sourceImage, resultUrl, resultInfo, loading, loadImage, sendToWorker, downloadResult, reset } = useImageTool();
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [lockAspect, setLockAspect] = useState(true);

  useEffect(() => {
    if (sourceImage) {
      setWidth(sourceImage.width);
      setHeight(sourceImage.height);
    }
  }, [sourceImage]);

  const onWidthChange = (val) => {
    setWidth(val);
    if (lockAspect && sourceImage) {
      setHeight(Math.round(val * (sourceImage.height / sourceImage.width)));
    }
  };

  const onHeightChange = (val) => {
    setHeight(val);
    if (lockAspect && sourceImage) {
      setWidth(Math.round(val * (sourceImage.width / sourceImage.height)));
    }
  };

  const handleFile = useCallback(async (file) => { await loadImage(file); }, [loadImage]);

  const resize = useCallback(async () => {
    if (!sourceImage?.file) return;
    const buffer = await sourceImage.file.arrayBuffer();
    sendToWorker(buffer, 'resize', { width, height, format: 'image/png', quality: 90 });
  }, [sourceImage, width, height, sendToWorker]);

  return (
    <Stack gap="md">
      <ToolHeader title="Image Resizer" description="Resize images to exact pixel dimensions" icon={IconArrowsMaximize} />
      {!sourceImage ? (
        <FileDropZone onFile={handleFile} accept={{ 'image/*': [] }} title="Drop an image to resize" />
      ) : (
        <Stack gap="md">
          <Paper withBorder p="md">
            <Group>
              <NumberInput label="Width (px)" value={width} onChange={onWidthChange} min={1} max={10000} w={140} />
              <Button variant="subtle" mt={24} px={4} onClick={() => setLockAspect((v) => !v)}
                color={lockAspect ? 'violet' : 'gray'}>
                <IconLink size={18} style={{ transform: lockAspect ? 'none' : 'rotate(45deg)' }} />
              </Button>
              <NumberInput label="Height (px)" value={height} onChange={onHeightChange} min={1} max={10000} w={140} />
              <Switch label="Lock aspect ratio" checked={lockAspect} onChange={(e) => setLockAspect(e.currentTarget.checked)} mt={24} />
              <Text size="xs" c="dimmed" mt={24}>Original: {sourceImage.width} x {sourceImage.height}</Text>
            </Group>
          </Paper>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Original</Text>
              <ImagePreview src={sourceImage.url} maxHeight={300} />
            </Paper>
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Resized</Text>
              {resultUrl ? (
                <>
                  <ImagePreview src={resultUrl} maxHeight={300} />
                  <Group mt="xs" justify="center">
                    <Badge>{resultInfo?.width} x {resultInfo?.height}</Badge>
                    <Badge color="green">{(resultInfo?.size / 1024).toFixed(1)} KB</Badge>
                  </Group>
                </>
              ) : <Group h={300} justify="center"><Text c="dimmed">Click Resize</Text></Group>}
            </Paper>
          </SimpleGrid>

          <Group justify="center">
            <Button onClick={resize} loading={loading}>Resize</Button>
            {resultUrl && <Button variant="light" leftSection={<IconDownload size={16} />} onClick={() => downloadResult()}>Download</Button>}
            <Button variant="subtle" color="red" onClick={reset}>Reset</Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}