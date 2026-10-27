'use client';

// ToolHeader is rendered in individual tools, but in this premium design,
// the active tool info is rendered globally in the main workspace header.
// Returning null here prevents duplicate headers across the application.
export default function ToolHeader() {
  return null;
}