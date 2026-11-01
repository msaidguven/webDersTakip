'use client';

// Etkileşimli dersin görselleri: hazır bileşenler (kartlar, tablo, ağaç, akış, parçala) + SVG + resim.
// Hazır bileşenler yalnız veriyle çizilir (bkz. app/src/lib/interactiveLesson/types.ts LessonVisual).
import { useId, useMemo, type ReactNode } from 'react';
import {
  Archive, ArrowDown, ArrowDownUp, ArrowRight, BookOpen, Calculator, CircleCheck, Clapperboard, ClipboardPaste, Cloud, Cog, Copy,
  Database, File, FilePlus, FileText, Flame, Folder, FolderInput, FolderOpen, FolderPlus, Gauge, Globe, HardDrive, Image,
  Keyboard, Layers, Lightbulb, Lock, Mail, MemoryStick, Monitor, Moon, Mouse, MousePointerClick, Music, Orbit, Package, Pencil,
  Percent, Presentation, Recycle, Redo2, Rocket, Ruler, Scale, Scissors, Search, Sheet, ShieldAlert, Smartphone, Sparkles, Star,
  Sun, Thermometer, Trash2, TriangleAlert, Undo2, Usb, Users, X, Zap, Mic, Printer, Speaker, Cpu, Tent, Mountain, Landmark, Footprints, MapPin, CircuitBoard, Repeat, type LucideIcon,
} from 'lucide-react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import type { IconName } from '@/app/src/lib/interactiveLesson/icons';
import type { CardsFigure, FlowFigure, LessonVisual, PartsFigure, TableFigure, TreeFigure } from '@/app/src/lib/interactiveLesson/types';

export const LESSON_ICONS: Record<IconName, LucideIcon> = {
  Archive, ArrowDownUp, BookOpen, Calculator, CircleCheck, Clapperboard, ClipboardPaste, Cloud, Cog, Copy, Database, File,
  FilePlus, FileText, Flame, Folder, FolderInput, FolderOpen, FolderPlus, Gauge, Globe, HardDrive, Image, Keyboard, Layers,
  Lightbulb, Lock, Mail, MemoryStick, Monitor, Moon, Mouse, MousePointerClick, Music, Orbit, Package, Pencil, Percent,
  Presentation, Recycle, Redo2, Rocket, Ruler, Scale, Scissors, Search, ShieldAlert, Sheet, Smartphone, Sparkles, Star, Sun,
  Thermometer, Trash2, TriangleAlert, Undo2, Usb, Users, Zap, Mic, Printer, Speaker, Cpu, Tent, Mountain, Landmark, Footprints, MapPin, CircuitBoard, Repeat,
};

// Kart/düğüm renkleri sırayla döner; her derste aynı palet. Bileşen görselleri oynatıcının açık oyun temasında
// (beyaz, kalın alt kenarlı kartlar); koyu "pencere" yalnız koyu zemine çizilmiş SVG'ler ve resimler için.
const ACCENTS = ['text-sky-700 bg-sky-100', 'text-amber-700 bg-amber-100', 'text-emerald-700 bg-emerald-100', 'text-fuchsia-700 bg-fuchsia-100', 'text-indigo-700 bg-indigo-100', 'text-rose-700 bg-rose-100'];
const CARD = 'rounded-2xl border-2 border-b-4 border-slate-200 bg-white';
const LINE = 'bg-slate-300';

export function LessonIcon({ name, className }: { name?: IconName; className?: string }) {
  const Icon = name ? LESSON_ICONS[name] : null;
  return Icon ? <Icon className={className} aria-hidden="true" /> : null;
}

// Kavram bağı: aktif kavrama ait öğe parlar; aynı görselde o kavrama ait öğe varsa diğer etiketli öğeler soluklaşır.
const GLOW = 'ring-4 ring-amber-300 shadow-[0_0_22px_rgba(245,158,11,0.35)]';
const DIM = 'opacity-35';
type Termed = { term?: string };
function termClass(item: Termed, active: string | null | undefined, figureHasActive: boolean): string {
  if (!active || !figureHasActive) return '';
  return item.term === active ? GLOW : DIM;
}

function termsOf(visual: LessonVisual): Termed[] {
  switch (visual.kind) {
    case 'kartlar':
      return visual.cards;
    case 'agac':
      return [visual.root, ...visual.children];
    case 'akis':
      return visual.steps;
    case 'parcala':
      return visual.parts;
    default:
      return [];
  }
}

// Görselde bu kavrama ait bir parça var mı (SVG'de data-term, diğerlerinde öğe `term`i)?
export function visualHasTerm(visual: LessonVisual | undefined, term: string): boolean {
  if (!visual) return false;
  if (visual.kind === 'svg') return new RegExp(`data-term="([^"]* )?${term}( [^"]*)?"`).test(visual.svg);
  return termsOf(visual).some((t) => t.term === term);
}

