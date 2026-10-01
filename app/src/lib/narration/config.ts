export const NARRATION_BUCKET = 'topic-narration';

// PROTOTİP (2026-10-01): Sesli anlatım şimdilik yalnızca bu konularda gösteriliyor. Tüm konulara
// açılınca bu liste yerine DB'de "anlatım hazır" bilgisi (ör. topic_contents üzerinde bir sütun)
// tutulmalı; liste sadece butonun görünürlüğünü belirliyor.
export const NARRATION_PILOT_TOPIC_IDS: ReadonlySet<number> = new Set([567]);

export const narrationManifestPath = (topicId: number) => `topics/${topicId}.json`;
export const narrationAudioPath = (hash: string) => `audio/${hash.slice(0, 2)}/${hash}.mp3`;

export function narrationPublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${NARRATION_BUCKET}/${path}`;
}
