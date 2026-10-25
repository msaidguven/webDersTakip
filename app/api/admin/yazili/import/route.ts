import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { DEFAULT_EXAM_WEEKS } from '@/app/src/lib/yazili/common';
import { parseMebDistribution } from '@/app/src/lib/yazili/mebDistribution';
import { loadTopicLoCodes, revalidateYaziliPages } from '@/app/src/lib/yazili/server';

// Admin → Yazılı Soruları → "MEB tablosunu yükle": ÖDSGM konu-soru dağılım Excel'i (bir ders, sınıf başına
// bir sayfa) okunur; sitede olan her sınıf-ders-yazılı için senaryo dağılımı (exam_lo_targets) yazılır ve
// konu listesi (exam_topics) tablodaki kodlara sahip konulardan yeniden kurulur. Yazılının durumu
// (taslak/yayında) ve tarihi korunur. Sitede olmayan sınıf (ör. 8) ve ders sayfaları atlanır, raporda yazar.
// Hiç öğrenme çıktısı kaydı olmayan konuya (ör. 6. Din, 2026-10-20) adı tablodaki konuyla birebir aynıysa
// tablodaki resmî kod + metin eklenir; var olan kayıtlara ve kazanımlara (outcomes) dokunulmaz.

const trNorm = (s: string) => s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();

