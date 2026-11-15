import 'server-only';
// Anlatım ekranlarına gerçek fotoğraf (2026-11-06, kullanıcı isteği): Wikimedia Commons'ta aranır, yalnız serbest
// lisanslı (kamu malı, CC0, CC BY, CC BY-SA) dosyalar alınır, yazar + lisans + kaynak ekranda gösterilir.
// Akış: AI her ekran için İngilizce arama kelimeleri yazar → Commons'tan aday listesi → AI adaylardan en uygununu
// seçer ya da hiçbirini seçmez (uymayan resim gösterilmez). Commons araması ücretsiz, anahtar gerektirmez.
import { generateGeminiJson, type GeminiInlineImage } from '@/app/src/lib/geminiJsonGen';
import type { GeminiWorkerProfile } from '@/app/src/lib/geminiWorkerProfile';
import { TERM_LINK, type LessonDefinition, type LessonPhoto } from './types';

const API = 'https://commons.wikimedia.org/w/api.php';
// Wikimedia kuralı: tanımlayıcı User-Agent.
const UA = 'DersTakipLessonPhotos/1.0 (https://www.derstakip.net)';
const FREE = /^(public domain|pd|cc0|cc by(-sa)? \d)/i;

type Candidate = LessonPhoto & { title: string; description: string; thumb: string };

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

export async function searchCommons(query: string, limit = 10): Promise<Candidate[]> {
  const url = new URL(API);
  Object.entries({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: String(limit * 2),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size',
    iiurlwidth: '960',
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { query?: { pages?: Record<string, { title: string; index?: number; imageinfo?: { thumburl?: string; width: number; height: number; descriptionurl: string; extmetadata?: Record<string, { value?: string }> }[] }> } };
  return Object.values(data.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p): Candidate[] => {
      const ii = p.imageinfo?.[0];
      const m = ii?.extmetadata ?? {};
      const license = stripHtml(m.LicenseShortName?.value ?? '');
      // Küçük resimler (ekranda bulanık) ve serbest olmayan lisanslar elenir.
      if (!ii?.thumburl || !FREE.test(license) || Math.max(ii.width, ii.height) < 600) return [];
      return [{
        title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        description: stripHtml(m.ImageDescription?.value ?? '').slice(0, 200),
        url: ii.thumburl.replace(/\?.*$/, ''),
        // Seçim için küçük kopya (Wikimedia standart küçük resim boyutu).
        thumb: ii.thumburl.replace(/\?.*$/, '').replace(/\/\d+px-/, '/330px-'),
        alt: '',
        credit: stripHtml(m.Artist?.value ?? '').slice(0, 80) || 'Bilinmeyen yazar',
        license,
        source: ii.descriptionurl,
      }];
    })
    .slice(0, limit);
}

async function fetchThumb(url: string): Promise<GeminiInlineImage | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) return null;
    return { mimeType: type.split(';')[0], data: Buffer.from(await res.arrayBuffer()).toString('base64') };
  } catch {
    return null;
  }
}

