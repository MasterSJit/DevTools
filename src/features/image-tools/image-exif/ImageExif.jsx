import { useState, useCallback } from 'react';
import { Stack, Paper, Text, Table, Badge, Group, Button, ScrollArea } from '@mantine/core';
import exifr from 'exifr';
import { IconInfoCircle, IconEyeOff } from '@tabler/icons-react';
import ToolHeader from '@/shared/components/ToolHeader';
import FileDropZone from '@/shared/components/FileDropZone';
import ImagePreview from '@/shared/components/ImagePreview';

export default function ImageExif() {
  const [sourceImage, setSourceImage] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(async (file) => {
    const url = URL.createObjectURL(file);
    setSourceImage({ url, name: file.name, size: file.size });
    setLoading(true);
    try {
      const data = await exifr.parse(file, { translateKeys: true, translateValues: true });
      setMetadata(data || {});
    } catch (e) {
      setMetadata({ error: e.message });
    }
    setLoading(false);
  }, []);

  const stripExif = useCallback(() => {
    if (!sourceImage?.url) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `stripped_${sourceImage.name}`; a.click();
        URL.revokeObjectURL(url);
      }, 'image/jpeg');
    };
    img.src = sourceImage.url;
  }, [sourceImage]);

  const rows = metadata ? Object.entries(metadata).filter(([k, v]) => v !== undefined && v !== null && typeof v !== 'object') : [];

  return (
    <Stack gap="md">
      <ToolHeader title="EXIF Viewer" description="View and strip image metadata including camera info, GPS, and more" icon={IconInfoCircle} />
      {!sourceImage ? (
        <FileDropZone onFile={handleFile} accept={{ 'image/jpeg': [], 'image/png': [], 'image/webp': [], 'image/tiff': [] }} title="Drop a JPEG/PNG/WebP/TIFF image" />
      ) : (
        <Stack gap="md">
          <Paper withBorder p="md">
            <ImagePreview src={sourceImage.url} maxHeight={300} />
            <Group mt="xs" justify="center">
              <Badge>{sourceImage.name}</Badge>
              <Badge color="blue">{(sourceImage.size / 1024).toFixed(1)} KB</Badge>
            </Group>
          </Paper>

          {loading && <Text ta="center">Reading metadata...</Text>}

          {metadata && rows.length > 0 && (
            <Paper withBorder p="md">
              <Group justify="space-between" mb="md">
                <Text fw={600}>Metadata ({rows.length} fields)</Text>
                <Button variant="light" size="xs" leftSection={<IconEyeOff size={14} />} onClick={stripExif}>
                  Strip EXIF & Download
                </Button>
              </Group>
              <ScrollArea mah={400}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr><Table.Th>Property</Table.Th><Table.Th>Value</Table.Th></Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map(([key, value]) => (
                      <Table.Tr key={key}>
                        <Table.Td><Text size="xs" fw={500}>{key}</Text></Table.Td>
                        <Table.Td><Text size="xs" ff="monospace">{String(value)}</Text></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>
          )}

          {metadata && rows.length === 0 && (
            <Paper withBorder p="xl">
              <Text ta="center" c="dimmed">No EXIF metadata found in this image</Text>
            </Paper>
          )}

          <Group justify="center">
            <Button variant="subtle" color="red" onClick={() => { setSourceImage(null); setMetadata(null); }}>New Image</Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}