// Etkileşimli ders şeması (2026-10-31, Aşama 1: elle yazılmış altın örnek). Bir ders, konunun
// içerik bölümleri (topic_content_sections) kadar bloktan oluşur; her blok kısa anlatım →
// pekiştirme → havuzdan test soruları → havuzdan klasik soru döngüsüdür. Aynı şema Aşama 2'de
// yapay zekâ üretiminin çıktı biçimi olacak; soru adımları havuzdaki soruya id ile bağlanır.
import type { BlankQuestion, ClassicalQuestion, MultipleChoiceQuestion } from '@/app/src/lib/quizQuestionTypes';
import type { IconName } from './icons';

// Görseller. Öncelik hazır bileşenlerde (kartlar/tablo/ağaç/akış/parçala): veri doldurulur, çizim yapılmaz —
// hata tek kelimeyle düzelir, tasarım her derste aynı. Gerçek şema gerekirse SVG (istemcide
// sanitizeMathSvg'den geçer). Resim yalnız isteğe bağlı süs; Türkçe dışı yazı içermemeli, alt zorunlu.
type Caption = { caption?: string };
// Kavram bağı: görseldeki parça bir kavrama ait olduğunu `term` (kavram kimliği) ile söyler; metinde o kavrama
// ([[...]]) dokununca bu parçalar parlar, diğer etiketli parçalar soluklaşır. SVG'de aynı iş data-term ile
// yapılır (boşlukla birden çok kimlik: data-term="gezegen gazsal-gezegenler").
type Term = { term?: string };
export type SvgFigure = Caption & { kind: 'svg'; svg: string };
export type ImageFigure = Caption & { kind: 'resim'; imageUrl: string; alt: string };
// Bilgi kartları: ikon + başlık + kısa açıklama; tag örnek/uzantı gibi vurgulu kısa metin (".mp3, .wav").
export type CardsFigure = Caption & { kind: 'kartlar'; cards: (Term & { icon?: IconName; title: string; text?: string; tag?: string })[] };
// Tablo: "✓" ve "✗" hücreleri simgeyle gösterilir.
export type TableFigure = Caption & { kind: 'tablo'; columns: string[]; rows: string[][] };
// Tek düzeyli ağaç (ana klasör → alt klasörler, sınıflandırma); items alt düğümün altında küçük liste.
export type TreeFigure = Caption & { kind: 'agac'; root: Term & { label: string; icon?: IconName }; children: (Term & { label: string; icon?: IconName; items?: string[] })[] };
// Adım adım akış (oklarla).
export type FlowFigure = Caption & { kind: 'akis'; steps: (Term & { label: string; icon?: IconName })[] };
// Bir ifadeyi parçalarına ayırıp her parçayı etiketler ("odev" | "." | "docx" → ad / nokta / uzantı).
export type PartsFigure = Caption & { kind: 'parcala'; parts: (Term & { text: string; label: string; note?: string })[] };
// 2026-11-03 (görsel ekranlar zayıftı, kullanıcı onayı): yapay zekâ veriyi seçer, çizimi bileşen yapar.
type IconItem = Term & { icon?: IconName; label: string; text?: string };
// İki-üç şeyin birleşmesiyle oluşan kavram: "Gerçek çevre + Dijital bilgi = Artırılmış gerçeklik".
export type EquationFigure = Caption & { kind: 'denklem'; inputs: IconItem[]; result: IconItem };
// Kendini tekrarlayan süreç (su döngüsü, geri dönüşüm): adımlar çember üzerinde, sonuncusu başa döner.
export type CycleFigure = Caption & { kind: 'dongu'; center?: string; steps: IconItem[] };
// Bir bütün ve çevresindeki parçaları/bileşenleri/kullanım alanları.
export type HubFigure = Caption & { kind: 'merkez'; center: IconItem; parts: IconItem[] };
// İki şeyin yan yana karşılaştırması (+ ikisinde ortak olanlar).
export type CompareFigure = Caption & { kind: 'karsilastir'; sides: [CompareSide, CompareSide]; common?: string[] };
export type CompareSide = Term & { icon?: IconName; title: string; points: string[] };
// Sayısal büyüklüklerin karşılaştırması (yalnız kaynakta sayı varsa); display gösterilen değer ("%60", "1,3 milyon").
export type BarsFigure = Caption & { kind: 'cubuk'; bars: (Term & { label: string; value: number; display?: string; icon?: IconName })[] };
export type LessonVisual = SvgFigure | ImageFigure | CardsFigure | TableFigure | TreeFigure | FlowFigure | PartsFigure | EquationFigure | CycleFigure | HubFigure | CompareFigure | BarsFigure;

