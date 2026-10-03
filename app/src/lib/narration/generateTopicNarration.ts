import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildNarrationScript, type ScriptSourceSection } from './buildScript';
import { NARRATION_BUCKET, narrationAudioPath, narrationManifestPath } from './config';
import type { NarrationEngine } from './engine';
import { estimateChunkStarts } from './timing';
import { NARRATION_MANIFEST_VERSION, type NarrationManifest, type NarrationSection } from './types';

// Bir konunun sesli anlatımını üretir — saatlik worker (app/api/narration/worker) ve elle çalıştırılan
// betik (scripts/generate-narration.ts) aynı çekirdeği kullanır. Service-role istemci gerektirir.
//
// Devam edilebilir: her cümlenin sesi, seslendirilen metin + ses hash'iyle adlandırılıp hemen
// Storage'a yazılır. Süre (deadline) dolarsa işlem yarıda bırakılır; sonraki çağrı aynı konuda
// üretilmiş sesleri önbellekten alıp kaldığı yerden devam eder. Bütün ekranlar hazır olunca manifest
// yazılır ve topic_narrations satırı güncellenir — öncesinde konunun eski anlatımı oynamaya devam eder.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

export type GenerateNarrationResult = {
  completed: boolean;
  made: number;
  reused: number;
  durationSeconds?: number;
  screenCount?: number;
};

type Options = {
  // Bu zamandan (Date.now()) sonra yeni ses üretimine başlanmaz.
  deadline?: number;
  // 1'den başlayan bölüm numaraları — önbelleğe bakmadan yeniden seslendirilir.
  forceSections?: Set<number>;
  onScreen?: (info: { duration: number; speech: string }) => void;
};

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// Dosya adı <hash>-d<süre ms>-<üretim zamanı>.mp3: dosyalar hiç üzerine yazılmaz (1 yıllık CDN
// önbelleği), aynı hash'in en yeni dosyası kullanılır; süre addan okunduğu için manifest gerekmez.
const fileStem = (hash: string, durationMs: number) => `${hash}-d${durationMs}-${Date.now().toString(36)}`;

async function findCachedAudio(supabase: Supabase, hash: string): Promise<{ path: string; duration: number } | null> {
  const probe = narrationAudioPath(hash);
  const dir = probe.slice(0, probe.lastIndexOf('/'));
  const { data } = await supabase.storage.from(NARRATION_BUCKET).list(dir, { search: hash, sortBy: { column: 'created_at', order: 'desc' } });
  const re = new RegExp(`^${hash}-d(\\d+)-[a-z0-9]+\\.mp3$`);
  for (const f of data ?? []) {
    const m = f.name.match(re);
    if (m) return { path: `${dir}/${f.name}`, duration: Number(m[1]) / 1000 };
  }
  return null;
}

// Önceki manifestteki sesler (ekran kimliği → ses). Dosyalar hiç silinmez/üzerine yazılmaz, bu yüzden
// manifestte olan ses Storage'da vardır — tek tek listelemeye gerek yok (2026-10-03: her ekran için
// ayrı list çağrısı, worker'ın saatte ~100-150 boşa Storage isteği üretmesine yol açıyordu).
async function loadPreviousAudio(supabase: Supabase, topicId: number): Promise<Map<string, { path: string; duration: number }>> {
  const map = new Map<string, { path: string; duration: number }>();
  const { data } = await supabase.storage.from(NARRATION_BUCKET).download(narrationManifestPath(topicId));
  if (!data) return map;
  try {
    const prev = JSON.parse(await data.text()) as NarrationManifest;
    for (const sec of prev.sections) for (const sc of sec.screens) map.set(sc.id, sc.audio);
  } catch {
    /* bozuk manifest — önbellek aramasına düşülür */
  }
  return map;
}

