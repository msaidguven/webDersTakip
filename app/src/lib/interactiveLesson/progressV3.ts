// Etkileşimli Ders v3 ilerleme deposu: localStorage (anında & misafir) + Supabase DB (giriş yapmış öğrenci senkronu).
// Sıfırlama işlemi yalnızca aktif turdaki bölüm işaretlerini ve kalınan adımı temizler;
// toplam tamamlama sayısını (completionCount) korur.
import { createClient } from '@/utils/supabase/client';
import { markTopicContentCompleted, touchTopicContentView } from '@/app/src/lib/topicContentProgress';

export type SavedV3Progress = {
  completedSections: number[];
  solvedGates: string[];
  /** sectionId (string) -> en son ulaşılan ekran indeksi (0-based) */
  sectionProgress: Record<string, number>;
  /** En son açılan/çalışılan bölüm indeksi */
  lastSectionIdx: number;
  /** Öğrencinin bu etkileşimli dersi toplam kaç kez tam bitirdiği */
  completionCount: number;
  /** Mevcut turda tüm bölümler bitirildiği için completionCount zaten artırıldı mı? */
  currentRunCounted: boolean;
  firstCompletedAt: string | null;
  lastCompletedAt: string | null;
  updatedAt: string;
};

type RemoteRow = {
  completed_sections: number[] | null;
  solved_gates: string[] | null;
  section_progress: Record<string, number> | null;
  last_section_idx: number | null;
  completion_count: number | null;
  current_run_counted: boolean | null;
  first_completed_at: string | null;
  last_completed_at: string | null;
  updated_at: string | null;
};

export function emptyProgressV3(): SavedV3Progress {
  return {
    completedSections: [],
    solvedGates: [],
    sectionProgress: {},
    lastSectionIdx: 0,
    completionCount: 0,
    currentRunCounted: false,
    firstCompletedAt: null,
    lastCompletedAt: null,
    updatedAt: '',
  };
}

function normalizeProgress(raw: Partial<SavedV3Progress> | null | undefined): SavedV3Progress {
  const base = emptyProgressV3();
  if (!raw || typeof raw !== 'object') return base;
  const sp: Record<string, number> = {};
  if (raw.sectionProgress && typeof raw.sectionProgress === 'object') {
    for (const [k, v] of Object.entries(raw.sectionProgress)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) sp[k] = Math.floor(n);
    }
  }
  return {
    completedSections: Array.isArray(raw.completedSections)
      ? raw.completedSections.map(Number).filter((n) => Number.isFinite(n))
      : [],
    solvedGates: Array.isArray(raw.solvedGates) ? raw.solvedGates.filter((x): x is string => typeof x === 'string') : [],
    sectionProgress: sp,
    lastSectionIdx: typeof raw.lastSectionIdx === 'number' && raw.lastSectionIdx >= 0 ? Math.floor(raw.lastSectionIdx) : 0,
    completionCount:
      typeof raw.completionCount === 'number' && raw.completionCount >= 0 ? Math.floor(raw.completionCount) : 0,
    currentRunCounted: Boolean(raw.currentRunCounted),
    firstCompletedAt: typeof raw.firstCompletedAt === 'string' ? raw.firstCompletedAt : null,
    lastCompletedAt: typeof raw.lastCompletedAt === 'string' ? raw.lastCompletedAt : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  };
}

export function loadLocalProgressV3(topicId: number): SavedV3Progress {
  try {
    const raw = localStorage.getItem(`il_v3_${topicId}`);
    if (!raw) return emptyProgressV3();
    return normalizeProgress(JSON.parse(raw) as Partial<SavedV3Progress>);
  } catch {
    return emptyProgressV3();
  }
}

export function saveLocalProgressV3(topicId: number, data: SavedV3Progress): void {
  try {
    localStorage.setItem(`il_v3_${topicId}`, JSON.stringify(data));
  } catch {}
}

