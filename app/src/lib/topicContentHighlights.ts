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

// Gelen (AI JSON'dan veya admin formundan) anahtar kavram listesini doğrular.
export function cleanHighlights(topicContentId: number | string, raw: IncomingHighlight[] | undefined): CleanHighlight[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((h): h is IncomingHighlight & { title: string; description: string } =>
      typeof h.title === 'string' && h.title.trim().length > 0 &&
      typeof h.description === 'string' && h.description.trim().length > 0
    )
    .map((h, idx) => ({
      topic_content_id: topicContentId,
      icon: typeof h.icon === 'string' && h.icon.trim() ? h.icon.trim() : null,
      title: h.title.trim(),
      description: h.description.trim(),
      order_no: typeof h.order_no === 'number' ? h.order_no : idx,
    }));
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