type SheetReport = { sheet: string; status: 'imported' | 'skipped'; reason?: string; addedLoCodes?: string[]; exams?: { examNo: number; national: boolean; scenarios: number; codes: number; topics: number; unmatched: string[] }[] };

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string' || !file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: '.xlsx dosyası seç' }, { status: 400 });
  }
  let sheets;
  try {
    sheets = parseMebDistribution(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: 'Excel okunamadı' }, { status: 400 });
  }
  if (!sheets.length) return NextResponse.json({ error: 'MEB konu-soru dağılım tablosu bulunamadı ("… SINIF … DERSİ" başlığı aranıyor)' }, { status: 400 });

  const supabase = createServiceClient();
  const [{ data: gradesData }, { data: lessonsData }] = await Promise.all([
    supabase.from('grades').select('id, name').eq('is_active', true),
    supabase.from('lessons').select('id, name'),
  ]);
  const grades = (gradesData as { id: number; name: string }[] | null) ?? [];
  const lessons = (lessonsData as { id: number; name: string }[] | null) ?? [];

  const report: SheetReport[] = [];
  for (const sheet of sheets) {
    const grade = grades.find((g) => trNorm(g.name) === trNorm(`${sheet.gradeNo}. Sınıf`));
    const lesson = lessons.find((l) => trNorm(l.name) === trNorm(sheet.lessonTitle));
    if (!grade || !lesson) {
      report.push({ sheet: sheet.sheetName, status: 'skipped', reason: !grade ? `${sheet.gradeNo}. sınıf sitede yok` : `"${sheet.lessonTitle}" dersi sitede yok` });
      continue;
    }

    const { data: topicsData } = await supabase
      .from('topics')
      .select('id, title, order_no, units!inner(order_no, grade_id, lesson_id)')
      .eq('units.grade_id', grade.id)
      .eq('units.lesson_id', lesson.id)
      .eq('is_active', true)
      .eq('is_archived', false);
    type T = { id: number; title: string; order_no: number; units: { order_no: number } };
    const topics = ((topicsData as unknown as T[] | null) ?? []).sort((a, b) => a.units.order_no - b.units.order_no || a.order_no - b.order_no);
    if (!topics.length) {
      report.push({ sheet: sheet.sheetName, status: 'skipped', reason: `${grade.name} ${lesson.name} konusu yok` });
      continue;
    }
    let loByTopic = await loadTopicLoCodes(supabase, topics.map((t) => t.id));

    const missing = topics.filter((t) => !(loByTopic.get(t.id) ?? []).length);
    const toAdd = missing.flatMap((t) => sheet.outcomes.filter((o) => trNorm(o.konu) === trNorm(t.title)).map((o, i) => ({ topic_id: t.id, code: o.loCode, title: o.loTitle, order_no: i })));
    if (toAdd.length) {
      const { error } = await supabase.from('topic_learning_outcomes').insert(toAdd);
      if (error) return NextResponse.json({ error: error.message, report }, { status: 500 });
      loByTopic = await loadTopicLoCodes(supabase, topics.map((t) => t.id));
    }
    const knownCodes = new Set([...loByTopic.values()].flat());

    const examReports: NonNullable<SheetReport['exams']> = [];
    for (const exam of sheet.exams) {
      // Kod hücresi boş satır: konu adından kod çöz (konunun tek öğrenme çıktısı varsa).
      const targets = exam.targets.map((t) => {
        if (t.loCode) return t;
        const topic = topics.find((x) => trNorm(x.title) === trNorm(t.konu));
        const codes = topic ? loByTopic.get(topic.id) ?? [] : [];
        return { ...t, loCode: codes.length === 1 ? codes[0] : null };
      });
      const codes = [...new Set(targets.map((t) => t.loCode).filter((c): c is string => !!c))];
      const unmatched = [
        ...codes.filter((c) => !knownCodes.has(c)),
        ...targets.filter((t) => !t.loCode).map((t) => `"${t.konu}"`),
      ];
      const topicIds = topics.filter((t) => (loByTopic.get(t.id) ?? []).some((c) => codes.includes(c))).map((t) => t.id);

      const def = DEFAULT_EXAM_WEEKS[`${sheet.term}-${exam.examNo}`];
      const { data: existing } = await supabase
        .from('exams')
        .select('id')
        .eq('grade_id', grade.id).eq('lesson_id', lesson.id).eq('term', sheet.term).eq('exam_no', exam.examNo)
        .maybeSingle();
      let examId = (existing as { id: number } | null)?.id;
      if (examId) {
        await supabase.from('exams').update({ national: exam.national, updated_at: new Date().toISOString() }).eq('id', examId);
      } else {
        const { data: created, error } = await supabase
          .from('exams')
          .insert({ grade_id: grade.id, lesson_id: lesson.id, term: sheet.term, exam_no: exam.examNo, week_from: def.from, week_to: def.to, national: exam.national })
          .select('id')
          .single();
        if (error || !created) return NextResponse.json({ error: error?.message ?? 'Yazılı oluşturulamadı', report }, { status: 500 });
        examId = (created as { id: number }).id;
      }

      const { error: delError } = await supabase.from('exam_lo_targets').delete().eq('exam_id', examId);
      if (delError) return NextResponse.json({ error: delError.message, report }, { status: 500 });
      const rows = targets
        .filter((t): t is typeof t & { loCode: string } => !!t.loCode)
        .map((t) => ({ exam_id: examId, scenario_no: t.scenario, lo_code: t.loCode, question_count: t.count }));
      if (rows.length) {
        const { error } = await supabase.from('exam_lo_targets').insert(rows);
        if (error) return NextResponse.json({ error: error.message, report }, { status: 500 });
      }
      // Ülke geneli sınavda tablo kapsam vermiyor — konu listesine dokunulmaz (admin elle seçer).
      if (!exam.national) {
        await supabase.from('exam_topics').delete().eq('exam_id', examId);
        if (topicIds.length) await supabase.from('exam_topics').insert(topicIds.map((topic_id, order_no) => ({ exam_id: examId, topic_id, order_no })));
      }
      examReports.push({ examNo: exam.examNo, national: exam.national, scenarios: exam.scenarioCount, codes: codes.length, topics: exam.national ? 0 : topicIds.length, unmatched });
    }
    report.push({ sheet: sheet.sheetName, status: 'imported', addedLoCodes: toAdd.map((a) => a.code), exams: examReports });
  }

  revalidateYaziliPages();
  return NextResponse.json({ ok: true, term: sheets[0].term, lessonTitle: sheets[0].lessonTitle, report });
}