type ActiveProps = { active?: string | null; hasActive: boolean };

function Cards({ figure, compact, active, hasActive }: { figure: CardsFigure; compact: boolean } & ActiveProps) {
  const n = figure.cards.length;
  const cols = compact ? 'grid-cols-2' : n === 4 ? 'grid-cols-2 sm:grid-cols-4' : n <= 6 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
  return (
    <ul className={`grid gap-2.5 ${cols}`}>
      {figure.cards.map((c, i) => (
        <li key={i} className={`flex flex-col items-center p-3 text-center transition ${CARD} ${termClass(c, active, hasActive)}`}>
          {c.icon && (
            <span className={`grid h-11 w-11 place-items-center rounded-full ${ACCENTS[i % ACCENTS.length]}`}>
              <LessonIcon name={c.icon} className="h-6 w-6" />
            </span>
          )}
          <p className="mt-2 font-bold leading-tight text-slate-900">{c.title}</p>
          {c.tag && <p className="mt-1.5 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold text-slate-800">{c.tag}</p>}
          {c.text && <p className="mt-1.5 text-sm leading-snug text-slate-600">{c.text}</p>}
        </li>
      ))}
    </ul>
  );
}

function Cell({ value }: { value: string }) {
  if (value === '✓') return <CircleCheck className="mx-auto h-5 w-5 text-emerald-600" aria-label="Var" />;
  if (value === '✗') return <X className="mx-auto h-5 w-5 text-slate-400" aria-label="Yok" />;
  return <>{value}</>;
}

