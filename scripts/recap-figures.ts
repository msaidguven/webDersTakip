// Hap bilgi örneklerinin şekilleri (bkz. app/src/lib/recapCards.ts: example.figure_prompt / figure_svg). Model şekli
// yalnız tarif eder; SVG'yi Claude çizer ("kart şekillerini çiz") ve bu script kaydeder — ya da admin /admin/svg-sorulari?tur=kart
// ekranında promptu kopyalayıp başka bir AI'ya çizdirir. Çizilene kadar örnek gizli.
//
// Kullanım:
//   npx tsx scripts/recap-figures.ts list                  (şekil bekleyen örnekler: bölüm id, tarif, soru, çözüm)
//   npx tsx scripts/recap-figures.ts set 1880 sekil.svg    (SVG'yi o bölümün örneğine yazar)

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { isRecapFigureSvg, normalizeRecapCard } from '../app/src/lib/recapCards';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !(m[1].trim() in process.env)) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

async function list() {
  const { data, error } = await supabase
    .from('topic_content_sections')
    .select('id, heading, recap_card, topic_contents!inner(topics!inner(id, title))')
    .not('recap_card->example->>figure_prompt', 'is', null)
    .is('recap_card->example->>figure_svg', null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => {
    const card = normalizeRecapCard(r.recap_card);
    const tc = r.topic_contents as unknown as { topics: { id: number; title: string } };
    return { sectionId: r.id, topicId: tc.topics.id, topic: tc.topics.title, heading: r.heading, example: card?.example };
  });
  console.log(JSON.stringify(rows, null, 2));
}

async function set(sectionId: number, file: string) {
  const svg = readFileSync(file, 'utf8').trim();
  if (!isRecapFigureSvg(svg)) throw new Error('Geçersiz SVG (<svg …</svg>, en fazla 20.000 karakter)');
  const { data, error } = await supabase.from('topic_content_sections').select('recap_card').eq('id', sectionId).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? `Bölüm ${sectionId} bulunamadı`);
  const card = normalizeRecapCard(data.recap_card);
  if (!card?.example?.figure_prompt) throw new Error(`Bölüm ${sectionId} kartında şekil isteyen örnek yok`);
  const next = { ...card, example: { ...card.example, figure_svg: svg } };
  const { error: updateError } = await supabase.from('topic_content_sections').update({ recap_card: next }).eq('id', sectionId);
  if (updateError) throw new Error(updateError.message);
  console.log(`Bölüm ${sectionId}: şekil kaydedildi.`);
}

const [cmd, a, b] = process.argv.slice(2);
(cmd === 'list' ? list() : cmd === 'set' && Number(a) > 0 && b ? set(Number(a), b) : Promise.reject(new Error('Kullanım: list | set <sectionId> <svgDosyası>'))).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
