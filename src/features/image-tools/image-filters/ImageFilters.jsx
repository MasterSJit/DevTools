import { useState, useCallback, useEffect, useRef } from 'react';
import { Stack, Group, Button, Paper, Text, Slider, Switch, SimpleGrid, Badge } from '@mantine/core';
import { IconAdjustments, IconDownload, IconRefresh } from '@tabler/icons-react';
import ToolHeader from '@/shared/components/ToolHeader';
import FileDropZone from '@/shared/components/FileDropZone';
import { useImageTool } from '../shared/useImageTool';

const DEFAULTS = { brightness: 0, contrast: 0, saturation: 0, grayscale: false, sepia: false, invert: false };

export default function ImageFilters() {
  const { sourceImage, resultUrl, resultInfo, loading, loadImage, sendToWorker, downloadResult, reset } = useImageTool();
  const [filters, setFilters] = useState({ ...DEFAULTS });
  const [originalLoaded, setOriginalLoaded] = useState(false);

  const handleFile = useCallback(async (file) => {
    await loadImage(file);
    setFilters({ ...DEFAULTS });
    setOriginalLoaded(true);
  }, [loadImage]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const apply = useCallback(async () => {
    if (!sourceImage?.file) return;
    const buffer = await sourceImage.file.arrayBuffer();
    sendToWorker(buffer, 'filter', filters);
  }, [sourceImage, filters, sendToWorker]);

  const resetFilters = () => { setFilters({ ...DEFAULTS }); };

  return (
    <Stack gap="md">
      <ToolHeader title="Image Filters" description="Adjust brightness, contrast, saturation, and apply filters" icon={IconAdjustments} />
      {!sourceImage ? (
        <FileDropZone onFile={handleFile} accept={{ 'image/*': [] }} title="Drop an image" />
      ) : (
        <Stack gap="md">
          <Paper withBorder p="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <div>
                <Text size="sm" mb={4}>Brightness: {filters.brightness}</Text>
                <Slider value={filters.brightness} onChange={(v) => updateFilter('brightness', v)} min={-100} max={100} mb="md" />
                <Text size="sm" mb={4}>Contrast: {filters.contrast}</Text>
                <Slider value={filters.contrast} onChange={(v) => updateFilter('contrast', v)} min={-100} max={100} mb="md" />
                <Text size="sm" mb={4}>Saturation: {filters.saturation}</Text>
                <Slider value={filters.saturation} onChange={(v) => updateFilter('saturation', v)} min={-100} max={100} mb="md" />
              </div>
              <div>
                <Text size="sm" fw={500} mb="md">Effects</Text>
                <Switch label="Grayscale" checked={filters.grayscale} onChange={(e) => updateFilter('grayscale', e.currentTarget.checked)} mb="sm" />
                <Switch label="Sepia" checked={filters.sepia} onChange={(e) => updateFilter('sepia', e.currentTarget.checked)} mb="sm" />
                <Switch label="Invert" checked={filters.invert} onChange={(e) => updateFilter('invert', e.currentTarget.checked)} mb="sm" />
              </div>
            </SimpleGrid>
          </Paper>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Original</Text>
              <img src={sourceImage.url} style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} />
            </Paper>
            <Paper withBorder p="md">
              <Text size="xs" fw={500} c="dimmed" mb={4}>Filtered</Text>
              {resultUrl ? (
                <>
                  <img src={resultUrl} style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} />
                  {resultInfo && <Badge mt="xs">{(resultInfo.size / 1024).toFixed(1)} KB</Badge>}
                </>
              ) : <Text c="dimmed" ta="center" py="xl">Adjust and apply</Text>}
            </Paper>
          </SimpleGrid>

          <Group justify="center">
            <Button onClick={apply} loading={loading} leftSection={<IconRefresh size={16} />}>Apply Filters</Button>
            <Button variant="light" onClick={resetFilters}>Reset Filters</Button>
            {resultUrl && <Button variant="light" leftSection={<IconDownload size={16} />} onClick={() => downloadResult()}>Download</Button>}
            <Button variant="subtle" color="red" onClick={reset}>New Image</Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}