// Etkileşimli ders ŞABLON KATALOĞU (2026-10-31): her ekran ve görsel türü tek bir standart "pencere"dir;
// bütün dersler aynı pencereleri kullanır. Burada her pencerenin amacı (yapay zekâ hangi içerik için hangi
// pencereyi seçeceğine buna bakarak karar verir) ve sınırları (bir ekrana sığma + okunur punto) tek yerde
// tanımlıdır. Sınırı aşan içerik ikinci ekrana bölünür. validateLesson hem elle yazılan hem üretilen dersleri
// aynı kurallarla denetler.
import { TERM_LINK, termSlug, type LessonDefinition, type LessonStep, type LessonTerm, type LessonVisual } from './types';

type Range = [min: number, max: number];

export const STEP_TEMPLATES = {
  // Görsel ÖNCELİKLİ (kullanıcı ilkesi 2026-10-31: "düz anlatımın faydası yok, öğrenci görsün ve yapsın"):
  // her anlatımda görsel zorunlu; görsel kavramı taşır, metin onu etiketleyen 1-2 cümle.
  anlatim: { name: 'Anlatım', purpose: 'Tek fikir. Bilgiyi görsel taşır (zorunlu), metin yalnız kuralı/örüntüyü söyler.', titleMax: 40, bodyWordsMax: 45, predictOptions: [2, 4] as Range, misconceptionCharsMax: 120 },
  kesif: { name: 'Keşif haritası', purpose: 'Birkaç benzer öğeyi (gezegenler, organlar, parçalar) tek haritada; öğrenci dokunup her birini resim + özelliklerle tanır.', items: [3, 8] as Range, factsPerItem: [2, 5] as Range, noteMax: 70 },
  etiketle: { name: 'Görseli etiketle', purpose: 'Bir görselin parçalarının adlarını yerine koymak (harita, şema, organ, devre).', labels: [2, 6] as Range },
  bul: { name: 'Görselde bul', purpose: 'Özelliği verilen parçayı görselde bulup dokunmak.', questions: [2, 5] as Range },
  // Bire bir eşleştirme (öğe sayısı = hedef sayısı) en çok 7 satır; gruplama tablosu (2-4 grup) satırları
  // kompakt olduğu için 8 satıra kadar (ör. 8 gezegeni karasal/gazsal ayırma).
  eslestirme: { name: 'Eşleştirme / gruplama', purpose: 'Kavram ↔ tanım/örnek eşleşmesi; ya da öğeleri 2-4 gruba ayırma.', items: [3, 7] as Range, groupItems: [4, 8] as Range, targets: [2, 7] as Range, groupTargets: [2, 4] as Range, itemCharsMax: 32 },
  dogru_yanlis: { name: 'Doğru / yanlış tablosu', purpose: 'Yanılgıları yakalamak; her yanlış ifadenin doğrusu açıklamada.', statements: [3, 5] as Range, statementCharsMax: 90 },
  bosluk: { name: 'Boşluk doldurma', purpose: 'Terimleri bağlam içinde kullanmak (süreç cümlesi, hesap sonucu).', blanks: [1, 4] as Range, distractors: [1, 3] as Range, textCharsMax: 280 },
  siralama: { name: 'Sıralama', purpose: 'Sırası olan bilgi: adımlar, büyüklük/küçüklük, zaman.', items: [3, 6] as Range },
  coklu_secim: { name: 'Çoklu seçim', purpose: 'Bir ölçüte uyanların hepsini bulmak.', options: [4, 6] as Range, correct: [2, 4] as Range },
  soru: { name: 'Test sorusu', purpose: 'Havuzdan, aynı bölümün sorusu.' },
  klasik: { name: 'Konuyu anladık mı?', purpose: 'Açık uçlu; öğrenci yazar, örnek cevapla karşılaştırır.', promptCharsMax: 250 },
} as const;

