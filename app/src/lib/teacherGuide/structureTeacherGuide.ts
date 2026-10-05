import { readFile } from 'fs/promises';
import path from 'path';
import { generateJsonCompletion } from '../rag/gemini';
import { extractJson } from '../extractJson';
import { generateGeminiJson } from '../geminiJsonGen';
import type { GeminiWorkerProfile } from '../geminiWorkerProfile';

// Kılavuz içe aktarma seyrek ve elle tetiklenen bir iş: YALNIZ içerik worker'ının key'ini
// kullanır, 503'te diğer modele geçer. GEMINI_API_KEY (öğrenci sohbeti) bilerek yok —
// 2026-10-04'te 49 konuluk içe aktarma onun günlük kotasını da tüketmişti.
const TEACHER_GUIDE_GEMINI_PROFILE: GeminiWorkerProfile = {
  model: 'gemini-3.6-flash',
  fallbackModels: ['gemini-3.8-flash'],
  apiKeyEnvs: ['GEMINI_API_KEY_CONTENT'],
};

export type TeacherGuideKeyTerm = { term: string; definition: string };

// Kılavuzdan konu başına çıkarılan yapılandırılmış bilgi. emphasis_notes eski (2026-09-18)
// tek alanlı şemadan kalma; diğerleri 2026-10-04'te eklendi — kitapsız derslerde 5 AI'a
// verilen kaynak metin promptu yalnız 2-3 cümlelik vurgu notu görüyordu, kapsam/tanım/örnek
// bilgisinin tamamı içe aktarmada atılıyordu.
export type TeacherGuideDetails = {
  emphasisNotes: string | null;
  contentPoints: string[] | null;
  keyTerms: TeacherGuideKeyTerm[] | null;
  examples: string[] | null;
  scopeNotes: string | null;
  misconceptions: string[] | null;
  prerequisites: string | null;
  assessmentNotes: string | null;
};

export type TeacherGuideTopicNote = TeacherGuideDetails & {
  topicId: number;
  recommendedHours: number | null;
  // Yalnız PDF metninden (splitGuideByTopic) gelen içe aktarmada dolu: kılavuzun bu konuya
  // ait ham bölümü — yeniden yapılandırma gerekirse PDF'e dönmeden buradan yapılır.
  sourceText?: string | null;
  sourcePages?: string | null;
};

const EMPTY_DETAILS: TeacherGuideDetails = {
  emphasisNotes: null,
  contentPoints: null,
  keyTerms: null,
  examples: null,
  scopeNotes: null,
  misconceptions: null,
  prerequisites: null,
  assessmentNotes: null,
};

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function strList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return str(v) ? [str(v)!] : null;
  const list = v.map(str).filter((s): s is string => s != null);
  return list.length ? list : null;
}

function keyTermList(v: unknown): TeacherGuideKeyTerm[] | null {
  if (!Array.isArray(v)) return null;
  const list = v
    .map((e) => (e && typeof e === 'object' ? { term: str((e as Record<string, unknown>).term), definition: str((e as Record<string, unknown>).definition) } : null))
    .filter((e): e is TeacherGuideKeyTerm => !!e?.term && !!e.definition);
  return list.length ? list : null;
}

export function parseTeacherGuideDetails(obj: Record<string, unknown>): TeacherGuideDetails {
  return {
    emphasisNotes: str(obj.emphasis_notes),
    contentPoints: strList(obj.content_points),
    keyTerms: keyTermList(obj.key_terms),
    examples: strList(obj.examples),
    scopeNotes: str(obj.scope_notes),
    misconceptions: strList(obj.misconceptions),
    prerequisites: str(obj.prerequisites),
    assessmentNotes: str(obj.assessment_notes),
  };
}

