import type { SupabaseClient } from '@supabase/supabase-js';
import type { DersSatiri } from './takdirTesekkurHesaplama';

export interface KayitliHesaplama {
  dersler: DersSatiri[];
  davranisPuaniTam: boolean;
  tumDerslerdenBasarili: boolean;
}

export interface GeriBildirimGirdisi {
  sinifSeviyesi: number;
  mesaj: string;
  ozet: Record<string, unknown>;
  userId: string | null;
}

interface CalculationRow {
  id: string;
  behavior_full: boolean;
  all_passed: boolean;
}

interface LessonRow {
  lesson_name: string;
  weekly_hours: number;
  yazili1: number | null;
  yazili2: number | null;
  yazili3: number | null;
  performans1: number | null;
  performans2: number | null;
  performans3: number | null;
  katilim1: number | null;
  katilim2: number | null;
  katilim3: number | null;
  proje: number | null;
  sort_order: number;
}

const sayiYaDaNull = (deger: number | null): number | null => (deger === null ? null : Number(deger));

export async function loadTakdirTesekkurCalculation(
  supabase: SupabaseClient,
  sinifSeviyesi: number,
  donem: 1 | 2
): Promise<KayitliHesaplama | null> {
  const { data: calc, error: calcError } = await supabase
    .from('takdir_tesekkur_calculations')
    .select('id, behavior_full, all_passed')
    .eq('sinif_seviyesi', sinifSeviyesi)
    .eq('donem', donem)
    .maybeSingle();

  if (calcError || !calc) return null;
  const row = calc as CalculationRow;

  const { data: lessons, error: lessonsError } = await supabase
    .from('takdir_tesekkur_calculation_lessons')
    .select(
      'lesson_name, weekly_hours, yazili1, yazili2, yazili3, performans1, performans2, performans3, katilim1, katilim2, katilim3, proje, sort_order'
    )
    .eq('calculation_id', row.id)
    .order('sort_order', { ascending: true });

  if (lessonsError) return null;

  return {
    davranisPuaniTam: row.behavior_full,
    tumDerslerdenBasarili: row.all_passed,
    dersler: ((lessons as LessonRow[] | null) ?? []).map((l, index) => ({
      id: `${row.id}-${index}`,
      dersAdi: l.lesson_name,
      haftalikSaat: l.weekly_hours,
      yazili1: sayiYaDaNull(l.yazili1),
      yazili2: sayiYaDaNull(l.yazili2),
      yazili3: sayiYaDaNull(l.yazili3),
      performans1: sayiYaDaNull(l.performans1),
      performans2: sayiYaDaNull(l.performans2),
      performans3: sayiYaDaNull(l.performans3),
      katilim1: sayiYaDaNull(l.katilim1),
      katilim2: sayiYaDaNull(l.katilim2),
      katilim3: sayiYaDaNull(l.katilim3),
      proje: sayiYaDaNull(l.proje),
    })),
  };
}

export async function saveTakdirTesekkurCalculation(
  supabase: SupabaseClient,
  sinifSeviyesi: number,
  donem: 1 | 2,
  davranisPuaniTam: boolean,
  tumDerslerdenBasarili: boolean,
  dersler: DersSatiri[]
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('save_takdir_tesekkur_calculation', {
    p_sinif_seviyesi: sinifSeviyesi,
    p_donem: donem,
    p_behavior_full: davranisPuaniTam,
    p_all_passed: tumDerslerdenBasarili,
    p_lessons: dersler.map((d, index) => ({
      lesson_name: d.dersAdi,
      weekly_hours: d.haftalikSaat,
      yazili1: d.yazili1,
      yazili2: d.yazili2,
      yazili3: d.yazili3,
      performans1: d.performans1,
      performans2: d.performans2,
      performans3: d.performans3,
      katilim1: d.katilim1,
      katilim2: d.katilim2,
      katilim3: d.katilim3,
      proje: d.proje,
      sort_order: index,
    })),
  });
  return { error: error?.message ?? null };
}

export async function gonderGeriBildirim(supabase: SupabaseClient, girdi: GeriBildirimGirdisi): Promise<{ error: string | null }> {
  const { error } = await supabase.from('takdir_hesaplama_geri_bildirim').insert({
    user_id: girdi.userId,
    sinif_seviyesi: girdi.sinifSeviyesi,
    mesaj: girdi.mesaj,
    ozet: girdi.ozet,
  });
  return { error: error?.message ?? null };
}
