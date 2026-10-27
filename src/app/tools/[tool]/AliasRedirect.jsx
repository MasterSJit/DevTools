'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader, Text, Stack } from '@mantine/core';

// Static exports can't send HTTP redirects, so retired tool URLs forward on the client.
export default function AliasRedirect({ to }) {
  const router = useRouter();
  useEffect(() => { router.replace(to); }, [router, to]);
  return (
    <Center h="50vh">
      <Stack align="center" gap="xs">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">This tool moved — taking you to its new home…</Text>
      </Stack>
    </Center>
  );
}