// PDF metninden konuya ayrılmış (bkz. splitGuideByTopic.ts) TEK bir kılavuz bölümünü
// yapılandırır. Ünite bazlı eski yolun aksine model tek konunun metnini görüyor — 25 konuluk
// bir dersi tek çağrıda özetletmek vurgu notunu 2-3 cümleye sıkıştırıyordu.
export async function structureTeacherGuideTopicText(input: {
  gradeName: string;
  lessonName: string;
  topicTitle: string;
  outcomesText: string;
  pages: string;
  sourceText: string;
  glossaryText: string | null;
}): Promise<TeacherGuideDetails> {
  const template = await readFile(path.join(process.cwd(), 'app', 'prompt', '34-teacher-guide-topic-extract.md'), 'utf8');
  const prompt = template
    .replaceAll('{grade}', input.gradeName)
    .replaceAll('{lesson}', input.lessonName)
    .replaceAll('{topic}', input.topicTitle)
    .replaceAll('{outcomes}', input.outcomesText)
    .replaceAll('{pages}', input.pages)
    .replaceAll('{glossary}', input.glossaryText || '(sözlük yok)')
    .replaceAll('{source_text}', input.sourceText);
  const { data: parsed } = await generateGeminiJson(prompt, TEACHER_GUIDE_GEMINI_PROFILE);
  if (!parsed || typeof parsed !== 'object') throw new Error('Kılavuz yapılandırma çıktısı JSON değil');
  return parseTeacherGuideDetails(parsed as Record<string, unknown>);
}

// Öğretmen kılavuz kitabından (PDF -> ünite bazlı ham metin, bkz. pdfExtract.ts)
// çıkarılan metni, konu bazlı yapılandırılmış nota çevirir. Kılavuz splitGuideByTopic ile
// konulara bölünemediğinde (farklı biçimli kılavuz) yedek yol olarak kalıyor.
export async function structureTeacherGuideUnitText(
  unitText: string,
  gradeName: string,
  lessonName: string,
  unitTitle: string,
  topics: { id: number; title: string }[]
): Promise<TeacherGuideTopicNote[]> {
  const topicListText = topics.map((t) => `- (topic_id=${t.id}) ${t.title}`).join('\n');

  const prompt = `Aşağıda ${gradeName} ${lessonName} dersi "${unitTitle}" ünitesi için ÖĞRETMEN KILAVUZ KİTABINDAN çıkarılmış ham metin var.

Bu ünitenin bizim sistemimizdeki konuları (SADECE bu listedekileri kullan, başka konu uydurma, hiçbirini atlama):
${topicListText}

Görev: Kılavuz metninde HER konu için önerilen ders saatini ve öğrencinin öğrenmesi gereken bilgiyi çıkar. Sınıf yönetimi/lojistik talimatlarını (grup kurma, materyal dağıtma, karekod vb.) alma. Kılavuzda olmayan bilgi ekleme; bilgi yoksa alanı null bırak.

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "topics": [
    {
      "topic_id": integer,
      "recommended_hours": number|null,
      "content_points": [string],
      "key_terms": [{ "term": string, "definition": string }],
      "examples": [string],
      "scope_notes": string|null,
      "emphasis_notes": string|null,
      "misconceptions": [string],
      "prerequisites": string|null,
      "assessment_notes": string|null
    }
  ]
}`;

  const raw = await generateJsonCompletion(`${prompt}\n\nKılavuz metni:\n${unitText}`);
  return parseTeacherGuideJson(raw, topics);
}

// Hem NotebookLM'den yapıştırılan ders bazlı JSON'u hem ünite bazlı Gemini çıktısını okur.
// Yeni alanlar yoksa (eski şemayla üretilmiş JSON) null kalır.
export function parseTeacherGuideJson(raw: string, topics: { id: number; title: string }[]): TeacherGuideTopicNote[] {
  const parsed = extractJson(raw) as { topics?: unknown };
  const topicsOut = Array.isArray(parsed?.topics) ? parsed.topics : [];
  const validTopicIds = new Set(topics.map((t) => t.id));

  const result: TeacherGuideTopicNote[] = [];
  for (const entry of topicsOut) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const topicId = Number(obj.topic_id);
    if (!validTopicIds.has(topicId)) continue;
    const recommendedHours =
      typeof obj.recommended_hours === 'number' && Number.isFinite(obj.recommended_hours) ? obj.recommended_hours : null;
    result.push({ ...EMPTY_DETAILS, ...parseTeacherGuideDetails(obj), topicId, recommendedHours });
  }
  return result;
}
