import type { SupabaseClient } from '@supabase/supabase-js';

export type IncomingHighlight = {
  icon?: unknown;
  title?: unknown;
  description?: unknown;
  order_no?: unknown;
};

export type CleanHighlight = {
  topic_content_id: number | string;
  icon: string | null;
  title: string;
  description: string;
  order_no: number;
};

export type NormalizedHighlight = Omit<CleanHighlight, 'topic_content_id'>;

// Gelen (AI JSON'dan veya admin formundan) anahtar kavram listesini doğrular. Henüz bir
// topic_content satırı yokken de (ör. onay bekleyen AI taslağı) kullanılabilsin diye
// topic_content_id'siz sürüm ayrı tutuluyor.
export function normalizeHighlights(raw: IncomingHighlight[] | undefined): NormalizedHighlight[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((h): h is IncomingHighlight & { title: string; description: string } =>
      typeof h.title === 'string' && h.title.trim().length > 0 &&
      typeof h.description === 'string' && h.description.trim().length > 0
    )
    .map((h, idx) => ({
      icon: typeof h.icon === 'string' && h.icon.trim() ? h.icon.trim() : null,
      title: h.title.trim(),
      description: h.description.trim(),
      order_no: typeof h.order_no === 'number' ? h.order_no : idx,
    }));
}

export function cleanHighlights(topicContentId: number | string, raw: IncomingHighlight[] | undefined): CleanHighlight[] {
  return normalizeHighlights(raw).map((h) => ({ topic_content_id: topicContentId, ...h }));
}

export async function replaceHighlights(
  supabase: SupabaseClient,
  topicContentId: number | string,
  clean: CleanHighlight[]
) {
  const { error: deleteError } = await supabase
    .from('topic_content_highlights')
    .delete()
    .eq('topic_content_id', topicContentId);
  if (deleteError) return deleteError;

  if (clean.length) {
    const { error: insertError } = await supabase.from('topic_content_highlights').insert(clean);
    if (insertError) return insertError;
  }

  return null;
}
