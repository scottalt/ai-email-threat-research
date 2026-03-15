import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/auth/', '/api/'],
    },
    sitemap: 'https://research.scottaltiparmak.com/sitemap.xml',
  };
}
