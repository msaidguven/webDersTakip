'use client';

// Yazılı sayfasının öğrenci bölümü (2026-10-25): örnek kağıt bir "deneme sınavı" olarak gösterilir —
// öğrenci kağıda çözer, sonra cevap anahtarını tek seferde açar. Metinler sunucuda KaTeX'le HTML'e
// çevrilip gelir (KaTeX istemci paketine girmesin). Cevaplar yalnız açılınca çizilir; aynı sorular
// cevaplarıyla birlikte "Konu konu sorular" sekmesinde zaten HTML'de (SEO).
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { YaziliSvg } from '@/app/src/components/yazili/YaziliSvg';
import r from '@/app/src/components/robotic/robotic.module.css';

export type PracticeItem = {
  id: number;
  points: number;
  textHtml: string;
  svg: string | null;
  svgPosition: 'above' | 'below';
  answerHtml: string;
  answerSvg: string | null;
  rubric: string | null;
};

export type PracticePaper = { key: string; label: string; detail: string; items: PracticeItem[] };

export function YaziliPracticeExam({ papers }: { papers: PracticePaper[] }) {
  const [active, setActive] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);
  const paper = papers[active];
  const total = paper.items.reduce((sum, it) => sum + it.points, 0);

  const select = (i: number) => {
    setActive(i);
    setShowAnswers(false);
  };

  return (
    <section aria-labelledby="deneme-sinavi" className={`p-5 sm:p-6 ${r.panel}`}>
      <p className={r.label}>Deneme sınavı</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h2 id="deneme-sinavi" className={`text-xl font-bold uppercase text-default sm:text-2xl ${r.display}`}>Sınav provası yap</h2>
        <div className="flex gap-2" aria-label="Kağıt özeti">
          <span className={`${r.readout} gap-1.5`}>
            {paper.items.length}
            <span className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${r.mono}`}>soru</span>
          </span>
          <span className={`${r.readout} gap-1.5`}>
            {total}
            <span className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${r.mono}`}>puan</span>
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Gerçek yazılı gibi hazırlanmış kağıt. Soruları önce bir kağıda çöz, sonra cevap anahtarını açıp puanını hesapla.
      </p>

      {papers.length > 1 && (
        <div role="tablist" aria-label="Deneme kağıtları" className="mt-4 flex flex-wrap gap-1.5">
          {papers.map((p, i) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => select(i)}
              className={`${r.tab} ${i === active ? r.tabActive : ''} text-xs`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <p className={`mt-3 text-[11px] uppercase tracking-widest text-muted-foreground ${r.mono}`}>{paper.detail}</p>

      <ol className="mt-3 flex flex-col gap-3">
        {paper.items.map((it, i) => {
          const svg = it.svg ? <YaziliSvg svgContent={it.svg} /> : null;
          return (
            <li key={it.id} className={`rounded-2xl p-4 sm:p-5 ${r.item}`}>
              <div className="flex gap-3">
                <span className={`h-8 w-8 shrink-0 text-sm ${r.chipBox}`} aria-hidden="true">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  {it.svgPosition === 'above' && svg}
                  <p className="leading-relaxed text-default">
                    <span className="sr-only">Soru {i + 1}: </span>
                    <span dangerouslySetInnerHTML={{ __html: it.textHtml }} />
                    {/* Puan, yazılı kağıdındaki gibi soru metninin sonunda (ayrı boş satır açmasın). */}
                    <span className={`ml-2 whitespace-nowrap align-middle ${r.badge}`}>{it.points} puan</span>
                  </p>
                  {it.svgPosition === 'below' && svg}
                  {showAnswers && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-dashed border-[var(--edge)] pt-3 text-sm">
                      <p>
                        <b className={r.accent}>Cevap:</b> <span className="text-default" dangerouslySetInnerHTML={{ __html: it.answerHtml }} />
                      </p>
                      {it.answerSvg && <YaziliSvg svgContent={it.answerSvg} label={`Soru ${i + 1} cevap görseli`} />}
                      {it.rubric && (
                        <p className="whitespace-pre-line text-muted-foreground">
                          <b className="text-default">Puanlama:</b> {it.rubric}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowAnswers((v) => !v)}
          aria-pressed={showAnswers}
          className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold ${showAnswers ? r.btnGhost : `${r.btnNeon} ${r.btnText}`}`}
        >
          {showAnswers ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {showAnswers ? 'Cevapları gizle' : 'Cevap anahtarını göster'}
        </button>
        {papers.length > 1 && active < papers.length - 1 && (
          <button type="button" onClick={() => select(active + 1)} className={`text-sm font-semibold hover:underline ${r.accent}`}>
            Sıradaki deneme →
          </button>
        )}
      </div>
    </section>
  );
}