export function hasAnyActiveProgressV3(data: SavedV3Progress): boolean {
  return (
    data.completedSections.length > 0 ||
    data.solvedGates.length > 0 ||
    Object.values(data.sectionProgress).some((step) => step > 0)
  );
}

/** Aktif tur ilerlemesini sıfırlar; toplam tamamlama sayısını ve tarihlerini korur. */
export function resetRunProgressV3(prev: SavedV3Progress): SavedV3Progress {
  return {
    completedSections: [],
    solvedGates: [],
    sectionProgress: {},
    lastSectionIdx: 0,
    completionCount: prev.completionCount,
    currentRunCounted: false,
    firstCompletedAt: prev.firstCompletedAt,
    lastCompletedAt: prev.lastCompletedAt,
    updatedAt: new Date().toISOString(),
  };
}

export function mergeProgressV3(local: SavedV3Progress, remote: SavedV3Progress): SavedV3Progress {
  const localTs = local.updatedAt ? Date.parse(local.updatedAt) : 0;
  const remoteTs = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;
  const primary = remoteTs >= localTs ? remote : local;
  return {
    ...primary,
    completionCount: Math.max(local.completionCount, remote.completionCount),
    firstCompletedAt: remote.firstCompletedAt ?? local.firstCompletedAt,
    lastCompletedAt:
      remote.lastCompletedAt && local.lastCompletedAt
        ? remote.lastCompletedAt > local.lastCompletedAt
          ? remote.lastCompletedAt
          : local.lastCompletedAt
        : remote.lastCompletedAt ?? local.lastCompletedAt,
  };
}

async function getAuthedClient() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return { supabase, userId: user.id };
  } catch {
    return null;
  }
}

export async function fetchRemoteProgressV3(topicId: number): Promise<SavedV3Progress | null> {
  const auth = await getAuthedClient();
  if (!auth) return null;
  try {
    void touchTopicContentView(auth.supabase, auth.userId, topicId);
    const { data, error } = await auth.supabase
      .from('user_interactive_lesson_progress')
      .select(
        'completed_sections, solved_gates, section_progress, last_section_idx, completion_count, current_run_counted, first_completed_at, last_completed_at, updated_at',
      )
      .eq('user_id', auth.userId)
      .eq('topic_id', topicId)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as RemoteRow;
    return normalizeProgress({
      completedSections: row.completed_sections ?? [],
      solvedGates: row.solved_gates ?? [],
      sectionProgress: row.section_progress ?? {},
      lastSectionIdx: row.last_section_idx ?? 0,
      completionCount: row.completion_count ?? 0,
      currentRunCounted: Boolean(row.current_run_counted),
      firstCompletedAt: row.first_completed_at,
      lastCompletedAt: row.last_completed_at,
      updatedAt: row.updated_at ?? '',
    });
  } catch {
    return null;
  }
}

export async function saveRemoteProgressV3(
  topicId: number,
  data: SavedV3Progress,
  opts?: { markTopicCompleted?: boolean },
): Promise<void> {
  const auth = await getAuthedClient();
  if (!auth) return;
  try {
    const now = data.updatedAt || new Date().toISOString();
    await auth.supabase.from('user_interactive_lesson_progress').upsert(
      {
        user_id: auth.userId,
        topic_id: topicId,
        completed_sections: data.completedSections,
        solved_gates: data.solvedGates,
        section_progress: data.sectionProgress,
        last_section_idx: data.lastSectionIdx,
        completion_count: data.completionCount,
        current_run_counted: data.currentRunCounted,
        first_completed_at: data.firstCompletedAt,
        last_completed_at: data.lastCompletedAt,
        updated_at: now,
      },
      { onConflict: 'user_id,topic_id' },
    );
    if (opts?.markTopicCompleted) {
      await markTopicContentCompleted(auth.supabase, auth.userId, topicId);
    }
  } catch {
    // Sessizce yoksay (tablo henüz uygulanmadıysa veya ağ hatasında öğrenci akışı bozulmasın)
  }
}
