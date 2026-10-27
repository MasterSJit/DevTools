'use client';

import { ActionIcon, Tooltip } from '@mantine/core';
import { IconLayoutColumns, IconLayoutRows } from '@tabler/icons-react';

export default function ViewToggle({ value, onChange }) {
  const isHorizontal = value !== 'vertical';
  const handleToggle = () => {
    onChange(isHorizontal ? 'vertical' : 'horizontal');
  };

  return (
    <Tooltip label={isHorizontal ? 'Switch to stacked layout' : 'Switch to side-by-side layout'}>
      <ActionIcon variant="subtle" size="lg" color="gray" radius="md" onClick={handleToggle} aria-label="Toggle layout">
        {isHorizontal ? <IconLayoutColumns size={18} /> : <IconLayoutRows size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}
