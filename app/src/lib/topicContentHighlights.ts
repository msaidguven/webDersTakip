import type { SupabaseClient } from '@supabase/supabase-js';

export const HIGHLIGHT_POSITIONS = ['top-left', 'mid-left', 'bottom-left', 'top-right', 'mid-right', 'bottom-right'] as const;
export type HighlightPosition = (typeof HIGHLIGHT_POSITIONS)[number];

export type IncomingHighlight = {
  position?: unknown;
  icon?: unknown;
  title?: unknown;
  description?: unknown;
  order_no?: unknown;
};

export type CleanHighlight = {
  topic_content_id: number | string;
  position: HighlightPosition;
  icon: string | null;
  title: string;
  description: string;
  order_no: number;
};

// Gelen (AI JSON'dan veya admin formundan) alt-listeyi doğrular; pozisyon
// tekrarı varsa null döner (çağıran taraf bunu hata olarak ele almalı).
export function cleanHighlights(topicContentId: number | string, raw: IncomingHighlight[] | undefined): CleanHighlight[] | null {
  const clean = (Array.isArray(raw) ? raw : [])
    .filter((h): h is IncomingHighlight & { position: HighlightPosition; title: string; description: string } =>
      typeof h.position === 'string' &&
      (HIGHLIGHT_POSITIONS as readonly string[]).includes(h.position) &&
      typeof h.title === 'string' && h.title.trim().length > 0 &&
      typeof h.description === 'string' && h.description.trim().length > 0
    )
    .map((h, idx) => ({
      topic_content_id: topicContentId,
      position: h.position,
      icon: typeof h.icon === 'string' && h.icon.trim() ? h.icon.trim() : null,
      title: h.title.trim(),
      description: h.description.trim(),
      order_no: typeof h.order_no === 'number' ? h.order_no : idx,
    }));

  const positionsUsed = new Set(clean.map((h) => h.position));
  if (positionsUsed.size !== clean.length) return null;

  return clean;
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
