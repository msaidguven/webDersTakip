import 'server-only';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Öğretmen kağıdı olay kaydı (bkz. supabase/migrations/teacher_paper_events.sql). Kayıt başarısız olsa da
// öğretmenin işi (indirme vb.) etkilenmez — yalnız loglanır.
export type PaperEvent =
  | { kind: 'download'; teacherId: string; examId: number; questionIds: number[]; format: 'pdf' | 'key' | 'word' }
  | { kind: 'remove'; teacherId: string; examId: number; questionId: number }
  | { kind: 'swap'; teacherId: string; examId: number; questionId: number; replacedBy: number };

export async function logPaperEvent(e: PaperEvent): Promise<void> {
  const row = {
    teacher_id: e.teacherId,
    exam_id: e.examId,
    kind: e.kind,
    question_ids: e.kind === 'download' ? e.questionIds : null,
    format: e.kind === 'download' ? e.format : null,
    question_id: e.kind === 'download' ? null : e.questionId,
    replaced_by: e.kind === 'swap' ? e.replacedBy : null,
  };
  const { error } = await createServiceClient().from('teacher_paper_events').insert(row);
  if (error) console.error('[teacher_paper_events] kaydedilemedi:', error.message);
}
