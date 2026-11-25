'use client';

// Öğrencinin kaydettiği/paylaştığı ders notları, sorular ve konular için TEK ortak bileşen
// (bkz. GEMINI.md Kural 5: hem /uye/[slug] hem /profil sayfasında aynı görsel ve mobil düzende kullanılır).
// Renk dili konu anlatımındaki RecapCardView (.recap) ve ders kimliği (subjectStyle) ile birebir aynıdır:
//   - Ders ikonu ve rozeti: subjectStyle(lessonName)
//   - Bölüm/ara başlıklar: #3B5BFD sol şerit + #1E3A8A koyu lacivert başlık (karanlıkta #7C93FF / #C7D2FE)
//   - Anahtar kavramlar (**terim**): #A21CAF mor-pembe vurgu (karanlıkta #F0ABFC)
//   - Not / Dikkat / Örnek kutuları: turuncu / kırmızı / yeşil anlamlı bilgi kutuları
import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import type { SavedItemKind, SavedStudyItem } from '@/app/src/lib/savedStudyItems';
import { subjectStyle } from '@/app/src/lib/subjectStyle';
import r from './robotic/robotic.module.css';

type FilterTab = 'all' | SavedItemKind;

const KIND_META: Record<
  SavedItemKind,
  { label: string; actionLabel: string; Icon: typeof FileText; badgeCls: string }
> = {
  note: {
    label: 'Ders Notu',
    actionLabel: 'Konuya git',
    Icon: FileText,
    badgeCls: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  question: {
    label: 'Soru',
    actionLabel: 'Soruyu çöz',
    Icon: HelpCircle,
    badgeCls: 'border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  },
  topic: {
    label: 'Konu',
    actionLabel: 'Konuyu çalış',
    Icon: BookOpen,
    badgeCls: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Satır içindeki **kalın kavramları** (ve düz kayıtlardaki kısa "Kavram, ...dır" / "Kavram: ..." girişlerini)
// konu sayfasındaki RecapCardView ile birebir aynı mor-pembe (#A21CAF / dark:#F0ABFC) renkle vurgular.
function renderRichInline(text: string, autoTermHighlight = false): React.ReactNode {
  if (text.includes('**')) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={idx} className="font-bold text-[#A21CAF] dark:text-[#F0ABFC]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  }

  if (autoTermHighlight) {
    // Eski düz metin kayıtlarda "Terim: açıklama" veya "Terim, ... yazılımdır." gibi kısa tanım öznesi varsa vurgula
    const colonMatch = text.match(/^([A-ZÇĞİÖŞÜa-zçğıöşü0-9 ()/-]{2,36}):\s+([\s\S]+)$/);
    if (colonMatch) {
      return (
        <>
          <strong className="font-bold text-[#A21CAF] dark:text-[#F0ABFC]">{colonMatch[1]}:</strong>{' '}
          {colonMatch[2]}
        </>
      );
    }
    const commaDefMatch = text.match(/^([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü]{1,22}(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,22}){0,2}),\s+([\s\S]+)$/);
    if (commaDefMatch) {
      return (
        <>
          <strong className="font-bold text-[#A21CAF] dark:text-[#F0ABFC]">{commaDefMatch[1]}</strong>,{' '}
          {commaDefMatch[2]}
        </>
      );
    }
  }

  return text;
}

function FormattedNoteBody({ text }: { text: string }) {
  const rawLines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Eğer eski biçimde tek satır düz metin kaydedilmişse ve birden fazla cümle içeriyorsa maddelere ayır
  const lines =
    rawLines.length === 1 && !rawLines[0].includes('**') && !rawLines[0].startsWith('###')
      ? (() => {
          const sentences = rawLines[0]
            .split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])/)
            .map((s) => s.trim())
            .filter(Boolean);
          return sentences.length >= 2 ? sentences.map((s) => `• ${s}`) : rawLines;
        })()
      : rawLines;

  const hasExplicitMarkup = text.includes('**') || text.includes('### ') || text.includes('!NOT:') || text.includes('!DİKKAT:');

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--edge)] bg-white/85 p-3.5 dark:bg-[#1E2737] sm:p-4">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return (
            <p
              key={i}
              className="border-l-[4px] border-[#3B5BFD] pl-2.5 text-[13.5px] font-extrabold leading-snug text-[#1E3A8A] dark:border-[#7C93FF] dark:text-[#C7D2FE] sm:text-sm"
            >
              {line.slice(4)}
            </p>
          );
        }

        if (line.startsWith('!NOT:')) {
          const content = line.slice(5).trim();
          return (
            <div
              key={i}
              className="rounded-xl border border-[#FDBA74] bg-[#FFF4E5] px-3.5 py-2.5 text-xs leading-relaxed text-slate-800 dark:border-orange-400/40 dark:bg-orange-400/12 dark:text-slate-100 sm:text-[13.5px]"
            >
              <b className="mb-0.5 block text-[11px] font-extrabold uppercase tracking-wider text-[#C2410C] dark:text-orange-300">
                Not
              </b>
              {renderRichInline(content)}
            </div>
          );
        }

        if (line.startsWith('!DİKKAT:')) {
          const content = line.slice(8).trim();
          return (
            <div
              key={i}
              className="rounded-xl border border-[#FCA5A5] bg-[#FEEFEF] px-3.5 py-2.5 text-xs leading-relaxed text-slate-800 dark:border-rose-400/40 dark:bg-rose-400/12 dark:text-slate-100 sm:text-[13.5px]"
            >
              <b className="mb-0.5 block text-[11px] font-extrabold uppercase tracking-wider text-[#B91C1C] dark:text-rose-300">
                Dikkat
              </b>
              {renderRichInline(content)}
            </div>
          );
        }

        if (line.startsWith('!ÖRNEK:')) {
          const content = line.slice(7).trim();
          return (
            <div
              key={i}
              className="rounded-xl border border-[#86EFAC] bg-[#ECF8F0] px-3.5 py-2.5 text-xs leading-relaxed text-slate-800 dark:border-emerald-400/35 dark:bg-emerald-400/10 dark:text-slate-100 sm:text-[13.5px]"
            >
              <b className="mb-0.5 block text-[11px] font-extrabold uppercase tracking-wider text-[#15803D] dark:text-emerald-300">
                Örnek
              </b>
              {renderRichInline(content)}
            </div>
          );
        }

        if (line.startsWith('• ')) {
          const bulletBody = line.slice(2).trim();
          return (
            <div key={i} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-default sm:text-sm">
              <span
                aria-hidden="true"
                className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B5BFD] dark:bg-[#7C93FF]"
              />
              <span>{renderRichInline(bulletBody, !hasExplicitMarkup)}</span>
            </div>
          );
        }

        return (
          <p key={i} className="text-[13.5px] leading-relaxed text-default sm:text-sm">
            {renderRichInline(line, !hasExplicitMarkup)}
          </p>
        );
      })}
    </div>
  );
}