export const VISUAL_TEMPLATES = {
  kartlar: { name: 'Bilgi kartları', purpose: 'Türler/çeşitler/işlemler: ikon + başlık + kısa bilgi.', cards: [2, 6] as Range, titleMax: 26, textMax: 60, tagMax: 24 },
  tablo: { name: 'Tablo', purpose: 'Birkaç öğenin aynı özelliklerde karşılaştırılması.', columns: [2, 4] as Range, rows: [2, 6] as Range, cellMax: 40 },
  agac: { name: 'Ağaç', purpose: 'Hiyerarşi: ana öğe → alt öğeler.', children: [2, 4] as Range, itemsPerChild: [0, 3] as Range },
  akis: { name: 'Akış', purpose: 'Süreç adımları; adım adım ilerleyen bilgi.', steps: [2, 6] as Range, labelMax: 40 },
  // Yalnız YAZILI bir ifadeyi bölmek için (dosya adı, adres, kelime + ek); kavram anlatımında kullanılırsa iki
  // kelime + not olarak boş görünüyor (565, 2026-11-02) — kısa parça sınırı bunu da zorlaştırır.
  parcala: { name: 'Parçalı etiket', purpose: 'Yazılı bir ifadeyi (dosya adı, adres, kelime + ek) parçalarına ayırıp her parçayı adlandırmak.', parts: [2, 5] as Range, textMax: 16 },
  denklem: { name: 'Denklem', purpose: 'İki-üç şeyin birleşmesiyle oluşan kavram (A + B = C).', inputs: [2, 3] as Range, labelMax: 24, textMax: 50 },
  dongu: { name: 'Döngü', purpose: 'Kendini tekrarlayan süreç; son adım başa döner.', steps: [3, 5] as Range, labelMax: 24, centerMax: 20 },
  merkez: { name: 'Merkez ve parçaları', purpose: 'Bir bütün ve çevresindeki parçaları / bileşenleri / kullanım alanları.', parts: [3, 6] as Range, labelMax: 24, textMax: 50 },
  karsilastir: { name: 'Karşılaştırma', purpose: 'İki şeyin yan yana farkları (+ ortak yönleri).', points: [2, 4] as Range, common: [0, 3] as Range, titleMax: 24, pointMax: 50 },
  cubuk: { name: 'Çubuk grafik', purpose: 'Kaynakta verilen sayısal büyüklükleri karşılaştırmak.', bars: [2, 6] as Range, labelMax: 24 },
  svg: { name: 'Şema (SVG)', purpose: 'Gerçek bir şekil gerektiğinde (gezegenler, devre, harita…). Yazılar Türkçe, telefonda okunur.' },
  resim: { name: 'Resim', purpose: 'Yalnız isteğe bağlı süs; bilgi taşımaz, yabancı dilde yazı içermez.' },
} as const;

// Bölüm (alt konu) başına adım sayıları: 4-6 dakikalık döngü.
// anlatim sayısına keşif haritası da dahil; pekiştirmeye etiketle ve bul da dahil.
export const BLOCK_LIMITS = { anlatim: [1, 4] as Range, pekistirme: [1, 3] as Range, soru: [2, 4] as Range, klasik: [1, 2] as Range };

// Kavram bağı işaretleri ([[metin|kimlik]]) sayılmaz, yalnız görünen metin.
const svgHasTerm = (svg: string, term: string) => new RegExp(`data-term="([^"]* )?${term}( [^"]*)?"`).test(svg);

const words = (s: string) => s.replace(TERM_LINK, '$1').trim().split(/\s+/).filter(Boolean).length;

