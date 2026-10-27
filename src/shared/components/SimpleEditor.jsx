'use client';

import { Textarea } from '@mantine/core';

export default function SimpleEditor({
  value, onChange, placeholder, minRows = 8, maxRows = 20, readOnly = false, label,
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={placeholder}
      minRows={minRows}
      maxRows={maxRows}
      readOnly={readOnly}
      label={label}
      styles={{
        input: {
          fontFamily: 'var(--mantine-font-family-monospace)',
          fontSize: 13,
          lineHeight: 1.6,
        },
      }}
    />
  );
}