export async function loadNarrationSource(supabase: Supabase, topicId: number) {
  const { data: topic, error: topicErr } = await supabase.from('topics').select('id, title').eq('id', topicId).single();
  if (topicErr || !topic) throw new Error(`Konu bulunamadı: ${topicId}`);
  const { data: tc } = await supabase.from('topic_contents').select('id').eq('topic_id', topicId).maybeSingle();
  if (!tc) throw new Error('Konunun içeriği (topic_contents) yok');
  const { data: rows, error } = await supabase
    .from('topic_content_sections')
    .select('id, heading, body_markdown')
    .eq('topic_content_id', tc.id)
    .order('order_no', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  const sections = (rows ?? []) as ScriptSourceSection[];
  if (!sections.length) throw new Error('Konunun alt başlığı yok');
  return { title: topic.title as string, sections };
}

export async function generateTopicNarration(
  supabase: Supabase,
  topicId: number,
  engine: NarrationEngine,
  opts: Options = {},
): Promise<GenerateNarrationResult> {
  const { title, sections: source } = await loadNarrationSource(supabase, topicId);
  const { data: sourceHash, error: hashErr } = await supabase.rpc('topic_narration_source_hash', { p_topic_id: topicId });
  if (hashErr || typeof sourceHash !== 'string') throw new Error(`Kaynak özeti alınamadı: ${hashErr?.message ?? 'boş'}`);

  const script = buildNarrationScript(source);
  const previous = await loadPreviousAudio(supabase, topicId);
  // Manifestte olmayan sesler için Storage'da arama yalnızca yarıda kalmış bir üretimin kaldığı yeri
  // bulmak içindir: üretim sıralı olduğundan ilk eksik seste aramayı bırakırız (sonrası zaten yok).
  let probeStorage = true;
  const sections: NarrationSection[] = [];
  let made = 0;
  let reused = 0;

  for (const [secIndex, sec] of script.entries()) {
    const force = opts.forceSections?.has(secIndex + 1) ?? false;
    const screens: NarrationSection['screens'] = [];
    for (const sc of sec.screens) {
      const hash = sha(`${engine.provider}|${engine.model}|${engine.voice}|${sc.speech}`);
      let audio = force ? null : previous.get(hash.slice(0, 16)) ?? null;
      if (!audio && !force && probeStorage) {
        audio = await findCachedAudio(supabase, hash);
        if (!audio) probeStorage = false;
      }
      if (audio) {
        reused++;
      } else {
        if (opts.deadline && Date.now() > opts.deadline) return { completed: false, made, reused };
        const { mp3, duration } = await engine.synthesize(sc.speech);
        const durationMs = Math.round(duration * 1000);
        const path = narrationAudioPath(fileStem(hash, durationMs));
        const { error: upErr } = await supabase.storage
          .from(NARRATION_BUCKET)
          .upload(path, mp3, { contentType: 'audio/mpeg', cacheControl: '31536000', upsert: false });
        if (upErr) throw new Error(`Ses yüklenemedi: ${upErr.message}`);
        audio = { path, duration: durationMs / 1000 };
        made++;
        opts.onScreen?.({ duration: audio.duration, speech: sc.speech });
      }
      const starts = estimateChunkStarts(sc.chunks.map((c) => c.speech), audio.duration, engine.trailingSilence);
      screens.push({
        id: hash.slice(0, 16),
        kind: sc.kind,
        eyebrow: sc.eyebrow,
        chunks: sc.chunks.map((c, i) => ({ parts: c.words.map((w) => (w.em ? { t: w.t, em: true as const } : { t: w.t })), start: starts[i] })),
        audio,
      });
    }
    sections.push({ sectionId: sec.sectionId, title: sec.title, screens });
  }

  const manifest: NarrationManifest = {
    version: NARRATION_MANIFEST_VERSION,
    topicId,
    topicTitle: title,
    sourceHash,
    voice: { provider: engine.provider, model: engine.model, voice: engine.voice },
    generatedAt: new Date().toISOString(),
    sections,
  };
  const { error: mErr } = await supabase.storage
    .from(NARRATION_BUCKET)
    .upload(narrationManifestPath(topicId), JSON.stringify(manifest), { contentType: 'application/json', cacheControl: '60', upsert: true });
  if (mErr) throw new Error(`Manifest yazılamadı: ${mErr.message}`);

  const screenCount = sections.reduce((n, s) => n + s.screens.length, 0);
  const durationSeconds = Math.round(sections.reduce((n, s) => n + s.screens.reduce((m, sc) => m + sc.audio.duration, 0), 0) * 100) / 100;
  const { error: rowErr } = await supabase.from('topic_narrations').upsert({
    topic_id: topicId,
    source_hash: sourceHash,
    voice: engine.voice,
    screen_count: screenCount,
    duration_seconds: durationSeconds,
    generated_at: manifest.generatedAt,
  });
  if (rowErr) throw new Error(`topic_narrations yazılamadı: ${rowErr.message}`);

  return { completed: true, made, reused, durationSeconds, screenCount };
}
