export const NARRATION_BUCKET = 'topic-narration';

export const narrationManifestPath = (topicId: number) => `topics/${topicId}.json`;
export const narrationAudioPath = (hash: string) => `audio/${hash.slice(0, 2)}/${hash}.mp3`;

export function narrationPublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${NARRATION_BUCKET}/${path}`;
}
