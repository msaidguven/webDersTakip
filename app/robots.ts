import { MetadataRoute } from 'next';
import { SITE_URL } from '@/app/src/lib/site';

const PRIVATE_PATHS = ['/admin', '/dashboard', '/panel', '/ilerlemem', '/profil', '/progress', '/sirali-test', '/api/'];

// GEÇİCİ (2026-10-04, Vercel Fluid Active CPU sınırı aşıldı — kullanıcı kararı, 1-3 hafta):
// AI tarayıcıları tüm siteden uzak tutuluyor. Arama motorları (Googlebot, Bingbot, YandexBot)
// etkilenmez; Google-Extended / Applebot-Extended yalnız AI eğitimi iznidir, arama sıralamasına
// dokunmaz. Yalnız kurallara uyan botları durdurur. Geri açmak için AI_BOTS_BLOCKED = false.
const AI_BOTS_BLOCKED = true;
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
  'FacebookBot',
  'cohere-ai',
  'Diffbot',
  'YouBot',
  'Timpibot',
  'ImagesiftBot',
  'omgili',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
      ...(AI_BOTS_BLOCKED ? [{ userAgent: AI_BOTS, disallow: '/' }] : []),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