// Anlatım kalıbı (pedagojik gerekçe: ön test etkisi, ikili kodlama, gereksiz tekrardan kaçınma, çürütme metni):
// - predict: içerik gösterilmeden önce tek hızlı tahmin sorusu (puana sayılmaz); cevaplanınca içerik açılır.
// - visual bilgiyi taşır; body yalnız kuralı/örüntüyü söyler, görselde yazanı TEKRARLAMAZ. **kalın** desteklenir;
//   [[görünen metin|kavram-kimliği]] ya da [[kavram]] dokunulabilir kavram bağıdır (görselde parlatır + tanım kartı);
//   görsel tek başına anlatıyorsa body boş bırakılabilir (görsel tam genişlik).
// - misconception: konudaki yaygın yanılgı (wrong) ve doğrusu (right); ayrı, dikkat çeken kutuda.
export type NarrativeStep = {
  kind: 'anlatim';
  title: string;
  body?: string;
  visual?: LessonVisual;
  predict?: { question: string; options: string[]; answer: number };
  misconception?: { wrong: string; right: string };
  // Gerçek fotoğraf (2026-11-06, kullanıcı isteği): Wikimedia Commons'tan serbest lisanslı; metin ekranında gösterilir,
  // altında yazar + lisans + kaynak (lisans şartı). Bkz. app/src/lib/interactiveLesson/photos.ts.
  photo?: LessonPhoto;
};
export type LessonPhoto = { url: string; alt: string; credit: string; license: string; source: string };

// Eşleştirme ve gruplama aynı tip: her öğe targets'tan birine (index) gider; birden çok öğe aynı
// hedefe gidebilir (gruplama).
export type MatchStep = {
  kind: 'eslestirme';
  prompt: string;
  visual?: LessonVisual;
  targets: string[];
  items: { text: string; target: number }[];
  explanation: string;
};

// Öğrenci her ifadeyi D/Y işaretler; kontrol sonrası her ifadenin açıklaması (yanlışın doğrusu) görünür.
export type TrueFalseStep = {
  kind: 'dogru_yanlis';
  prompt: string;
  statements: { text: string; correct: boolean; note: string }[];
};

// text içinde {0}, {1}… boşlukları; answers[i] o boşluğun doğru sözcüğü. Kelime bankası =
// answers + distractors, karışık.
export type BlankStep = {
  kind: 'bosluk';
  prompt: string;
  visual?: LessonVisual;
  text: string;
  answers: string[];
  distractors: string[];
  explanation: string;
};

// items DOĞRU sırada yazılır; öğrenciye karışık gösterilir.
export type SortStep = { kind: 'siralama'; prompt: string; visual?: LessonVisual; items: string[]; explanation: string };

// Birden çok doğru olabilir; öğrenci doğru olanların hepsini işaretler.
export type MultiStep = {
  kind: 'coklu_secim';
  prompt: string;
  visual?: LessonVisual;
  options: { text: string; icon?: IconName; correct: boolean }[];
  explanation: string;
};

// GÖRSEL ÖNCELİKLİ PENCERELER (2026-10-31): öğrenci görselle etkileşir; üçü de aynı SVG'yi ve onun kavram
// etiketlerini (data-term = bölge, data-label = o bölgenin yazısı) kullanır — ayrı çizim gerekmez.

// Keşif haritası: büyük harita; öğrenci bölgelere (ör. gezegenlere) dokunup her birini yakından tanır
// (büyük resim + özellik tablosu + öne çıkan bilgi). Hepsi keşfedilince devam edilir. Anlatım sayılır.
export type ExploreStep = {
  kind: 'kesif';
  title: string;
  intro?: string;
  map: SvgFigure;
  // Her öğe bir KAVRAM kimliği: başlık, resim/ikon, öne çıkan bilgi (description) ve özellik tablosu (facts)
  // kavram kaydından gelir (LessonTerm) — aynı kart derste, çözümde ve örnek cevapta da açılır, bilgi tek yerde.
  items: { term: string }[];
  predict?: NarrativeStep['predict'];
  misconception?: NarrativeStep['misconception'];
};

// Görseli etiketle: haritadaki data-label="<term>" yazıları gizlenir, yerlerine boş yuva gelir; öğrenci
// etiketleri doğru yuvaya yerleştirir (dokun-yerleştir; bilgisayarda sürükle-bırak).
export type LabelStep = { kind: 'etiketle'; prompt: string; map: SvgFigure; labels: { term: string; text: string }[]; explanation: string };

