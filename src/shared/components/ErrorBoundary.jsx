'use client';

import { Component } from 'react';
import { Alert, Button, Code, Stack } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

// Keeps one crashing tool from taking down the whole layout.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Alert color="red" icon={<IconAlertTriangle />} title="This tool crashed">
        <Stack gap="sm">
          <Code block>{String(this.state.error?.message || this.state.error)}</Code>
          <div>
            <Button size="xs" variant="light" color="red" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </div>
        </Stack>
      </Alert>
    );
  }
}
