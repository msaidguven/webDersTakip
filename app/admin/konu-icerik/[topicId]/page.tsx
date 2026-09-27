import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { describeTopic, type EmbeddedTopic } from '@/app/src/lib/workerRunStats';

export const dynamic = 'force-dynamic';

// Konu içerik araçları artık ders sayfasının içinde açılıyor (kullanıcının 2026-09-26
// isteği: bu ayrı sayfa çok yavaştı). Eski bağlantılar/yer imleri kırılmasın diye bu
// route sadece konunun ders sayfasına yönlendiriyor; ?panel=&sectionId= parametreleri
// ?adminTool=&sectionId= olarak taşınıyor ve DersClient ilgili aracı orada açıyor.
export default async function KonuIcerikRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ panel?: string; sectionId?: string }>;
}) {
  const [{ topicId }, { panel, sectionId }] = await Promise.all([params, searchParams]);
  const id = Number(topicId);
  if (!Number.isInteger(id)) redirect('/admin');

  const supabase = await createClient();
  const { data } = await supabase
    .from('topics')
    .select('title, slug, units(title, slug, lessons(name, slug), grades(name, slug))')
    .eq('id', id)
    .maybeSingle();

  const { href } = describeTopic(data as EmbeddedTopic);
  if (!href) redirect('/admin');

  const query = new URLSearchParams({ adminTool: panel || 'all' });
  if (sectionId) query.set('sectionId', sectionId);
  redirect(`${href}?${query.toString()}`);
}
