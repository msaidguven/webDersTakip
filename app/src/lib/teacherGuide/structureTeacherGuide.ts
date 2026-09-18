import { generateJsonCompletion } from '../rag/gemini';
import { extractJson } from '../extractJson';

export type TeacherGuideTopicNote = {
  topicId: number;
  recommendedHours: number | null;
  emphasisNotes: string | null;
};

// Öğretmen kılavuz kitabından (PDF -> ünite bazlı ham metin, bkz. pdfExtract.ts)
// çıkarılan metni, konu bazlı yapılandırılmış nota çevirir. NotebookLM-üzerinden-büyük-PDF
// yolunda (bkz. app/prompt/30-teacher-guide-unit-extract.md) AYNI şema admin tarafından
// dışarıda çalıştırılıp JSON olarak yapıştırılıyor — bu fonksiyon SADECE otomatik
// (doğrudan PDF -> Gemini) yolda çağrılıyor.
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

Görev: Kılavuz metninde HER konu için (varsa) önerilen ders saatini VE öğretmene "vurgulanması/önemli/dikkat edilmesi gereken" diye belirtilen noktaları çıkar. Kılavuzda bir konu için açık bilgi yoksa ilgili alanı null bırak — uydurma, tahmin etme.

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "topics": [
    {
      "topic_id": integer,
      "recommended_hours": number|null,
      "emphasis_notes": string|null
    }
  ]
}`;

  const raw = await generateJsonCompletion(`${prompt}\n\nKılavuz metni:\n${unitText}`);
  return parseTeacherGuideJson(raw, topics);
}

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
    const emphasisNotes =
      typeof obj.emphasis_notes === 'string' && obj.emphasis_notes.trim() ? obj.emphasis_notes.trim() : null;
    result.push({ topicId, recommendedHours, emphasisNotes });
  }
  return result;
}