// Kısa değer sütunları (✓/✗, sayı, %60 gibi) ortalanır; metin sütunları sola dayalı kalır.
function Table({ figure }: { figure: TableFigure }) {
  const centered = figure.columns.map((_, c) => c > 0 && figure.rows.every((r) => (r[c] ?? '').length <= 8));
  return (
    <div className={`mx-auto max-w-3xl overflow-x-auto ${CARD}`}>
      <table className="w-full border-collapse text-base">
        <thead>
          <tr className="bg-slate-50">
            {figure.columns.map((c, i) => (
              <th key={i} scope="col" className={`px-3 py-2.5 text-sm font-bold text-slate-800 ${centered[i] ? 'text-center' : 'text-left'}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {figure.rows.map((row, r) => (
            <tr key={r} className="border-t border-slate-100">
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-3 py-2 text-left font-semibold text-slate-900">{cell}</th>
                ) : (
                  <td key={i} className={`px-3 py-2 text-slate-700 ${centered[i] ? 'text-center' : 'text-left'}`}><Cell value={cell} /></td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tree({ figure, active, hasActive }: { figure: TreeFigure } & ActiveProps) {
  const n = figure.children.length;
  return (
    <div className="flex flex-col items-center">
      <div className={`inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 border-amber-300 bg-amber-50 px-4 py-2.5 font-bold text-amber-900 transition ${termClass(figure.root, active, hasActive)}`}>
        <LessonIcon name={figure.root.icon ?? 'Folder'} className="h-5 w-5 text-amber-600" />
        {figure.root.label}
      </div>
      <div className={`h-4 w-0.5 ${LINE}`} aria-hidden="true" />
      <ul className={`grid w-full gap-2.5 ${n <= 2 ? 'grid-cols-2' : n === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {figure.children.map((c, i) => (
          <li key={i} className="relative flex flex-col items-center border-t-2 border-slate-300 pt-4">
            <span className={`absolute top-0 h-4 w-0.5 ${LINE}`} aria-hidden="true" />
            <div className={`flex w-full flex-col items-center px-2 py-2.5 text-center transition ${CARD} ${termClass(c, active, hasActive)}`}>
              <span className={`grid h-9 w-9 place-items-center rounded-full ${ACCENTS[i % ACCENTS.length]}`}>
                <LessonIcon name={c.icon ?? 'Folder'} className="h-5 w-5" />
              </span>
              <p className="mt-1.5 text-base font-bold leading-tight text-slate-900">{c.label}</p>
              {c.items && c.items.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-sm text-slate-600">
                  {c.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Yarım sütunda ya da 5'ten çok adımda dikey zaman çizelgesi (kırık kırık sarmasın); aksi hâlde tek satır.
function Flow({ figure, compact, active, hasActive }: { figure: FlowFigure; compact: boolean } & ActiveProps) {
  const vertical = compact || figure.steps.length > 5;
  if (vertical) {
    return (
      <ol className="relative space-y-2.5 before:absolute before:bottom-4 before:left-[1.125rem] before:top-4 before:w-0.5 before:bg-slate-300">
        {figure.steps.map((st, i) => (
          <li key={i} className="relative flex items-center gap-3">
            <span className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-bold ring-4 ring-[#eef2fb] ${ACCENTS[i % ACCENTS.length]}`}>
              {st.icon ? <LessonIcon name={st.icon} className="h-[18px] w-[18px]" /> : i + 1}
            </span>
            <span className={`flex-1 px-3 py-2.5 text-base font-semibold text-slate-800 transition ${CARD} ${termClass(st, active, hasActive)}`}>{st.label}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:justify-center">
      {figure.steps.map((st, i) => (
        <li key={i} className="flex flex-col items-center gap-1 sm:flex-1 sm:flex-row">
          <div className={`flex w-full flex-col items-center gap-2 px-3 py-3 text-center transition ${CARD} ${termClass(st, active, hasActive)}`}>
            <span className={`grid h-10 w-10 place-items-center rounded-full text-base font-bold ${ACCENTS[i % ACCENTS.length]}`}>
              {st.icon ? <LessonIcon name={st.icon} className="h-5 w-5" /> : i + 1}
            </span>
            <span className="text-base font-semibold leading-tight text-slate-800">{st.label}</span>
          </div>
          {i < figure.steps.length - 1 && (
            <>
              <ArrowDown className="h-5 w-5 shrink-0 text-orange-400 sm:hidden" aria-hidden="true" />
              <ArrowRight className="hidden h-5 w-5 shrink-0 text-orange-400 sm:block" aria-hidden="true" />
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

function Parts({ figure, active, hasActive }: { figure: PartsFigure } & ActiveProps) {
  return (
    <div className="flex flex-wrap items-stretch justify-center gap-2">
      {figure.parts.map((p, i) => (
        <div key={i} className={`flex min-w-[3.5rem] max-w-[7rem] flex-col items-center text-center transition ${hasActive && active && p.term !== active ? DIM : ''}`}>
          <span className={`rounded-lg px-2.5 py-1.5 font-mono text-base font-bold transition sm:px-3 sm:py-2 sm:text-lg ${ACCENTS[i % ACCENTS.length]} ${hasActive && active && p.term === active ? GLOW : ''}`}>{p.text}</span>
          <span className={`my-1 h-3 w-0.5 ${LINE}`} aria-hidden="true" />
          <span className="text-sm font-bold uppercase tracking-wide text-slate-800">{p.label}</span>
          {p.note && <span className="mt-0.5 text-sm leading-snug text-slate-500">{p.note}</span>}
        </div>
      ))}
    </div>
  );
}

const SAFE_TERM = /^[a-z0-9-]+$/;

// Etkileşimli SVG haritası (kavram bağı, keşif, etiketleme, görselde bul ortak altyapısı):
// - active: o kavramın data-term'li parçaları parlar, diğer etiketliler `dim` saydamlığına iner;
// - hiddenLabels: data-label'ı bu kimliklerden biri olan yazılar gizlenir (etiketleme sorusu);
// - onPoint: dokunulan nokta (istemci koordinatı) + SVG kabı; bölge seçimi nearestTerm ile yapılır;
// - children: SVG'nin üstüne mutlak konumlu katman (yuvalar). innerRef SVG kabını verir (bölge kutuları için).
// Kimlikler yalnız [a-z0-9-] olduğundan CSS seçicisine güvenle girer.
export function MapSvg({
  svg,
  active,
  dim = 0.18,
  hiddenLabels = [],
  onPoint,
  innerRef,
  children,
  maxH = 'lg:[&>svg]:max-h-[58vh]',
  onDropPoint,
}: {
  svg: string;
  active?: string | null;
  dim?: number;
  hiddenLabels?: string[];
  onPoint?: (x: number, y: number, box: HTMLDivElement) => void;
  innerRef?: (el: HTMLDivElement | null) => void;
  children?: ReactNode;
  // Geniş ekranda en fazla yükseklik (Tailwind sınıfı); soru ekranlarında harita daha kısa tutulur.
  maxH?: string;
  // Sürükle-bırak: bir şey haritanın üstüne (ör. gezegenin üstüne) bırakılınca nokta + aktarılan veri.
  onDropPoint?: (x: number, y: number, data: string, box: HTMLDivElement) => void;
}) {
  // Oynatıcı yalnız istemcide (düğmeyle) açılır; DOMPurify'ın window gereksinimi sorun değil.
  const clean = useMemo(() => sanitizeMathSvg(svg), [svg]);
  const scope = `f${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!clean) return null;
  const sel = `[data-fig="${scope}"]`;
  const safe = active && SAFE_TERM.test(active) ? active : null;
  const css =
    `${sel} [data-term]{transition:opacity .25s,filter .25s}` +
    (onPoint ? `${sel} [data-term]{cursor:pointer}` : '') +
    hiddenLabels.filter((t) => SAFE_TERM.test(t)).map((t) => `${sel} [data-label~="${t}"]{visibility:hidden}`).join('') +
    (safe
      ? `${sel} [data-term]{opacity:${dim}}` +
        `${sel} [data-term~="${safe}"]{opacity:1;filter:drop-shadow(0 0 4px #fcd34d) drop-shadow(0 0 10px #fcd34d)}`
      : '');
  // Geniş ekranda uzun şemalar ekran yüksekliğini aşmasın (en-boy oranı korunur).
  return (
    <div className="relative">
      <style>{css}</style>
      <div
        ref={innerRef}
        data-fig={scope}
        onClick={onPoint ? (e) => onPoint(e.clientX, e.clientY, e.currentTarget) : undefined}
        onDragOver={onDropPoint ? (e) => e.preventDefault() : undefined}
        onDrop={
          onDropPoint
            ? (e) => {
                e.preventDefault();
                onDropPoint(e.clientX, e.clientY, e.dataTransfer.getData('text/plain'), e.currentTarget);
              }
            : undefined
        }
        className={`[&>svg]:h-auto [&>svg]:w-full ${maxH}`}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
      {children}
    </div>
  );
}

// Dokunulan noktaya en yakın bölge (data-term'inde adaylardan biri olan öğe). Nokta öğenin kutusunun içindeyse
// mesafe 0; küçük hedeflerde (telefonda Merkür ~3 px) parmak tam isabet etmese de doğru bölge seçilir.
export function nearestTerm(box: HTMLElement, x: number, y: number, candidates: string[], maxDist = 44): string | null {
  // Eşit mesafede (ör. nokta hem anakartın hem üstündeki işlemcinin içinde) küçük, yani daha özgül bölge seçilir.
  let best: { term: string; d: number; area: number } | null = null;
  box.querySelectorAll<SVGGraphicsElement>('[data-term]').forEach((el) => {
    const terms = (el.getAttribute('data-term') ?? '').split(/\s+/);
    const term = candidates.find((c) => terms.includes(c));
    if (!term) return;
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const d = Math.hypot(dx, dy);
    const area = r.width * r.height;
    if (d > maxDist) return;
    if (!best || d < best.d || (d === best.d && area < best.area)) best = { term, d, area };
  });
  return (best as { term: string } | null)?.term ?? null;
}

// Bir yazının (data-label) kabına göre konumu: etiketleme yuvaları gizlenen yazının yerine oturur.
export function labelRect(box: HTMLElement, term: string): { x: number; y: number; w: number; h: number } | null {
  const el = box.querySelector(`[data-label~="${SAFE_TERM.test(term) ? term : '_'}"]`);
  if (!el) return null;
  const b = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, w: r.width, h: r.height };
}

// compact: görsel yarım genişlikte (metnin yanında) çiziliyor — kart ızgarası 2 sütunda kalır.
// active: metinde dokunulan kavram (kavram bağı); görselde o kavrama ait parçalar parlar.
export default function LessonFigure({ visual, compact = false, active }: { visual: LessonVisual; compact?: boolean; active?: string | null }) {
  const framed = visual.kind === 'svg' || visual.kind === 'resim';
  const hasActive = !!active && visualHasTerm(visual, active);
  return (
    // SVG ve resim koyu "pencere"de (koyu zemine çizildiler); bileşenler oynatıcının açık temasında, çerçevesiz.
    <figure className={framed ? 'overflow-hidden rounded-2xl bg-[#151c3f] ring-1 ring-black/5' : ''}>
      {visual.kind === 'svg' && <div className="p-3"><MapSvg svg={visual.svg} active={hasActive ? active : null} /></div>}
      {visual.kind === 'resim' && (
        // Storage URL'i; next/image alan adı izni gerektirmesin diye düz img.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={visual.imageUrl} alt={visual.alt} loading="lazy" className="max-h-[40vh] w-full object-cover" />
      )}
      {visual.kind === 'kartlar' && <Cards figure={visual} compact={compact} active={active} hasActive={hasActive} />}
      {visual.kind === 'tablo' && <Table figure={visual} />}
      {visual.kind === 'agac' && <Tree figure={visual} active={active} hasActive={hasActive} />}
      {visual.kind === 'akis' && <Flow figure={visual} compact={compact} active={active} hasActive={hasActive} />}
      {visual.kind === 'parcala' && <Parts figure={visual} active={active} hasActive={hasActive} />}
      {visual.caption && <figcaption className={`text-center text-sm ${framed ? 'px-3 py-2 text-slate-300' : 'mt-2 text-slate-500'}`}>{visual.caption}</figcaption>}
    </figure>
  );
}
