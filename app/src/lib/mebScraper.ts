import * as cheerio from 'cheerio';

const MEB_ORIGIN = 'https://tymm.meb.gov.tr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

export type MebLesson = { slug: string; name: string };
export type MebOutcome = { code: string; description: string };
export type ScrapedMebUnit = {
  title: string;
  durationHours: number | null;
  topics: string[];
  outcomes: MebOutcome[];
  sourceUrl: string;
};
export type UnitImportPayload = {
  title: string;
  curriculum_code: string | null;
  duration_hours: number;
  topics: { title: string; curriculum_code: string | null; outcomes: MebOutcome[] }[];
};
export type BuiltUnit =
  | { status: 'ready'; payload: UnitImportPayload }
  | { status: 'needs_review'; scraped: ScrapedMebUnit };

async function fetchMebHtml(path: string): Promise<string> {
  const res = await fetch(`${MEB_ORIGIN}${path}`, { headers: { 'User-Agent': UA }, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`MEB sayfası alınamadı (${res.status}): ${path}`);
  }
  return res.text();
}

function extractGradeNumber(text: string): number | null {
  const m = text.match(/(\d+)\.\s*Sınıf/i);
  return m ? Number(m[1]) : null;
}

export async function listMebLessons(): Promise<MebLesson[]> {
  const html = await fetchMebHtml('/ogretim-programlari/temel-egitim');
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const lessons: MebLesson[] = [];

  $('a[href^="/ogretim-programlari/ders/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const slug = href.replace('/ogretim-programlari/ders/', '').replace(/\/$/, '');
    const name = $(el).text().trim();
    if (!slug || !name || seen.has(slug)) return;
    seen.add(slug);
    lessons.push({ slug, name });
  });

  return lessons;
}

// URL'deki sınıf segmenti MEB'in kendi iç indeksi olabilir, gerçek sınıfla birebir
// eşleşmeyebilir (doğrulandı — bkz. plan). Bu yüzden URL'deki sayıya güvenmek yerine
// her adayın kendi içindeki "X.Sınıf" metnini okuyup hedef sınıfla eşleşeni buluyoruz.
export async function resolveMebGradeUrl(
  dersSlug: string,
  targetGradeNumber: number
): Promise<{ segment: string; path: string } | null> {
  const dersHtml = await fetchMebHtml(`/ogretim-programlari/ders/${dersSlug}`);
  const $ = cheerio.load(dersHtml);

  const prefix = `/ogretim-programlari/${dersSlug}/`;
  const segments = new Set<string>();
  $(`a[href^="${prefix}"]`).each((_, el) => {
    const href = $(el).attr('href') || '';
    const segment = href.slice(prefix.length).replace(/\/$/, '');
    if (segment) segments.add(segment);
  });

  const candidates = await Promise.all(
    Array.from(segments).map(async (segment) => {
      const path = `${prefix}${segment}`;
      try {
        const html = await fetchMebHtml(path);
        const $$ = cheerio.load(html);
        const gradeNumber = extractGradeNumber($$('title').text()) ?? extractGradeNumber($$('body').text());
        return { segment, path, gradeNumber };
      } catch {
        return { segment, path, gradeNumber: null };
      }
    })
  );

  const match = candidates.find((c) => c.gradeNumber === targetGradeNumber);
  return match ? { segment: match.segment, path: match.path } : null;
}

export async function listMebUnitsForGradePage(dersSlug: string, gradePath: string): Promise<{ id: string; path: string }[]> {
  const html = await fetchMebHtml(gradePath);
  const $ = cheerio.load(html);
  const prefix = `/${dersSlug}/unite/`;
  const seen = new Set<string>();
  const units: { id: string; path: string }[] = [];

  $(`a[href^="${prefix}"]`).each((_, el) => {
    const href = $(el).attr('href') || '';
    const id = href.slice(prefix.length).replace(/\/$/, '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    units.push({ id, path: href });
  });

  return units;
}

function htmlFragmentToText(fragment: string): string {
  return cheerio.load(`<div>${fragment}</div>`)('div').text().trim();
}

function findContentByLabel($: cheerio.CheerioAPI, label: string): cheerio.Cheerio<import('domhandler').Element> | null {
  const titleEl = $('.title').filter((_, el) => $(el).text().trim() === label).first();
  if (!titleEl.length) return null;
  const next = titleEl.next('.content');
  return next.length ? next : null;
}

export async function scrapeMebUnit(dersSlug: string, unitPath: string): Promise<ScrapedMebUnit> {
  const html = await fetchMebHtml(unitPath);
  const $ = cheerio.load(html);

  const h1 = $('h1').first();
  const rawTitle = h1.text().trim();
  const title = rawTitle.replace(/^\d+\.\s*ÜNİTE:\s*/i, '').trim();

  const headerContainer = h1.closest('.d-flex');
  const gradeNumber = extractGradeNumber(headerContainer.text());

  const durationContent = findContentByLabel($, 'Ders Saati');
  const durationHours = durationContent ? Number(durationContent.text().trim()) || null : null;

  const topicsContent = findContentByLabel($, 'İçerik Çerçevesi');
  const topics: string[] = [];
  if (topicsContent) {
    const innerHtml = topicsContent.find('p').first().html() ?? topicsContent.html() ?? '';
    innerHtml
      .split(/<br\s*\/?>/i)
      .map((piece) => htmlFragmentToText(piece))
      .filter(Boolean)
      .forEach((t) => topics.push(t));
  }

  const outcomesContent = findContentByLabel($, 'Öğrenme Çıktıları ve Süreç Bileşenleri');
  const outcomes: MebOutcome[] = [];
  if (outcomesContent) {
    outcomesContent.find('p').each((_, p) => {
      const strongText = $(p).find('strong').first().text().trim();
      const m = strongText.match(/^([A-ZÇĞİÖŞÜ]+(?:\.\d+)+)\.\s*(.+)$/);
      if (m) outcomes.push({ code: m[1], description: m[2].trim() });
    });
  }

  // Sınıf çözümleme zaten sayfa seviyesinde doğrulandığı için burada bir uyuşmazlık
  // teorik olarak olmamalı — olursa bu gerçek bir hata/bug'dır, sessizce yutulmaz.
  if (gradeNumber == null) {
    throw new Error(`Ünite sayfasında sınıf bilgisi bulunamadı: ${unitPath}`);
  }

  return { title, durationHours, topics, outcomes, sourceUrl: `${MEB_ORIGIN}${unitPath}` };
}

export function buildUnitImportPayload(scraped: ScrapedMebUnit): BuiltUnit {
  if (!scraped.durationHours || !scraped.topics.length || scraped.topics.length !== scraped.outcomes.length) {
    return { status: 'needs_review', scraped };
  }

  return {
    status: 'ready',
    payload: {
      title: scraped.title,
      curriculum_code: null,
      duration_hours: scraped.durationHours,
      topics: scraped.topics.map((t, i) => ({
        title: t,
        curriculum_code: scraped.outcomes[i].code.split(/\.\d+$/)[0] || null,
        outcomes: [scraped.outcomes[i]],
      })),
    },
  };
}
