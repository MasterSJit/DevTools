'use client';

import { Group, Text, rem } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconUpload, IconX, IconPhoto } from '@tabler/icons-react';

export default function FileDropZone({
  onFile, accept, maxSize = 50 * 1024 * 1024, compact = false,
  title = 'Drop files here or click to browse', height,
}) {
  const handleDrop = (files) => {
    if (files.length > 0) onFile?.(files[0]);
  };

  if (compact) {
    return (
      <Dropzone onDrop={handleDrop} accept={accept} maxSize={maxSize} p={4} h={32}
        style={{ cursor: 'pointer', display: 'inline-flex' }}
      >
        <Group gap={4} justify="center" h="100%">
          <IconUpload size={14} />
          <Text size="xs">Upload</Text>
        </Group>
      </Dropzone>
    );
  }

  return (
    <Dropzone onDrop={handleDrop} accept={accept} maxSize={maxSize} h={height || 120}>
      <Group justify="center" gap="xl" mih={height ? height - 20 : 100} style={{ pointerEvents: 'none' }}>
        <Dropzone.Accept>
          <IconUpload size={40} stroke={1.5} color="var(--mantine-color-violet-5)" />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <IconX size={40} stroke={1.5} color="var(--mantine-color-red-5)" />
        </Dropzone.Reject>
        <Dropzone.Idle>
          <IconPhoto size={40} stroke={1.5} />
        </Dropzone.Idle>
        <div>
          <Text size="sm" inline>{title}</Text>
          <Text size="xs" c="dimmed" inline mt={4}>
            Max file size: {(maxSize / 1024 / 1024).toFixed(0)}MB
          </Text>
        </div>
      </Group>
    </Dropzone>
  );
}