// Dersin anlatım ekranlarına fotoğraf ekler (var olanı değiştirmez; redo ile yeniden seçer). 2 AI çağrısı.
export async function addLessonPhotos(
  lesson: LessonDefinition,
  topic: { title: string; grade: string; lesson: string },
  profile: GeminiWorkerProfile,
  opts: { redo?: boolean } = {},
): Promise<{ lesson: LessonDefinition; added: string[]; skipped: string[] }> {
  const next = structuredClone(lesson);
  const screens = next.blocks.flatMap((b, bi) =>
    b.steps.flatMap((st, si) => (st.kind === 'anlatim' && (opts.redo || !st.photo) ? [{ id: `b${bi}s${si}`, step: st, block: b.title }] : [])),
  );
  if (!screens.length) return { lesson: next, added: [], skipped: [] };
  const plain = (t?: string) => (t ?? '').replace(TERM_LINK, '$1');
  const list = screens.map((s) => `- ${s.id} · ${s.block} · ${s.step.title}: ${plain(s.step.body)}`).join('\n');
  const ctx = `Konu: ${topic.grade} ${topic.lesson} · "${topic.title}" (ortaokul).`;

  // 1) Arama kelimeleri
  const q = await generateGeminiJson(
    `${ctx}
Aşağıdaki ders ekranlarının her biri için Wikimedia Commons'ta gerçek bir FOTOĞRAF arayacağız. Her ekran için
ekrandaki bilgiyi en iyi gösterecek, somut ve fotoğraflanabilir bir şeyi anlatan 2-4 kelimelik İNGİLİZCE arama sorgusu yaz
(ör. "smart watch wrist", "augmented reality phone app"). Soyut kavramlarda o kavramın gerçek hayattaki örneğini ara.
Fotoğrafla gösterilemeyecek ekranda sorguyu boş bırak.
EKRANLAR:
${list}
ÇIKTI yalnız JSON: {"queries":[{"id":"…","query":"…"}]}`,
    profile,
  );
  const queries = new Map<string, string>();
  for (const it of (q.data as { queries?: { id?: unknown; query?: unknown }[] })?.queries ?? []) {
    if (typeof it.id === 'string' && typeof it.query === 'string' && it.query.trim()) queries.set(it.id, it.query.trim());
  }

  // 2) Commons adayları (sırayla; Wikimedia'yı yormamak için paralel değil)
  const candidates = new Map<string, Candidate[]>();
  for (const s of screens) {
    const query = queries.get(s.id);
    if (!query) continue;
    const found = await searchCommons(query, 8).catch(() => []);
    if (found.length) candidates.set(s.id, found);
  }
  if (!candidates.size) return { lesson: next, added: [], skipped: screens.map((s) => s.id) };

  // 3) Seçim RESİMLERE BAKARAK (2026-11-06: yalnız dosya adına göre seçince alakasız/yanlış alt metinli resimler
  // geçti): her ekranın ilk 4 adayı küçük boyutta modele gösterilir. Uygun aday yoksa -1.
  const images: GeminiInlineImage[] = [];
  const blocks: string[] = [];
  for (const s of screens.filter((x) => candidates.has(x.id))) {
    const lines = [`### ${s.id} · ${s.step.title}: ${plain(s.step.body)}`];
    for (const [i, c] of candidates.get(s.id)!.slice(0, 4).entries()) {
      const img = await fetchThumb(c.thumb);
      if (!img) continue;
      images.push(img);
      lines.push(`  aday ${i} = RESİM #${images.length} (${c.title})`);
    }
    if (lines.length > 1) blocks.push(lines.join('\n'));
  }
  const pick = await generateGeminiJson(
    `${ctx}
Ekte numaralı resimler var (RESİM #1, #2… ekteki sırayla). Her ekran için adaylara BAKARAK ekrandaki bilgiyi en iyi gösteren resmi seç.
Kurallar: resimde ekranda anlatılan şey açıkça görünmeli; ortaokul öğrencisine uygun olmalı; GERÇEK fotoğraf olmalı (ekran görüntüsü,
logo/marka ağırlıklı, yazı ağırlıklı, şema, bulanık ya da karanlık resim değil). Uygun aday yoksa -1 ver (uymayan resim göstermekten iyidir).
Seçtiğin resim için resimde GERÇEKTEN görüneni anlatan kısa TÜRKÇE alt metin yaz (≤90 karakter).
${blocks.join('\n\n')}
ÇIKTI yalnız JSON: {"picks":[{"id":"…","index":<aday numarası ya da -1>,"alt":"…"}]}`,
    profile,
    images,
  );
  const added: string[] = [];
  for (const it of (pick.data as { picks?: { id?: unknown; index?: unknown; alt?: unknown }[] })?.picks ?? []) {
    const s = screens.find((x) => x.id === it.id);
    const c = s && Number.isInteger(it.index) ? candidates.get(s.id)?.[Number(it.index)] : undefined;
    if (!s || !c) continue;
    const { title: _t, description: _d, thumb: _th, ...photo } = c;
    void _t;
    void _d;
    void _th;
    s.step.photo = { ...photo, alt: (typeof it.alt === 'string' && it.alt.trim().slice(0, 120)) || s.step.title };
    added.push(`${s.id} ${s.step.title} → ${c.title} (${c.license})`);
  }
  return { lesson: next, added, skipped: screens.filter((s) => !added.some((a) => a.startsWith(`${s.id} `))).map((s) => `${s.id} ${s.step.title}`) };
}
