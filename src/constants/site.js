// Public URL of the deployed site, used for the sitemap, robots.txt, canonical and Open Graph URLs.
// Set NEXT_PUBLIC_SITE_URL at build time (GitHub → Settings → Variables → SITE_URL for the deploy workflow).
// No real domain is hard-coded; local builds fall back to localhost.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
