'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  computePlanHeadingDiff,
  planDiffHasRiskyLoss,
  type ExistingSectionForDiff,
} from '@/app/src/lib/planHeadingDiff';

// Alt başlık planı/içeriği kaydedilmeden ÖNCE (plan/route.ts başlık eşleştirmesi devreye
// girmeden), admin'e "bu başlıklar mevcutlarla eşleşmiyor, kaydedersen şu diyagram/görseller
// silinir" diye gösterip düzeltme fırsatı verir. Kullanıcı bir başlığı elle düzenleyip eski
// haliyle BİREBİR aynı yaparsa (ya da aşağıdaki "Eşleştir" menüsünden seçerse) o satır artık
// silinecekler listesinden çıkar — canlı olarak (useMemo, computePlanHeadingDiff sunucudaki
// FIFO eşleştirmeyi birebir tekrar ediyor).
export function PlanHeadingDiffReview({
  pastedHeadings,
  onHeadingChange,
  existingSections,
  onBack,
  onConfirm,
  saving,
}: {
  pastedHeadings: string[];
  onHeadingChange: (idx: number, value: string) => void;
  existingSections: ExistingSectionForDiff[];
  onBack: () => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  const diff = useMemo(
    () => computePlanHeadingDiff(existingSections, pastedHeadings),
    [existingSections, pastedHeadings]
  );
  const unmatchedSet = useMemo(() => new Set(diff.unmatchedNewIndexes), [diff]);
  const risky = planDiffHasRiskyLoss(diff);

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${risky ? 'border-[#ff6584]/40 bg-[#ff6584]/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
        <div className="flex items-start gap-2">
          {risky ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#ff6584] mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
          )}
          <p className="text-xs font-bold text-foreground">
            {diff.removedSections.length === 0
              ? 'Tüm başlıklar mevcutlarla birebir eşleşti — hiçbir alt başlık silinmeyecek.'
              : risky
                ? 'Bazı başlıklar mevcutlarla eşleşmiyor. Kaydedersen aşağıdaki alt başlık(lar) SİLİNECEK — bağlı diyagram/görselleri de dahil. İstersen aşağıdan başlığı düzelt/eşleştir.'
                : 'Bazı başlıklar mevcutlarla eşleşmiyor ve silinecek, ama bunlarda kayıp bir görsel/diyagram yok.'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground block">
          Yeni başlıklar (gerekirse düzelt)
        </span>
        {pastedHeadings.map((heading, idx) => {
          const isUnmatched = unmatchedSet.has(idx);
          // Bu index'in eşleşebileceği, hâlâ silinecekler kuyruğunda olan eski başlıklar.
          const candidates = diff.removedSections;
          return (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <span className="h-6 w-6 shrink-0 rounded-md bg-surface-elevated border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground">
                {idx + 1}
              </span>
              <input
                value={heading}
                onChange={(e) => onHeadingChange(idx, e.target.value)}
                className={`min-w-[200px] flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold text-foreground bg-surface outline-none ${
                  isUnmatched ? 'border-[#ff6584]/50 focus:border-[#ff6584]' : 'border-emerald-500/40 focus:border-emerald-500'
                }`}
              />
              {isUnmatched && candidates.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onHeadingChange(idx, e.target.value);
                  }}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-[10px] font-bold text-muted-foreground outline-none"
                >
                  <option value="" disabled>↳ Eski başlıkla eşleştir...</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.heading}>
                      {c.heading}
                      {c.hasDiagram || c.hasImage ? ` (${[c.hasDiagram && 'diyagram', c.hasImage && 'görsel'].filter(Boolean).join(', ')})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {diff.removedSections.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground block">
            Silinecek alt başlıklar
          </span>
          <div className="space-y-1.5">
            {diff.removedSections.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/5 px-3 py-2">
                <span className="flex-1 min-w-0 truncate text-xs font-bold text-foreground">{s.heading}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${s.hasDiagram ? 'bg-[#ff6584]/20 text-[#ff6584]' : 'bg-surface-elevated text-muted-foreground'}`}>
                  Diyagram: {s.hasDiagram ? 'silinecek' : 'yok'}
                </span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${s.hasImage ? 'bg-[#ff6584]/20 text-[#ff6584]' : 'bg-surface-elevated text-muted-foreground'}`}>
                  Görsel: {s.hasImage ? 'silinecek' : 'yok'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onBack} disabled={saving} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors">
          Geri Dön
        </button>
        <button
          onClick={onConfirm}
          disabled={saving}
          className={`rounded-xl px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50 transition-colors ${
            risky ? 'bg-[#ff6584] hover:bg-[#e6547a]' : 'bg-[#6c63ff] hover:bg-[#5a52e0]'
          }`}
        >
          {saving ? 'Kaydediliyor...' : risky ? 'Diyagram/Görselleri Sil ve Kaydet' : 'Onayla ve Kaydet'}
        </button>
      </div>
    </div>
  );
}
