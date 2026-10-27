import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 gap-3">
      <div className="text-6xl font-bold tracking-tight text-slate-300 dark:text-slate-700">404</div>
      <h1 className="m-0 text-xl font-semibold text-slate-900 dark:text-slate-100">This tool doesn&apos;t exist (yet)</h1>
      <p className="m-0 text-sm text-slate-500">Press ⌘K to search, or browse every tool from the home page.</p>
      <Link href="/" className="mt-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-indigo-500">
        Browse all tools
      </Link>
    </div>
  );
}
