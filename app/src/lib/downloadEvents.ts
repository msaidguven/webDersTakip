import 'server-only';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// İndirme kaydı (bkz. supabase/migrations/download_stats.sql): admin anasayfası "İndirmeler" bunu okur. Kayıt
// başarısız olsa da indirme etkilenmez — yalnız loglanır; çağıranlar yanıt gittikten sonra (after) yazar.
export type DownloadEvent =
  | { kind: 'topic_pdf'; userId: string; topicId: number; cached: boolean }
  | { kind: 'question_export'; userId: string };

export async function logDownload(e: DownloadEvent): Promise<void> {
  const { error } = await createServiceClient().from('file_download_events').insert({
    user_id: e.userId,
    kind: e.kind,
    topic_id: e.kind === 'topic_pdf' ? e.topicId : null,
    cached: e.kind === 'topic_pdf' ? e.cached : null,
  });
  if (error) console.error('[file_download_events] kaydedilemedi:', error.message);
}