// Metindeki kavram bağlarının kimlikleri; bozuk yazım (kapanmayan [[ ) ayrıca bildirilir.
function termLinks(out: string[], where: string, body: string): string[] {
  const ids = [...body.matchAll(TERM_LINK)].map((m) => m[2] ?? termSlug(m[1]));
  if ((body.match(/\[\[/g) ?? []).length !== ids.length) out.push(`${where}: bozuk kavram bağı yazımı ([[metin|kimlik]] olmalı)`);
  return ids;
}

function checkRange(out: string[], where: string, what: string, n: number, [min, max]: Range) {
  if (n < min || n > max) out.push(`${where}: ${what} ${n} (sınır ${min}-${max})`);
}
function checkLen(out: string[], where: string, what: string, s: string | undefined, max: number) {
  if (s && s.length > max) out.push(`${where}: ${what} ${s.length} karakter (en çok ${max}): "${s.slice(0, 40)}…"`);
}

export function validateVisual(out: string[], where: string, v: LessonVisual) {
  switch (v.kind) {
    case 'kartlar': {
      const t = VISUAL_TEMPLATES.kartlar;
      checkRange(out, where, 'kart sayısı', v.cards.length, t.cards);
      v.cards.forEach((c) => {
        checkLen(out, where, 'kart başlığı', c.title, t.titleMax);
        checkLen(out, where, 'kart metni', c.text, t.textMax);
        checkLen(out, where, 'kart etiketi', c.tag, t.tagMax);
      });
      break;
    }
    case 'tablo': {
      const t = VISUAL_TEMPLATES.tablo;
      checkRange(out, where, 'sütun', v.columns.length, t.columns);
      checkRange(out, where, 'satır', v.rows.length, t.rows);
      v.rows.flat().forEach((c) => checkLen(out, where, 'hücre', c, t.cellMax));
      break;
    }
    case 'agac':
      checkRange(out, where, 'alt öğe', v.children.length, VISUAL_TEMPLATES.agac.children);
      v.children.forEach((c) => checkRange(out, where, `"${c.label}" altındaki öğe`, c.items?.length ?? 0, VISUAL_TEMPLATES.agac.itemsPerChild));
      break;
    case 'akis':
      checkRange(out, where, 'akış adımı', v.steps.length, VISUAL_TEMPLATES.akis.steps);
      v.steps.forEach((st) => checkLen(out, where, 'akış etiketi', st.label, VISUAL_TEMPLATES.akis.labelMax));
      break;
    case 'parcala':
      checkRange(out, where, 'parça', v.parts.length, VISUAL_TEMPLATES.parcala.parts);
      v.parts.forEach((p) => checkLen(out, where, 'parça (yalnız yazılı ifade bölünür; kavram için denklem/merkez/kartlar)', p.text, VISUAL_TEMPLATES.parcala.textMax));
      break;
    case 'denklem': {
      const t = VISUAL_TEMPLATES.denklem;
      checkRange(out, where, 'denklem girdisi', v.inputs.length, t.inputs);
      [...v.inputs, v.result].forEach((it) => {
        checkLen(out, where, 'denklem etiketi', it.label, t.labelMax);
        checkLen(out, where, 'denklem açıklaması', it.text, t.textMax);
      });
      break;
    }
    case 'dongu': {
      const t = VISUAL_TEMPLATES.dongu;
      checkRange(out, where, 'döngü adımı', v.steps.length, t.steps);
      v.steps.forEach((st) => checkLen(out, where, 'döngü etiketi', st.label, t.labelMax));
      checkLen(out, where, 'döngü ortası', v.center, t.centerMax);
      break;
    }
    case 'merkez': {
      const t = VISUAL_TEMPLATES.merkez;
      checkRange(out, where, 'parça', v.parts.length, t.parts);
      [v.center, ...v.parts].forEach((it) => {
        checkLen(out, where, 'etiket', it.label, t.labelMax);
        checkLen(out, where, 'açıklama', it.text, t.textMax);
      });
      break;
    }
    case 'karsilastir': {
      const t = VISUAL_TEMPLATES.karsilastir;
      if (v.sides.length !== 2) out.push(`${where}: karşılaştırmada tam 2 taraf olmalı`);
      v.sides.forEach((s) => {
        checkLen(out, where, 'taraf başlığı', s.title, t.titleMax);
        checkRange(out, where, `"${s.title}" maddesi`, s.points.length, t.points);
        s.points.forEach((p) => checkLen(out, where, 'madde', p, t.pointMax));
      });
      checkRange(out, where, 'ortak madde', v.common?.length ?? 0, t.common);
      v.common?.forEach((p) => checkLen(out, where, 'ortak madde', p, t.pointMax));
      break;
    }
    case 'cubuk':
      checkRange(out, where, 'çubuk', v.bars.length, VISUAL_TEMPLATES.cubuk.bars);
      v.bars.forEach((b) => {
        checkLen(out, where, 'çubuk etiketi', b.label, VISUAL_TEMPLATES.cubuk.labelMax);
        if (!Number.isFinite(b.value) || b.value < 0) out.push(`${where}: "${b.label}" değeri geçersiz (0 ya da pozitif sayı olmalı)`);
      });
      if (v.bars.every((b) => b.value === 0)) out.push(`${where}: çubukların hepsi 0`);
      break;
    case 'svg':
    case 'resim':
      break;
  }
}

// knownTerms: tanımı olan kavram kimlikleri (anahtar kavramlar + dersin terms'i); verilmezse bağ kontrolü atlanır.
function validateStep(out: string[], where: string, step: LessonStep, lessonTerms: Record<string, LessonTerm>, knownTerms?: Set<string>) {
  switch (step.kind) {
    case 'anlatim': {
      const t = STEP_TEMPLATES.anlatim;
      checkLen(out, where, 'başlık', step.title, t.titleMax);
      if (step.body && words(step.body) > t.bodyWordsMax) out.push(`${where}: metin ${words(step.body)} kelime (en çok ${t.bodyWordsMax}) — ikinci ekrana böl`);
      if (step.predict) checkRange(out, where, 'tahmin seçeneği', step.predict.options.length, t.predictOptions);
      if (step.body && knownTerms) {
        for (const id of termLinks(out, where, step.body)) if (!knownTerms.has(id)) out.push(`${where}: "${id}" kavramının tanımı yok (anahtar kavramlara ya da dersin terms'ine ekle)`);
      }
      if (step.misconception) {
        checkLen(out, where, 'yanılgı', step.misconception.wrong, t.misconceptionCharsMax);
        checkLen(out, where, 'yanılgının doğrusu', step.misconception.right, t.misconceptionCharsMax);
      }
      if (step.visual) validateVisual(out, where, step.visual);
      else out.push(`${where}: görsel yok — her anlatım ekranında kavramı taşıyan bir görsel olmalı`);
      break;
    }
    case 'kesif': {
      const t = STEP_TEMPLATES.kesif;
      checkRange(out, where, 'keşif öğesi', step.items.length, t.items);
      step.items.forEach((it) => {
        // Keşif kartı kavram kaydından okunur: kavram dersin terms'inde resim/ikon + özelliklerle tanımlı olmalı.
        const c = lessonTerms[it.term];
        if (!c) {
          out.push(`${where}: "${it.term}" kavramı dersin terms'inde yok`);
        } else {
          checkRange(out, where, `"${c.title}" özelliği`, c.facts?.length ?? 0, t.factsPerItem);
          checkLen(out, where, `"${c.title}" öne çıkan bilgisi`, c.description, t.noteMax);
          if (!c.image && !c.iconName && !c.icon) out.push(`${where}: "${c.title}" kavramının resmi ya da ikonu yok`);
        }
        if (!svgHasTerm(step.map.svg, it.term)) out.push(`${where}: haritada "${it.term}" bölgesi (data-term) yok`);
      });
      break;
    }
    case 'etiketle':
      checkRange(out, where, 'etiket', step.labels.length, STEP_TEMPLATES.etiketle.labels);
      step.labels.forEach((l) => {
        if (!step.map.svg.includes(`data-label="${l.term}"`) && !new RegExp(`data-label="([^"]* )?${l.term}( [^"]*)?"`).test(step.map.svg)) {
          out.push(`${where}: haritada "${l.term}" yazısı (data-label) yok`);
        }
      });
      break;
    case 'bul':
      checkRange(out, where, 'bul sorusu', step.questions.length, STEP_TEMPLATES.bul.questions);
      step.zones.forEach((z) => { if (!svgHasTerm(step.map.svg, z.term)) out.push(`${where}: haritada "${z.term}" bölgesi yok`); });
      step.questions.forEach((q) => { if (!step.zones.some((z) => z.term === q.term)) out.push(`${where}: "${q.prompt}" cevabı bölgelerde yok`); });
      break;
    case 'eslestirme': {
      const t = STEP_TEMPLATES.eslestirme;
      const grouping = step.items.length > step.targets.length;
      checkRange(out, where, grouping ? 'gruplanacak öğe' : 'eşleştirme satırı', step.items.length, grouping ? t.groupItems : t.items);
      checkRange(out, where, grouping ? 'grup' : 'hedef', step.targets.length, grouping ? t.groupTargets : t.targets);
      step.items.forEach((it) => checkLen(out, where, 'öğe', it.text, t.itemCharsMax));
      step.targets.forEach((tg) => checkLen(out, where, 'hedef', tg, t.itemCharsMax));
      if (step.items.some((it) => it.target < 0 || it.target >= step.targets.length)) out.push(`${where}: geçersiz hedef indeksi`);
      if (step.visual) validateVisual(out, where, step.visual);
      break;
    }
    case 'dogru_yanlis':
      checkRange(out, where, 'ifade', step.statements.length, STEP_TEMPLATES.dogru_yanlis.statements);
      step.statements.forEach((st) => checkLen(out, where, 'ifade', st.text, STEP_TEMPLATES.dogru_yanlis.statementCharsMax));
      if (step.statements.every((st) => st.correct) || step.statements.every((st) => !st.correct)) out.push(`${where}: ifadelerin hepsi aynı (D ya da Y)`);
      break;
    case 'bosluk': {
      const t = STEP_TEMPLATES.bosluk;
      const slots = [...step.text.matchAll(/\{(\d+)\}/g)].length;
      checkRange(out, where, 'boşluk', slots, t.blanks);
      if (slots !== step.answers.length) out.push(`${where}: boşluk sayısı (${slots}) cevap sayısıyla (${step.answers.length}) uyuşmuyor`);
      checkRange(out, where, 'çeldirici', step.distractors.length, t.distractors);
      checkLen(out, where, 'metin', step.text, t.textCharsMax);
      if (step.visual) validateVisual(out, where, step.visual);
      break;
    }
    case 'siralama':
      checkRange(out, where, 'sıralanacak öğe', step.items.length, STEP_TEMPLATES.siralama.items);
      if (step.visual) validateVisual(out, where, step.visual);
      break;
    case 'coklu_secim': {
      const t = STEP_TEMPLATES.coklu_secim;
      const correct = step.options.filter((o) => o.correct).length;
      checkRange(out, where, 'seçenek', step.options.length, t.options);
      checkRange(out, where, 'doğru seçenek', correct, t.correct);
      if (step.options.length - correct < 2) out.push(`${where}: en az 2 yanlış seçenek olmalı`);
      if (step.visual) validateVisual(out, where, step.visual);
      break;
    }
    case 'klasik':
      if ('prompt' in step) checkLen(out, where, 'soru', step.prompt, STEP_TEMPLATES.klasik.promptCharsMax);
      break;
    case 'soru':
      break;
  }
}

// Boş dizi = ders bütün şablon sınırlarına uyuyor.
// highlightTerms: konunun anahtar kavramlarının kimlikleri (termSlug(başlık)); verilirse kavram bağları da denetlenir.
export function validateLesson(lesson: LessonDefinition, highlightTerms?: Iterable<string>): string[] {
  const out: string[] = [];
  const knownTerms = highlightTerms ? new Set([...highlightTerms, ...Object.keys(lesson.terms ?? {})]) : undefined;
  lesson.blocks.forEach((block, bi) => {
    const count = (kinds: LessonStep['kind'][]) => block.steps.filter((s) => kinds.includes(s.kind)).length;
    const where = `Bölüm ${bi + 1}`;
    checkRange(out, where, 'anlatım ekranı', count(['anlatim', 'kesif']), BLOCK_LIMITS.anlatim);
    checkRange(out, where, 'pekiştirme', count(['eslestirme', 'dogru_yanlis', 'bosluk', 'siralama', 'coklu_secim', 'etiketle', 'bul']), BLOCK_LIMITS.pekistirme);
    checkRange(out, where, 'test sorusu', count(['soru']), BLOCK_LIMITS.soru);
    checkRange(out, where, '"Konuyu anladık mı?"', count(['klasik']), BLOCK_LIMITS.klasik);
    block.steps.forEach((step, si) => validateStep(out, `${where}, adım ${si + 1} (${STEP_TEMPLATES[step.kind].name})`, step, lesson.terms ?? {}, knownTerms));
  });
  return out;
}
