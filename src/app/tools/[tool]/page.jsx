import { notFound } from 'next/navigation';
import { TOOLS, TOOL_ALIASES, getTool } from '@/constants/tools';
import ToolRenderer from './ToolRenderer';
import AliasRedirect from './AliasRedirect';

// Pre-render every tool route so the app also works as a static export.
export const dynamicParams = false;

export function generateStaticParams() {
  return [...TOOLS.map((t) => ({ tool: t.id })), ...Object.keys(TOOL_ALIASES).map((tool) => ({ tool }))];
}

export function generateMetadata({ params }) {
  const tool = getTool(params.tool);
  if (!tool) return TOOL_ALIASES[params.tool] ? { robots: { index: false } } : {};
  return {
    title: `${tool.label} — DevForge`,
    description: `${tool.desc} Runs 100% in your browser.`,
    alternates: { canonical: `/tools/${tool.id}/` },
    openGraph: { title: `${tool.label} — DevForge`, description: tool.desc, url: `/tools/${tool.id}/` },
  };
}

export default function ToolPage({ params }) {
  if (TOOL_ALIASES[params.tool]) return <AliasRedirect to={TOOL_ALIASES[params.tool]} />;
  if (!getTool(params.tool)) notFound();
  return <ToolRenderer id={params.tool} />;
}
