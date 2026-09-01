import type { SupabaseClient } from '@supabase/supabase-js';

// Konu anlatimi (okuma) ilerlemesi user_topic_content_progress'te tutulur.
// "Bitirdi" durumu tamamen kullanicinin kendi isaretlemesine dayanir (bkz.
// docs/site-iyilestirme-plani.md tartismasi, 2026-09-02) — scroll/sure gibi
// otomatik bir tahmin YAPILMAZ, kullanici "Konuyu Bitirdim" butonuna basmadan
// is_completed asla true olmaz.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>;

export interface TopicContentProgress {
  isCompleted: boolean;
  lastViewedAt: string | null;
}

export async function fetchTopicContentProgress(
  supabase: Client,
  userId: string,
  topicId: number | string
): Promise<TopicContentProgress | null> {
  const { data, error } = await supabase
    .from('user_topic_content_progress')
    .select('is_completed, last_viewed_at')
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { is_completed: boolean; last_viewed_at: string | null };
  return { isCompleted: row.is_completed, lastViewedAt: row.last_viewed_at };
}

// Sadece last_viewed_at'i yazar/gunceller — is_completed alani payload'da hic
// gecmedigi icin ON CONFLICT DO UPDATE mevcut degerini asla ezmez, satir yoksa
// da is_completed kolonunun DEFAULT false'u ile olusur.
export async function touchTopicContentView(supabase: Client, userId: string, topicId: number | string): Promise<void> {
  await supabase
    .from('user_topic_content_progress')
    .upsert(
      { user_id: userId, topic_id: topicId, last_viewed_at: new Date().toISOString() },
      { onConflict: 'user_id,topic_id' }
    );
}

export async function markTopicContentCompleted(supabase: Client, userId: string, topicId: number | string): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('user_topic_content_progress')
    .upsert(
      { user_id: userId, topic_id: topicId, is_completed: true, completed_at: now, last_viewed_at: now },
      { onConflict: 'user_id,topic_id' }
    );
}
