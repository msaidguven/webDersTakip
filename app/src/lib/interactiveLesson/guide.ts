// Etkileşimli dersin anlatıcı robotu (2026-11-01): Bit dersi konuşma balonunda anlatır ve sesli okur.
// Sesler önceden üretilir (scripts/generate-lesson-voice.ts, Azure) ve içerik adresli saklanır: anahtar =
// konuşulan metnin özeti, aynı cümle (ör. "Harika!") bütün derslerde tek dosyadır. Oynatıcı ve üretim betiği
// cümleleri BURADAN kurar; bir cümle değişirse sesi yeniden üretilene kadar yalnız yazı görünür (ses sessizce
// atlanır). Robotun adı yalnız burada (kullanıcı: ad sonra değişecek — değişince sesler yeniden üretilir).
import { toSpeech } from '../narration/speech';
import { TERM_LINK, type HydratedLesson, type HydratedStep, type LessonVisual, type NarrativeStep } from './types';
import { isHydratedV2, type HydratedLessonV2 } from './typesV2';
import { isHydratedV3, type HydratedLessonV3, type V3BeatVisual, type V3TeachBeat } from './typesV3';

export const ROBOT_NAME = 'Atom';
export const VOICE_BUCKET = 'topic-narration';
export const voiceAudioPath = (key: string) => `interactive-voice/${key}.mp3`;
export const voiceManifestPath = (topicId: number) => `interactive-voice/topics/${topicId}.json`;

