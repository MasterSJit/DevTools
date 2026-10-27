import { TOOLS } from '@/constants/tools';
import { SITE_URL } from '@/constants/site';

export const dynamic = 'force-static';

export default function sitemap() {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    ...TOOLS.map((t) => ({ url: `${SITE_URL}/tools/${t.id}/`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 })),
  ];
}
