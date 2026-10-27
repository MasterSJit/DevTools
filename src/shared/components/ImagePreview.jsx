'use client';

import { Box, Text, Center } from '@mantine/core';

export default function ImagePreview({ src, alt, maxHeight = 400, style }) {
  if (!src) {
    return (
      <Center h={200} style={{ border: '1px dashed var(--df-border-color)', borderRadius: 8 }}>
        <Text c="dimmed" size="sm">No image loaded</Text>
      </Center>
    );
  }

  return (
    <Box className="df-checker" style={{ display: 'flex', justifyContent: 'center', overflow: 'auto', borderRadius: 8, ...style }}>
      <img
        src={src}
        alt={alt || 'Preview'}
        style={{ maxWidth: '100%', maxHeight, objectFit: 'contain', borderRadius: 8 }}
      />
    </Box>
  );
}
