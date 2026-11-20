// Etkileşimli dersin anlatıcı robotu (2026-11-01): Bit dersi konuşma balonunda anlatır ve sesli okur.
// Sesler önceden üretilir (scripts/generate-lesson-voice.ts, Azure) ve içerik adresli saklanır: anahtar =
// konuşulan metnin özeti, aynı cümle (ör. "Harika!") bütün derslerde tek dosyadır. Oynatıcı ve üretim betiği
// cümleleri BURADAN kurar; bir cümle değişirse sesi yeniden üretilene kadar yalnız yazı görünür (ses sessizce
// atlanır). Robotun adı yalnız burada (kullanıcı: ad sonra değişecek — değişince sesler yeniden üretilir).
import { TERM_LINK, type HydratedLesson, type HydratedStep, type LessonVisual, type NarrativeStep } from './types';
import { isHydratedV2, type HydratedLessonV2 } from './typesV2';

export const ROBOT_NAME = 'Atom';
export const VOICE_BUCKET = 'topic-narration';
export const voiceAudioPath = (key: string) => `interactive-voice/${key}.mp3`;
export const voiceManifestPath = (topicId: number) => `interactive-voice/topics/${topicId}.json`;

// Konuşulacak düz metin: kavram bağı → görünen metin, **kalın** / <b>kalın</b> → düz, emoji yok.
export function speechText(text: string): string {
  return text
    .replace(new RegExp(TERM_LINK.source, 'g'), '$1')
    .replace(/<\/?b>/gi, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}★]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Seslendiriciye giden metin (ekran ve ses anahtarı speechText'te kalır): şapkalı harfler düz harfe çevrilir —
// Azure Türkçe sesi "mekâna", "Kâbe" gibi kelimeleri yanlış okuyor (kullanıcı bildirimi 2026-11-01).
export function ttsText(text: string): string {
  const flat: Record<string, string> = { â: 'a', Â: 'A', î: 'i', Î: 'İ', û: 'u', Û: 'U' };
  return speechText(text).replace(/[âÂîÎûÛ]/g, (c) => flat[c]);
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

// Dersin seslendirilecek bütün cümleleri (üretim betiği). Hem v1 hem v2 derslerini destekler.
export function lessonLines(lesson: HydratedLesson | HydratedLessonV2): string[] {
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
    }
  });
  return [...new Set(out.map(speechText).filter(Boolean))];
}
