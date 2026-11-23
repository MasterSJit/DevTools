import { notFound } from 'next/navigation';
import { TOOLS, TOOL_ALIASES, getTool } from '@/constants/tools';
import ToolRenderer from './ToolRenderer';
import AliasRedirect from './AliasRedirect';

// Pre-render every tool route so the app also works as a static export.
export const dynamicParams = false;

export function generateStaticParams() {
  return [...TOOLS.map((t) => ({ tool: t.id })), ...Object.keys(TOOL_ALIASES).map((tool) => ({ tool }))];
}

// Next 15: route params are a Promise.
export async function generateMetadata({ params }) {
  const { tool: id } = await params;
  const tool = getTool(id);
  if (!tool) return TOOL_ALIASES[id] ? { robots: { index: false } } : {};
  return {
    title: `${tool.label} — DevForge`,
    description: `${tool.desc} Runs 100% in your browser.`,
    alternates: { canonical: `/tools/${tool.id}/` },
    openGraph: { title: `${tool.label} — DevForge`, description: tool.desc, url: `/tools/${tool.id}/` },
  };
}

export default async function ToolPage({ params }) {
  const { tool: id } = await params;
  if (TOOL_ALIASES[id]) return <AliasRedirect to={TOOL_ALIASES[id]} />;
  if (!getTool(id)) notFound();
  return <ToolRenderer id={id} />;
}
