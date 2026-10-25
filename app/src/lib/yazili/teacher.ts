// Öğretmen paneli → "Yazılı hazırla" (docs/yazili-sorulari-plani.md 4. adım). Öğretmen yalnız yayındaki
// yazılıları ve yalnız kendi branşlarını (teacher_lessons) görür; admin hepsini. Soru verisi herkese açık
// sayfayla aynı kaynaktan (getYaziliExam) gelir — öğretmen fazladan gizli bir şey görmez, yalnız kendi
// kağıdını kurar. Kağıt saklanmaz: istemci soru sırası + puanları gönderir, sunucu her soruyu bu yazılının
// havuzunda doğrular.
import 'server-only';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getYaziliExam, getYaziliIndex, type YaziliQuestion } from '@/app/src/lib/yazili/publicData';
import type { TeacherAccess } from '@/app/src/lib/teacherAuth';
import { buildPaperHtml } from '@/app/src/lib/yazili/paperPdfHtml';

export type TeacherExamItem = {
  id: number; gradeName: string; lessonName: string; label: string; national: boolean;
  examDate: string | null; questionCount: number; path: string; slugs: [string, string, string];
};

const MAX_PAPER_QUESTIONS = 40;
const TEXT_LIMIT = 120;

async function teacherLessonSlugs(userId: string): Promise<Set<string>> {
  const supabase = createServiceClient();
  const { data: rows } = await supabase.from('teacher_lessons').select('lessons(slug)').eq('teacher_id', userId);
  return new Set(((rows as unknown as { lessons: { slug: string } | null }[] | null) ?? []).flatMap((r) => (r.lessons ? [r.lessons.slug] : [])));
}

export async function listTeacherExams(access: Extract<TeacherAccess, { ok: true }>): Promise<TeacherExamItem[]> {
  const [index, mine] = await Promise.all([
    getYaziliIndex(),
    access.role === 'teacher' ? teacherLessonSlugs(access.user.id) : Promise.resolve(null),
  ]);
  return index.flatMap((g) =>
    g.lessons
      .filter((l) => !mine || mine.has(l.slug))
      .flatMap((l) =>
        l.exams.map((e) => ({
          id: e.id,
          gradeName: g.name,
          lessonName: l.name,
          label: e.label,
          national: e.national,
          examDate: e.examDate,
          questionCount: e.questionCount,
          path: e.path,
          slugs: [g.slug, l.slug, e.path.split('/').at(-1)!] as [string, string, string],
        }))
      )
  );
}

// Kağıt bilgilerinin varsayılanı: öğretmenin profilindeki okul ve ad soyad (okul listeden seçildiyse
// school_name zaten dolu; değilse school_id'den okunur).
export async function loadTeacherPaperDefaults(userId: string): Promise<{ school: string; teacherName: string }> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('profiles').select('full_name, school_name, schools(name)').eq('id', userId).maybeSingle();
  const row = data as unknown as { full_name: string | null; school_name: string | null; schools: { name: string } | null } | null;
  return {
    school: (row?.school_name || row?.schools?.name || '').trim(),
    teacherName: (row?.full_name || '').trim(),
  };
}

export async function loadTeacherExam(access: Extract<TeacherAccess, { ok: true }>, examId: number) {
  const item = (await listTeacherExams(access)).find((e) => e.id === examId);
  if (!item) return null;
  const data = await getYaziliExam(...item.slugs);
  return data ? { item, data } : null;
}

export type PaperRequest = {
  examId: number;
  items: { question: YaziliQuestion; points: number }[];
  school: string;
  teacherName: string;
  title: string;
  answerKey: boolean;
  columns: 1 | 2;
};

const cleanText = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT) : '');

// POST gövdesi: { examId, items: [{ id, points }], school?, teacherName?, title?, answerKey?, columns? (1|2) }.
export async function resolvePaperRequest(
  access: Extract<TeacherAccess, { ok: true }>,
  body: unknown
): Promise<{ ok: true; req: PaperRequest; fileBase: string } | { ok: false; status: number; error: string }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const examId = Number(b.examId);
  const rawItems = Array.isArray(b.items) ? (b.items as { id?: unknown; points?: unknown }[]) : [];
  if (!Number.isInteger(examId) || !rawItems.length || rawItems.length > MAX_PAPER_QUESTIONS) {
    return { ok: false, status: 400, error: `Kağıtta 1–${MAX_PAPER_QUESTIONS} soru olmalı` };
  }

  const loaded = await loadTeacherExam(access, examId);
  if (!loaded) return { ok: false, status: 404, error: 'Yazılı bulunamadı' };

  const byId = new Map(loaded.data.topics.flatMap((t) => t.questions).map((q) => [q.id, q]));
  const seen = new Set<number>();
  const items: PaperRequest['items'] = [];
  for (const it of rawItems) {
    const id = Number(it.id);
    const points = Number(it.points);
    const question = byId.get(id);
    if (!question || seen.has(id)) return { ok: false, status: 400, error: 'Kağıtta bu yazılıya ait olmayan ya da tekrar eden soru var' };
    if (!Number.isInteger(points) || points < 0 || points > 100) return { ok: false, status: 400, error: 'Puanlar 0–100 arası tam sayı olmalı' };
    seen.add(id);
    items.push({ question, points });
  }

  const { data, item } = loaded;
  return {
    ok: true,
    req: {
      examId,
      items,
      school: cleanText(b.school),
      teacherName: cleanText(b.teacherName),
      title: cleanText(b.title) || `${data.gradeName} ${data.lessonName} Dersi ${data.exam.label} Sınavı`,
      answerKey: b.answerKey === true,
      columns: b.columns === 2 ? 2 : 1,
    },
    fileBase: `${item.slugs.join('-')}`.replace(/[^a-z0-9-]/gi, ''),
  };
}

// Öğretmen kağıdının HTML'i — PDF (Chromium) ve indirmeden önceki önizleme aynı şablonu kullanır.
export function buildTeacherPaperHtml(req: PaperRequest): string {
  return buildPaperHtml({
    title: req.title,
    subtitle: req.answerKey ? 'CEVAP ANAHTARI' : `${req.items.length} soru · ${req.items.reduce((n, i) => n + i.points, 0)} puan`,
    items: req.items,
    answerKey: req.answerKey,
    school: req.school,
    teacherName: req.teacherName,
    columns: req.columns,
  });
}
