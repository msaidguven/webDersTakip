import { MetadataRoute } from 'next';
import { SITE_URL } from '@/app/src/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/panel', '/ilerlemem', '/profil', '/progress', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
