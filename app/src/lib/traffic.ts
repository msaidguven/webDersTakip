// Saatlik ziyaretçi/üye trafik sınıflandırması (bkz. supabase/migrations/traffic_hourly_buckets.sql).
// Ham IP, ham User-Agent veya serbest metin veritabanına asla yazılmaz — her alan sabit enum kümesine indirgenir.
import { DEVICE_TYPES, type DeviceType } from './acquisition';

export { DEVICE_TYPES, type DeviceType };

export const VISITOR_TYPES = ['guest', 'member'] as const;
export type VisitorType = (typeof VISITOR_TYPES)[number];

export const APP_MODES = ['browser', 'pwa', 'in_app'] as const;
export type AppMode = (typeof APP_MODES)[number];

export const SOURCE_GROUPS = ['google', 'other_search', 'social', 'direct', 'referral'] as const;
export type SourceGroup = (typeof SOURCE_GROUPS)[number];

export const LANDING_GROUPS = [
  'anasayfa',
  'ders-konu',
  'soru-bankasi',
  'yazili',
  'takdir-hesaplama',
  'kavram-avi',
  'diger',
] as const;
export type LandingGroup = (typeof LANDING_GROUPS)[number];

export function isDeviceType(v: unknown): v is DeviceType {
  return typeof v === 'string' && (DEVICE_TYPES as readonly string[]).includes(v);
}

export function isAppMode(v: unknown): v is AppMode {
  return typeof v === 'string' && (APP_MODES as readonly string[]).includes(v);
}

export function isSourceGroup(v: unknown): v is SourceGroup {
  return typeof v === 'string' && (SOURCE_GROUPS as readonly string[]).includes(v);
}

export function isLandingGroup(v: unknown): v is LandingGroup {
  return typeof v === 'string' && (LANDING_GROUPS as readonly string[]).includes(v);
}

// acquisition.ts ile birebir aynı cihaz eşiği.
export function detectDeviceType(width: number, coarsePointer: boolean): DeviceType {
  if (width < 768) return 'mobile';
  if (width < 1024 && coarsePointer) return 'tablet';
  return 'desktop';
}

const IN_APP_RE = /Instagram|FBAN|FBAV|FB_IAB|Line\/|WhatsApp|BytedanceWebview|musical_ly|TikTok|Snapchat|Twitter|MicroMessenger|; wv\)/i;

export function detectAppMode(userAgent: string, isStandalone: boolean): AppMode {
  if (isStandalone) return 'pwa';
  if (IN_APP_RE.test(userAgent)) return 'in_app';
  return 'browser';
}

const GOOGLE_HOST_RE = /(^|\.)google\.|googlequicksearchbox|com\.google\.android/i;
const OTHER_SEARCH_RE = /(^|\.)(bing|yandex|duckduckgo|yahoo|ecosia|startpage)\./i;
const SOCIAL_HOST_RE = /(^|\.)(instagram|facebook|fb|youtube|youtu\.be|tiktok|twitter|x\.com|t\.co|whatsapp|wa\.me|pinterest|reddit|linkedin|telegram|t\.me)\b/i;

function classifyUtmSource(utm: string): SourceGroup {
  const s = utm.toLowerCase();
  if (s.includes('google')) return 'google';
  if (/bing|yandex|duckduckgo|yahoo/.test(s)) return 'other_search';
  if (/insta|ig|fb|facebook|youtube|yt|tiktok|whatsapp|wa|twitter|x|social|telegram/.test(s)) return 'social';
  return 'referral';
}

export function classifySource(referrer: string, search: string, currentHost: string): SourceGroup {
  try {
    const utm = new URLSearchParams(search).get('utm_source')?.trim();
    if (utm) return classifyUtmSource(utm);
  } catch {
    // Geçersiz sorgu dizesi: referrer ile devam.
  }

  if (!referrer) return 'direct';
  if (/^android-app:\/\/com\.google\./i.test(referrer)) return 'google';

  try {
    const url = new URL(referrer);
    if (url.host === currentHost) return 'direct';
    const host = url.host.toLowerCase();
    if (GOOGLE_HOST_RE.test(host)) return 'google';
    if (OTHER_SEARCH_RE.test(host)) return 'other_search';
    if (SOCIAL_HOST_RE.test(host)) return 'social';
    return 'referral';
  } catch {
    return 'direct';
  }
}

export function classifyLandingGroup(pathname: string): LandingGroup {
  const p = (pathname || '/').toLowerCase();
  if (p === '/' || p === '') return 'anasayfa';
  if (p.startsWith('/soru-bankasi') || p.startsWith('/karisik-test') || p.startsWith('/sirali-test') || p.startsWith('/soru')) {
    return 'soru-bankasi';
  }
  if (p.startsWith('/yazili-sorulari')) return 'yazili';
  if (p.startsWith('/takdir-tesekkur-hesaplama')) return 'takdir-hesaplama';
  if (p.startsWith('/kavram-avi')) return 'kavram-avi';
  if (p.startsWith('/ders') || p.startsWith('/sinif') || /^\/\d+-sinif(\/|$)/.test(p)) {
    return 'ders-konu';
  }
  return 'diger';
}

const BOT_UA_RE = /bot|crawl|spider|slurp|mediapartners|adsbot|lighthouse|pagespeed|headlesschrome|phantomjs|selenium|playwright|puppeteer|curl|wget|python-requests|go-http-client|facebookexternalhit|twitterbot|whatsapp|telegrambot|discordbot|applebot|bingpreview|yandex/i;

export function isLikelyBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim().length < 10) return true;
  return BOT_UA_RE.test(userAgent);
}