// Görselde bul: "…na dokun" soruları; dokunulan nokta en yakın bölgeye (zones) eşlenir (küçük hedefler için).
export type FindStep = {
  kind: 'bul';
  prompt: string;
  map: SvgFigure;
  zones: { term: string; name: string }[];
  questions: { prompt: string; term: string }[];
  // Cevabı ele veren yazılar (data-label) gizlenir: ör. satır başlığı "Halka var", top adı "Jüpiter".
  hideLabels?: string[];
  explanation?: string;
};

export type QuestionStep = { kind: 'soru'; questionId: number };
// "Konuyu anladık mı?": havuzdaki klasik soru (questionId) ya da derste yazılmış soru + örnek cevap.
export type ClassicalStep = { kind: 'klasik'; questionId: number } | { kind: 'klasik'; prompt: string; modelAnswer: string };

export type LessonStep =
  | NarrativeStep
  | ExploreStep
  | MatchStep
  | TrueFalseStep
  | BlankStep
  | SortStep
  | MultiStep
  | LabelStep
  | FindStep
  | QuestionStep
  | ClassicalStep;
export type LessonBlock = { sectionId: number; title: string; steps: LessonStep[] };
// Kavram tanımı. Kaynak öncelikle konunun anahtar kavramları (topic_content_highlights; kimlik = başlığın
// termSlug'ı); orada olmayan ya da düzeltilmesi gereken kavramlar derste `terms` ile verilir (öncelik derstekinde).
// KAVRAM KARTI (2026-10-31): bir kavramın tek kaydı — derste kavram bağı, keşif kartı, çözüm/örnek cevapta otomatik
// bağlantı hep bunu gösterir. image: gerçek fotoğraf/çizim (kaynağıyla); iconName: resim yoksa büyük ikon;
// facts: özellik tablosu ("✓"/"✗" simgeyle); aliases: metinde otomatik tanınacak ek adlar (başlık zaten tanınır).
export type LessonTerm = {
  title: string;
  // Düğme gibi dar yerlerde kullanılan kısa ad ("Merkezi İşlem Birimi (İşlemci)" → "İşlemci").
  shortTitle?: string;
  description: string;
  icon?: string;
  iconName?: IconName;
  image?: { url: string; alt: string; credit: string };
  facts?: { label: string; value: string }[];
  aliases?: string[];
};
// autoLinkExclude: çözüm/örnek cevapta OTOMATİK bağlanmayacak çok genel kavramlar ("dosya", "klasör" her cümlede
// geçer, gürültü olur); bunlar yalnız [[...]] ile açıkça bağlanır.
// guide: anlatıcı robotun bu derse özel hikâyesi (açılış ve kapanış cümlesi); yoksa ortak cümleler (guide.ts).
export type LessonGuide = { intro: string; finish: string };
export type LessonDefinition = { topicId: number; blocks: LessonBlock[]; terms?: Record<string, LessonTerm>; autoLinkExclude?: string[]; guide?: LessonGuide };

// İstemciye giden hâl: soru adımları havuzdaki soruyla doldurulmuş.
export type HydratedStep =
  | NarrativeStep
  | MatchStep
  | TrueFalseStep
  | BlankStep
  | SortStep
  | MultiStep
  | ExploreStep
  | LabelStep
  | FindStep
  | { kind: 'soru'; question: MultipleChoiceQuestion | BlankQuestion }
  | { kind: 'klasik'; question: ClassicalQuestion };
// spares: aynı bölümün havuzunda derste kullanılmamış test soruları — bölüm sonunda yanlış yapılan
// soruların yerine "benzer soru" olarak sorulur (aynı soruyu tekrar sormak cevabı ezberletir).
export type HydratedBlock = { sectionId: number; title: string; steps: HydratedStep[]; spares: (MultipleChoiceQuestion | BlankQuestion)[] };
export type HydratedLesson = { topicId: number; topicTitle: string; blocks: HydratedBlock[]; terms: Record<string, LessonTerm>; autoLinkExclude: string[]; guide?: LessonGuide };

// Kavram kimliği: Türkçe harfler sadeleştirilmiş, küçük harf, tireli ("Asteroit Kuşağı" → "asteroit-kusagi").
export function termSlug(text: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıiöşüâîû]/g, (ch) => map[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// "[[metin|kimlik]]" / "[[metin]]" → parçalar. Kimlik verilmezse metnin termSlug'ı.
export const TERM_LINK = /\[\[([^\]|]+)(?:\|([a-z0-9-]+))?\]\]/g;
