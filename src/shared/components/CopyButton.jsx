'use client';

import { Button, ActionIcon, Tooltip } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';

export default function CopyButton({ value, variant = 'light', size = 'sm', icon = false }) {
  const [copied, setCopied] = useState(false);
  const copy = useCopyToClipboard();

  const handleCopy = async () => {
    await copy(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (icon) {
    return (
      <Tooltip label={copied ? 'Copied!' : 'Copy'}>
        <ActionIcon variant="subtle" onClick={handleCopy} color={copied ? 'teal' : 'gray'}>
          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
        </ActionIcon>
      </Tooltip>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
      color={copied ? 'teal' : undefined}
    >
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}