export interface StudyNotesCardProps {
  items: SavedStudyItem[] | null;
  isOwner: boolean;
  title?: string;
  headingId?: string;
  emptyBrowseHref?: string;
  onDelete?: (id: number) => void;
  onTogglePublic?: (id: number, nextPublic: boolean) => void;
}

export function StudyNotesCard({
  items,
  isOwner,
  title = 'Ders Notları ve Paylaşımlar',
  headingId = 'ders-notlarim',
  emptyBrowseHref = '/ders',
  onDelete,
  onTogglePublic,
}: StudyNotesCardProps) {
  const [tab, setTab] = useState<FilterTab>('all');
  const [lessonFilter, setLessonFilter] = useState<string>('all');

  const counts = useMemo(() => {
    const base = { all: 0, note: 0, question: 0, topic: 0 };
    if (!items) return base;
    base.all = items.length;
    for (const it of items) base[it.kind] += 1;
    return base;
  }, [items]);

  const lessons = useMemo(() => {
    if (!items) return [];
    const set = new Set<string>();
    for (const it of items) {
      if (it.lessonName) set.add(it.lessonName);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'tr-TR'));
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((it) => {
      if (tab !== 'all' && it.kind !== tab) return false;
      if (lessonFilter !== 'all' && it.lessonName !== lessonFilter) return false;
      return true;
    });
  }, [items, tab, lessonFilter]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Tümü', count: counts.all },
    { key: 'note', label: 'Notlar', count: counts.note },
    { key: 'question', label: 'Sorular', count: counts.question },
    { key: 'topic', label: 'Konular', count: counts.topic },
  ];

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className={`text-lg font-bold tracking-tight text-default uppercase sm:text-xl ${r.display}`}>
          {title}
        </h2>
        {items && <span className={r.badge}>{items.length} kayıt</span>}
      </div>

      <div className={`flex flex-col gap-4 p-4 sm:p-5 ${r.panel}`}>
        {items === null ? (
          <div className="space-y-2.5" aria-busy="true" aria-label="Notlar yükleniyor">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl border border-[var(--edge)] bg-[var(--panel-solid)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-start gap-2.5 py-2">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isOwner
                ? 'Henüz kayıtlı ders notun, sorun veya konun yok. Konu anlatımında önemli bir cümleyi seçip "Notlarıma Kaydet" diyebilir ya da beğendiğin konu ve soruları kaydedebilirsin.'
                : 'Bu üye henüz herkese açık bir ders notu, konu veya soru paylaşmamış.'}
            </p>
            {isOwner && (
              <Link
                href={emptyBrowseHref}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold ${r.btnGhost}`}
              >
                Ders içeriklerine git
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Tür ve Ders Filtreleri */}
            <div className="flex flex-col gap-2">
              <div className={r.tabs} role="tablist" aria-label="Paylaşım türü">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={`${r.tab} ${tab === t.key ? r.tabActive : ''}`}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>

              {lessons.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]" role="group" aria-label="Ders filtresi">
                  <button
                    type="button"
                    aria-pressed={lessonFilter === 'all'}
                    onClick={() => setLessonFilter('all')}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      lessonFilter === 'all'
                        ? `${r.neonBorder} ${r.tint}`
                        : 'border-[var(--edge)] bg-[var(--panel-solid)] text-muted-foreground hover:text-default'
                    }`}
                  >
                    Tüm dersler
                  </button>
                  {lessons.map((lesson) => {
                    const st = subjectStyle(lesson);
                    const active = lessonFilter === lesson;
                    return (
                      <button
                        key={lesson}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setLessonFilter(lesson)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          active
                            ? `${r.neonBorder} ${r.tint}`
                            : 'border-[var(--edge)] bg-[var(--panel-solid)] text-muted-foreground hover:text-default'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${st.bar}`} aria-hidden="true" />
                        {lesson}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Kayıt Listesi */}
            {filtered.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">Bu filtrede kayıt bulunmuyor.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {filtered.map((it) => {
                  const meta = KIND_META[it.kind];
                  const KindIcon = meta.Icon;
                  const subj = subjectStyle(it.lessonName ?? '');
                  const SubjIcon = subj.Icon;
                  const subPath = [it.unitTitle, it.topicTitle].filter(Boolean).join(' › ');
                  const displayHeading =
                    it.sectionHeading && it.sectionHeading !== it.topicTitle
                      ? it.sectionHeading
                      : it.topicTitle;

                  return (
                    <li key={it.id} className={`relative overflow-hidden flex flex-col gap-2.5 rounded-2xl p-4 sm:p-5 ${r.item}`}>
                      {/* Üstte dersin kendi renginde ince vurgu çizgisi */}
                      <span className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${subj.bar}`} aria-hidden="true" />

                      {/* Üst satır: Ders renkli rozet + Sınıf + Tür + Sahip Aksiyonları */}
                      <div className="flex items-start justify-between gap-2 pt-0.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {it.lessonName && (
                            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${subj.chip}`}>
                              <SubjIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span className="truncate">{it.lessonName}</span>
                            </span>
                          )}
                          {it.gradeName && (
                            <span className="rounded-lg border border-[var(--edge)] bg-[var(--panel-solid)] px-2 py-0.5 text-[11px] font-bold text-default">
                              {it.gradeName}
                            </span>
                          )}
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${meta.badgeCls}`}>
                            <KindIcon className="h-3 w-3" aria-hidden="true" />
                            {meta.label}
                          </span>
                        </div>

                        {isOwner && (
                          <div className="flex shrink-0 items-center gap-1">
                            {onTogglePublic && (
                              <button
                                type="button"
                                onClick={() => onTogglePublic(it.id, !it.isPublic)}
                                title={it.isPublic ? 'Kartımda görünür (gizlemek için tıkla)' : 'Yalnız ben görüyorum (kartta paylaşmak için tıkla)'}
                                aria-label={it.isPublic ? 'Karttan gizle' : 'Kartta görünür yap'}
                                className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
                                  it.isPublic
                                    ? `${r.neonBorder} ${r.tint}`
                                    : 'border-[var(--edge)] text-muted-foreground hover:text-default'
                                }`}
                              >
                                {it.isPublic ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
                                <span className="hidden sm:inline">{it.isPublic ? 'Paylaşımda' : 'Gizli'}</span>
                              </button>
                            )}
                            {onDelete && (
                              <button
                                type="button"
                                onClick={() => onDelete(it.id)}
                                title="Kaydı sil"
                                aria-label="Kaydı sil"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Ünite › Konu Yolu */}
                      {subPath && (
                        <p className="text-xs font-semibold text-muted-foreground" title={subPath}>
                          {subPath}
                        </p>
                      )}

                      {/* Konudakiyle aynı renkli bölüm başlığı */}
                      {displayHeading && (
                        <div className="flex items-center gap-2.5 pt-0.5">
                          <span
                            aria-hidden="true"
                            className="h-5 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-[#3B5BFD] to-[#06B6D4]"
                          />
                          <h3 className={`text-[15px] font-extrabold leading-snug text-[#1E3A8A] dark:text-[#C7D2FE] sm:text-base ${r.display}`}>
                            {displayHeading}
                          </h3>
                        </div>
                      )}

                      {/* Gövde: Notlar konu sayfası gibi renkli madde/kavram/kutu düzeniyle; soru ve konu özetleri temiz kartla */}
                      {it.excerpt ? (
                        it.kind === 'note' ? (
                          <FormattedNoteBody text={it.excerpt} />
                        ) : (
                          <div className="rounded-xl border border-[var(--edge)] bg-white/80 px-3.5 py-2.5 text-sm leading-relaxed text-default dark:bg-[#1E2737]">
                            {renderRichInline(it.excerpt)}
                          </div>
                        )
                      ) : null}

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] text-muted-foreground">{formatDate(it.createdAt)}</span>
                        <Link
                          href={it.href}
                          className={`inline-flex items-center gap-1 text-xs font-bold hover:underline ${r.accent}`}
                        >
                          {meta.actionLabel}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