// Konuşulacak düz metin: kavram bağı → görünen metin, **kalın** / <b>kalın</b> / `kod` → düz, emoji yok.
export function speechText(text: string): string {
  return text
    .replace(new RegExp(TERM_LINK.source, 'g'), '$1')
    .replace(/<\/?b>/gi, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}★]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Seslendiriciye giden metin (ekran ve ses anahtarı speechText'te kalır):
// - speech.ts (toSpeech) ile semboller (&, →, |, =, +, *, üsler, birimler, formüller, binlik/ondalık sayılar,
//   büyük harfli kısaltmalar) Türkçe doğal okunuşa çevrilir.
// - Şapkalı harfler düz harfe çevrilir — Azure Türkçe sesi "mekâna", "Kâbe" gibi kelimeleri yanlış okuyor.
export function ttsText(text: string): string {
  const flat: Record<string, string> = { â: 'a', Â: 'A', î: 'i', Î: 'İ', û: 'u', Û: 'U', ķ: 'k' };
  return toSpeech(speechText(text)).replace(/[âÂîÎûÛķ]/g, (c) => flat[c]);
}

// Senkron, ortamdan bağımsız (tarayıcı + Node) 64 bit FNV-1a özeti; ses dosyasının adı. Seslendiriciye giden
// metinden alınır: okunuş kuralı değişince dosya yeni adres alır (eski ses tarayıcı önbelleğinden çalmaz).
export function voiceKey(text: string): string {
  const s = ttsText(text);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

// Bütün derslerde ortak cümleler. Öğrenme anı ilkesi: yanlışta kırmızı/puan yok, sarı "bir daha dene".
export const GUIDE = {
  // "Aynen öyle!" kullanıcı isteğiyle çıkarıldı (2026-11-02).
  praise: ['Harika!', 'Süpersin!', 'Tebrikler, doğru bildin!', 'Çok iyi gidiyorsun!', 'Mükemmel!'],
  retry: 'Yeşil olanlar doğru, onları kilitledim. Çarpı olanları değiştirip yeniden dene.',
  missing: 'Seçtiklerin doğru ama eksik var. Bir tane daha bul!',
  hint: 'İpucu:',
  tryAgain: 'Bir daha bakalım!',
  findHint: 'İpucu: parlayan yere dokun.',
  tfMixed: 'Her ifadenin altındaki açıklamayı oku, doğrusu orada.',
  exploreDone: 'Hepsini keşfettin!',
  exploreDefault: 'Haritada bir yere dokun, yakından tanı.',
  klasikAsk: 'Cevabını kendi cümlelerinle yaz, sonra örnek cevapla karşılaştır.',
  klasikReveal: 'Şimdi cevabını örnek cevapla karşılaştır. Uyuşuyor mu?',
  blockRetry: 'Yanlış yaptığın sorulara benzer sorular hazırladım. İstersen dene.',
  finish: 'Tebrikler, konuyu tamamladın! Seninle çalışmak çok güzeldi.',
  // Test sorusunda yanlış cevap: Bit doğru cevabı söyler, sonra çözümü okur (kullanıcı isteği).
  answerIs: (answer: string) => `Doğru cevap: ${answer}.`,
  predictOk: (answer: string) => `Süper tahmin! Doğrusu: ${answer}.`,
  predictInfo: (answer: string) => `Güzel deneme! Doğrusu: ${answer}.`,
  findWrong: (name: string) => `Bu ${name}.`,
  blockEnd: (n: number) => `${n}. bölüm bitti! Harika gidiyorsun.`,
  nextBlock: (title: string) => `Sıradaki bölüm: ${title}.`,
  intro: (topic: string) => `Merhaba! Ben ${ROBOT_NAME}. Bugün ${topic} konusunu birlikte keşfedeceğiz. Hazırsan başlayalım!`,
  explore: (title: string, description: string) => `${title}! ${description}`,
  lookVisual: 'Şimdi görsele bakalım.',
  misIntro: 'Dikkat! Sık yapılan bir yanılgı var.',
  misWrong: (wrong: string) => `Şöyle düşünmek yanlış: ${wrong}`,
  misRight: (right: string) => `Doğrusu şu: ${right}`,
  // v3 ortak geri bildirim cümleleri (içerik adresli: tüm derslerde tek kez üretilir).
  v3PoolWrong: 'Bu seçenek değil, bir kez daha dikkatlice bakıp başka seçeneğe dokun!',
  v3PoolOkFallback: 'Doğru bildin! Tebrikler!',
  v3SectionDone: 'Harika iş çıkardın! Sıradaki bölüme geçebilir veya Keşif Haritasına dönebilirsin.',
  v3KavramWrong: 'Olmadı! Harflerin üzerinden tekrar kaydır veya İpucu düğmesini kullan.',
  v3KavramNextWord: 'İlk kelime tamam! Şimdi sıradaki kelimeyi çemberden birleştir.',
  v3LabDone: 'Harika! Kendin deneyip keşfettin.',
  v3LabHint: 'Yukarıdaki çiplere dokunup dene.',
};

export const praiseAt = (seed: number) => GUIDE.praise[Math.abs(seed) % GUIDE.praise.length];

// Adımın açılış cümlesi: anlatım metni, yönerge, görselde bulda ilk soru, test/klasik soruda sorunun kendisi
// (kullanıcı: "Soru zamanı" yerine soruyu okusun).
export function stepIntro(step: HydratedStep): string {
  switch (step.kind) {
    case 'anlatim':
      return step.body ?? step.title;
    case 'kesif':
      return step.intro ?? GUIDE.exploreDefault;
    case 'bul':
      return step.questions[0]?.prompt ?? step.prompt;
    case 'soru':
    case 'klasik':
      return step.question.question_text;
    default:
      return step.prompt;
  }
}

// Anlatım üç ayrı ekranda gösterilir (kullanıcı kararı 2026-11-02: "hepsini bir ekrana sıkıştırmayalım"):
// text = Bit'in metni (+ varsa tahmin sorusu), visual = görsel tam genişlik, mis = sık yapılan yanılgı.
// Olmayan kısım atlanır.
export type NarrativePart = 'text' | 'visual' | 'mis';
export function narrativeParts(step: NarrativeStep): NarrativePart[] {
  const parts: NarrativePart[] = [];
  if (step.body || step.predict || !step.visual) parts.push('text');
  if (step.visual) parts.push('visual');
  if (step.misconception) parts.push('mis');
  return parts;
}

// Görsel ekranında Bit'in okuduğu: kartlar tek tek, akış/ağaç/parçalar tek cümlede; tablo ve çizim okunmaz.
export function visualSpeech(v: LessonVisual | undefined): string[] {
  switch (v?.kind) {
    case 'kartlar':
      return v.cards.map((c) => (c.text ? `${c.title}. ${c.text}` : `${c.title}.`));
    case 'akis':
      return [`Adım adım: ${v.steps.map((st) => st.label).join(', ')}.`];
    case 'agac':
      return [`${v.root.label}: ${v.children.map((c) => c.label + (c.items?.length ? ` (${c.items.join(', ')})` : '')).join('; ')}.`];
    case 'parcala':
      return v.parts.map((p) => `${p.text}: ${p.label}${p.note ? `, ${p.note}` : ''}.`);
    case 'denklem':
      return [`${v.inputs.map((it) => it.label).join(' artı ')}, eşittir ${v.result.label}.`, ...[...v.inputs, v.result].filter((it) => it.text).map((it) => `${it.label}: ${it.text}`)];
    case 'dongu':
      return [`${v.steps.map((st) => st.label).join(', ')}. Sonra yeniden ${v.steps[0]?.label ?? ''}.`];
    case 'merkez':
      return [`${v.center.label}.`, ...v.parts.map((p) => (p.text ? `${p.label}. ${p.text}` : `${p.label}.`))];
    case 'karsilastir':
      return [...v.sides.map((s) => `${s.title}: ${s.points.join(', ')}.`), ...(v.common?.length ? [`İkisinde de: ${v.common.join(', ')}.`] : [])];
    case 'cubuk':
      return [`${v.bars.map((b) => `${b.label}: ${b.display ?? b.value.toLocaleString('tr-TR')}`).join('; ')}.`];
    default:
      return [];
  }
}

// Bir anlatım ekranının açılış konuşması.
export function narrativeSpeech(step: NarrativeStep, part: NarrativePart): string[] {
  if (part === 'visual') return [GUIDE.lookVisual, ...visualSpeech(step.visual)];
  if (part === 'mis' && step.misconception) return [GUIDE.misIntro, GUIDE.misWrong(step.misconception.wrong), GUIDE.misRight(step.misconception.right)];
  return [step.body ?? step.title];
}

function endSentence(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return /[.!?:…]$/.test(t) ? t : `${t}.`;
}

const STEP_NUMBERS = ['Bir', 'İki', 'Üç', 'Dört', 'Beş'];
// Gerçek sıra sayısı tamlaması ("1. Kelime", "2. Bölüm", "1. Derece") dışındaki gereksiz madde öneklerini temizler.
const ORDINAL_NOUN_RE = /^(?:kelime|bölüm|aşama|adım|sınıf|sıra|derece|gün|yıl|yüzyıl|kat|tur|kısım|madde)\b/i;
function stripStepListPrefix(text: string): string {
  const noBullet = text.replace(/^[-•*]\s+/, '').trim();
  const m = noBullet.match(/^\d+[.)]\s+(.*)$/);
  if (m && !ORDINAL_NOUN_RE.test(m[1])) return m[1].trim();
  return noBullet;
}

const MATH_EXPR_RE = /^[\d\s.,+\-*/^=()xXyYzZaAbBcCnN°%²³⁴⁵⁶⁷⁸⁹]+$/;
function isPureMathTerm(s: string): boolean {
  const t = s.trim();
  return Boolean(t) && t.length <= 18 && /\d/.test(t) && MATH_EXPR_RE.test(t);
}

function joinNaturalTr(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ile ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`;
}

// v3 anlatım ekranındaki yapısal görselin (başlıklar, maddeler, karşılaştırma, adımlar, kartlar, denklem)
// doğal konuşma metni (beat.narration yoksa güvenli yedek olarak kullanılır).
export function v3VisualSpeech(
  visual?: V3BeatVisual,
  beatTitle?: string,
  opts?: { numberHighlight?: boolean; legacyEquation?: boolean },
): string {
  if (!visual) return '';
  const norm = (s: string) => s.trim().toLocaleLowerCase('tr-TR');
  const titleNorm = beatTitle ? norm(beatTitle) : '';
  const numberHighlight = opts?.numberHighlight ?? true;
  const legacyEquation = opts?.legacyEquation ?? false;

  switch (visual.kind) {
    case 'highlight': {
      const parts: string[] = [];
      if (visual.headline.trim() && norm(visual.headline) !== titleNorm) {
        parts.push(endSentence(visual.headline));
      }
      const cleanBullets = visual.bullets
        .map((b) => stripStepListPrefix(b.trim()))
        .filter(Boolean);
      const useNumbers = numberHighlight && cleanBullets.length >= 2;
      cleanBullets.forEach((b, i) => {
        if (useNumbers) {
          const num = STEP_NUMBERS[i] ?? String(i + 1);
          parts.push(endSentence(`${num}: ${b}`));
        } else {
          parts.push(endSentence(b));
        }
      });
      return parts.join(' ');
    }
    case 'compare': {
      const sideText = (side: { title: string; points: string[] }) => {
        const pts = side.points.map((p) => p.trim()).filter(Boolean).join(', ');
        if (side.title.trim() && pts) return endSentence(`${side.title.trim().replace(/:+$/, '')}: ${pts}`);
        return endSentence(side.title || pts);
      };
      return [sideText(visual.left), sideText(visual.right)].filter(Boolean).join(' ');
    }
    case 'steps':
      // "1." noktalı yazılınca Azure Türkçe TTS "birinci, ikinci, üçüncü" okuyor — yazıyla "Bir:", "İki:", "Üç:" verilir.
      return visual.items
        .map((it, i) => {
          const clean = stripStepListPrefix(it.trim());
          if (!clean) return '';
          const num = STEP_NUMBERS[i] ?? String(i + 1);
          return endSentence(`${num}: ${clean}`);
        })
        .filter(Boolean)
        .join(' ');
    case 'cards':
      return visual.items
        .map((c) => {
          const t = c.title.trim().replace(/:+$/, '');
          const d = c.detail.trim();
          if (t && d) return endSentence(`${t}: ${d}`);
          return endSentence(t || d);
        })
        .filter(Boolean)
        .join(' ');
    case 'equation': {
      const inputs = visual.inputs.map((inp) => inp.trim()).filter(Boolean);
      const res = visual.result.trim();
      if (legacyEquation) {
        const left = inputs.join(' artı ');
        if (left && res) return endSentence(`${left}, eşittir ${res}`);
        return endSentence(left || res);
      }
      if (!inputs.length) return endSentence(res);
      if (!res) return endSentence(joinNaturalTr(inputs));
      const allMath = inputs.every(isPureMathTerm) && isPureMathTerm(res);
      if (allMath) {
        return endSentence(`${joinNaturalTr(inputs)} toplandığında ${res} elde edilir`);
      }
      return endSentence(`${joinNaturalTr(inputs)} birleşerek ${res} sonucunu ortaya çıkarır`);
    }
    case 'filter_sandbox':
    case 'token_builder':
    case 'classify_tap':
    case 'spot_highlight':
    case 'step_reveal': {
      const task = visual.task.trim();
      if (!task || norm(task) === titleNorm) return '';
      return endSentence(task);
    }
    case 'cause_effect_dial': {
      const label = visual.controlLabel.trim();
      if (!label) return '';
      return endSentence(`${label} kademelerini değiştirip farkı incele`);
    }
    default:
      return '';
  }
}

// Eski sesler için geriye dönük yedek (sadece başlık + alt metin).
export function v3BeatTitleFactSpeech(beat: Pick<V3TeachBeat, 'title' | 'fact'>): string {
  const title = beat.title.trim();
  const fact = beat.fact.trim();
  if (!title) return fact;
  if (!fact) return title;
  if (fact.toLocaleLowerCase('tr-TR').startsWith(title.toLocaleLowerCase('tr-TR'))) return fact;
  const sep = /[.!?:…]$/.test(title) ? ' ' : '. ';
  return `${title}${sep}${fact}`;
}

// v3 anlatım ekranında Atom'un okuyacağı metin:
// 1) Ekrandan ayrı yazılmış öğretmen anlatımı (`beat.narration`) varsa doğrudan onu okur (en doğal, sembolsüz).
// 2) Yoksa güvenli yedek olarak başlık + görsel şema + alt metin birleştirilir.
export function v3BeatSpeech(
  beat: Pick<V3TeachBeat, 'title' | 'fact' | 'visual' | 'narration'>,
  opts?: { numberHighlight?: boolean; legacyEquation?: boolean; ignoreNarration?: boolean },
): string {
  const narration = !opts?.ignoreNarration ? beat.narration?.trim() : '';
  if (narration) return narration;

  const title = beat.title.trim();
  const visualText = v3VisualSpeech(beat.visual, title, opts);
  const fact = beat.fact.trim();
  const parts: string[] = [];
  if (title && !fact.toLocaleLowerCase('tr-TR').startsWith(title.toLocaleLowerCase('tr-TR'))) {
    parts.push(endSentence(title));
  } else if (title && visualText) {
    parts.push(endSentence(title));
  }
  if (visualText) parts.push(visualText);
  if (fact) parts.push(fact);
  return parts.join(' ').trim();
}

// Eski sesler için geriye dönük yedek (highlight maddeleri numarasız ve eski "artı/eşittir" denklemle üretilen MP3'ler).
export function v3BeatSpeechLegacy(beat: Pick<V3TeachBeat, 'title' | 'fact' | 'visual' | 'narration'>): string {
  return v3BeatSpeech(beat, { numberHighlight: false, legacyEquation: true, ignoreNarration: true });
}

// Oynatıcının mevcut üretilmiş MP3'leri bozmadan sırayla kontrol edeceği ses metni adayları.
export function v3BeatVoiceCandidates(
  beat: Pick<V3TeachBeat, 'title' | 'fact' | 'visual' | 'narration'>,
): string[] {
  const candidates = [
    v3BeatSpeech(beat),
    v3BeatSpeech(beat, { ignoreNarration: true, numberHighlight: true, legacyEquation: false }),
    v3BeatSpeech(beat, { ignoreNarration: true, numberHighlight: true, legacyEquation: true }),
    v3BeatSpeechLegacy(beat),
    v3BeatTitleFactSpeech(beat),
    beat.fact.trim(),
  ].filter(Boolean);
  return [...new Set(candidates)];
}

// Dersin seslendirilecek bütün cümleleri (üretim betiği). v1, v2 ve v3 derslerini destekler.
export function lessonLines(lesson: HydratedLesson | HydratedLessonV2 | HydratedLessonV3): string[] {
  if (isHydratedV3(lesson)) {
    const out: string[] = [
      ...GUIDE.praise,
      GUIDE.v3PoolWrong,
      GUIDE.v3PoolOkFallback,
      GUIDE.v3SectionDone,
      GUIDE.v3KavramWrong,
      GUIDE.v3KavramNextWord,
      GUIDE.v3LabDone,
      lesson.guide?.intro ?? GUIDE.intro(lesson.topicTitle),
      lesson.guide?.finish ?? GUIDE.finish,
    ];
    for (const sec of lesson.sections) {
      for (const beat of sec.beats) {
        out.push(v3BeatSpeech(beat));
        if (beat.quickCheck) {
          out.push(beat.quickCheck.prompt, beat.quickCheck.okFeedback, beat.quickCheck.retryFeedback);
        }
      }
      if (sec.game.kind === 'kavram_avi') {
        out.push(sec.game.intro);
        for (const r of sec.game.rounds) {
          if (r.definition) out.push(r.definition);
          out.push(r.praise);
        }
      }
      for (const q of sec.checkQuestions) {
        out.push(q.question_text);
        if (q.solution_text) out.push(q.solution_text);
      }
    }
    return [...new Set(out.map(speechText).filter(Boolean))];
  }
  if (isHydratedV2(lesson)) {
    const out: string[] = [
      ...GUIDE.praise,
      lesson.guide?.intro ?? GUIDE.intro(lesson.topicTitle),
      lesson.guide?.finish ?? GUIDE.finish,
    ];
    for (const stop of lesson.stops) {
      out.push(`Harikasın! ${stop.part.name} kapsüle takıldı!`);
      for (const step of stop.steps) {
        if ('say' in step && step.say) out.push(step.say);
        if ('feedback' in step && step.feedback) out.push(step.feedback);
        if (step.kind === 'hat') for (const r of step.rounds) out.push(r.feedback);
        if (step.kind === 'scenario') {
          for (const r of step.rounds) {
            out.push(r.situation);
            for (const o of r.options) out.push(o.feedback);
          }
        }
        if (step.kind === 'vault_lock') {
          for (const d of step.dials) out.push(d.clue);
        }
        if (step.kind === 'pool_question') {
          out.push(step.question.question_text);
          if (step.question.solution_text) out.push(step.question.solution_text);
        }
      }
    }
    return [...new Set(out.map(speechText).filter(Boolean))];
  }
  const out: string[] = [
    ...GUIDE.praise,
    GUIDE.retry, GUIDE.missing, GUIDE.hint, GUIDE.tryAgain, GUIDE.findHint, GUIDE.tfMixed, GUIDE.exploreDone,
    GUIDE.klasikReveal, GUIDE.blockRetry,
    lesson.guide?.intro ?? GUIDE.intro(lesson.topicTitle),
    lesson.guide?.finish ?? GUIDE.finish,
  ];
  lesson.blocks.forEach((block, bi) => {
    out.push(GUIDE.blockEnd(bi + 1));
    if (lesson.blocks[bi + 1]) out.push(GUIDE.nextBlock(lesson.blocks[bi + 1].title));
    for (const step of block.steps) {
      out.push(stepIntro(step));
      if (step.kind === 'anlatim') for (const part of narrativeParts(step)) out.push(...narrativeSpeech(step, part));
      if ((step.kind === 'anlatim' || step.kind === 'kesif') && step.predict) {
        const ans = step.predict.options[step.predict.answer];
        out.push(step.predict.question, GUIDE.predictOk(ans), GUIDE.predictInfo(ans));
      }
      if (step.kind === 'kesif') {
        for (const it of step.items) {
          const t = lesson.terms[it.term];
          if (t) out.push(GUIDE.explore(t.title, t.description));
        }
      }
      if ('explanation' in step && step.explanation) out.push(step.explanation);
      if (step.kind === 'soru') {
        const opts = step.question.type === 'multiple_choice' ? step.question.choices : step.question.options;
        const right = opts.find((o) => o.is_correct);
        if (right) out.push(GUIDE.answerIs(right.text));
        if (step.question.solution_text) out.push(step.question.solution_text);
      }
      if (step.kind === 'bul') {
        for (const q of step.questions) out.push(q.prompt);
        for (const z of step.zones) out.push(GUIDE.findWrong(z.name));
      }
      if (step.kind === 'kasa_kilidi') {
        for (const d of step.dials) out.push(d.clue);
        if (step.hint) out.push(step.hint);
      }
      if (step.kind === 'hata_avcisi' || step.kind === 'kaydir_ayir') {
        out.push(step.hint);
      }
      if (step.kind === 'surgu') {
        out.push(step.left.text, step.right.text);
      }
    }
  });
  return [...new Set(out.map(speechText).filter(Boolean))];
}
