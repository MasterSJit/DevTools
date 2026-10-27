'use client';

import { Button } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { downloadBlob } from '@/shared/lib/download';

export default function DownloadButton({ data, filename = 'output.txt', mimeType = 'text/plain', variant = 'light', size = 'sm', children, disabled }) {
  const handleDownload = () => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || 'text/plain' });
    downloadBlob(blob, filename);
  };

  return (
    <Button variant={variant} size={size} onClick={handleDownload} leftSection={<IconDownload size={14} />}
      disabled={disabled ?? (!data || (typeof data === 'string' && !data.length))}>
      {children || 'Download'}
    </Button>
  );
}
