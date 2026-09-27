// Konu okuma sayfasının hangi tasarımla gösterileceği. Kullanıcının 2026-09-27 isteği: admin
// konu sayfasındaki "Tasarım" düğmesinden seçince HERKES o tasarımı görsün — değer artık kodda
// değil veritabanında (site_settings.topic_page_design, bkz.
// supabase/migrations/site_settings_topic_page_design.sql). Değiştirme: /api/admin/site-settings.
// ?tasarim=v1|v2 parametresi sadece o sayfa görüntülemesi için önizleme yapar.
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export type TopicPageDesign = 'v1' | 'v2';

// Tablo/satır yoksa ya da okunamazsa (ör. migration henüz çalıştırılmadı) güvenli varsayılan.
export const DEFAULT_TOPIC_PAGE_DESIGN: TopicPageDesign = 'v1';

export const TOPIC_PAGE_DESIGN_KEY = 'topic_page_design';

// Tüm konu sayfalarını kapsayan route — ayar değişince hepsi birlikte revalidate edilir.
export const TOPIC_PAGE_ROUTE = '/[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]';

export function isTopicPageDesign(value: unknown): value is TopicPageDesign {
  return value === 'v1' || value === 'v2';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getTopicPageDesign = cache(async (supabase: SupabaseClient<any, any, any>): Promise<TopicPageDesign> => {
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', TOPIC_PAGE_DESIGN_KEY).maybeSingle();
  const value = (data as { value: unknown } | null)?.value;
  return !error && isTopicPageDesign(value) ? value : DEFAULT_TOPIC_PAGE_DESIGN;
});
