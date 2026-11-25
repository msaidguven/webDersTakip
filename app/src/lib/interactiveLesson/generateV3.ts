import 'server-only';
import { generateGeminiJson } from '@/app/src/lib/geminiJsonGen';
import type { GeminiWorkerProfile } from '@/app/src/lib/geminiWorkerProfile';
import type { LessonSource } from './generate';
import { ROBOT_NAME } from './guide';
import type { LessonDefinitionV3, V3BeatVisual, V3Section, V3TeachBeat } from './typesV3';

// v3 Etkileşimli Ders AI Üreticisi (Atom Keşif Dünyası — Tek-Bilgi Anlatım + Çok Turlu Kavram Avı + Havuz Soruları).
// Herhangi bir ders/konu için Supabase'teki yayındaki kitap bölümlerini (topic_content_sections),
// anahtar kavramları (topic_content_highlights) ve aktif havuz sorularını (questions) kullanarak
// %100 kitaba sadık, sıfır uydurma bilgili LessonDefinitionV3 JSON'u üretir.

const ACCENTS: V3Section['accent'][] = ['sky', 'amber', 'emerald', 'rose'];

export function buildLessonV3Prompt(src: LessonSource, previousErrors?: string): string {
  const sectionsText = src.sections
    .map((sec, idx) =>
      [
        `### BÖLÜM ${idx + 1} (sectionId=${sec.id}): ${sec.heading}`,
        sec.body,
        'Kullanılabilecek aktif havuz soru kimlikleri (checkQuestionIds için YALNIZ bunlardan 2 adet seç):',
        ...sec.pool.map((q) => `- #${q.id}: ${q.text.replace(/\s+/g, ' ').slice(0, 220)} → doğru: ${q.answer}`),
      ].join('\n'),
    )
    .join('\n\n');

  const termsText =
    src.terms.map((t) => `- ${t.slug}: ${t.title} — ${t.description}`).join('\n') ||
    '(Anahtar kavram kaydı yok — kavram tanımlarını doğrudan kitap metninden kısa ve net yaz)';

  return `Sen ortaokul öğrencileri için "Atom Keşif Dünyası" v3 oyunlaştırılmış ETKİLEŞİMLİ DERS üreten uzman bir eğitim tasarımcısısın.
Konu: ${src.grade} ${src.lesson} · "${src.title}".
Maskotumuzun adı "${ROBOT_NAME}".

KAYNAK KİTAP METNİ (YALNIZ buradaki bilgileri kullan; kaynakta olmayan hiçbir bilgi/sayı/örnek uydurma, kaynakla çelişme):
${sectionsText}

ANAHTAR KAVRAMLAR (Kavram Avı oyun turlarında öncelikle bunları kullan):
${termsText}

PEDAGOJİK KURALLAR (ASLA İHLAL ETME):
1. HER EKRANDA YALNIZCA 1 ANA ODAK VE SIFIR PAPAĞAN TEKRARI (Mayer Çoklu Ortam İlkesi):
   - Her bölüm için 3 ila 5 adet tek-bilgi ekranı ("beats") yaz.
   - Her "fact" alanı o adımın temel tanımını veya ilkesini veren 1-2 kısa, sade, ${src.grade} düzeyinde Türkçe cümle olsun (en fazla 28 kelime).
   - ÇOK ÖNEMLİ: "visual" alanı ASLA "fact" cümlesini kelimesi kelimesine tekrar etmemeli veya aynı tanım cümlesini 1-2-3 diye kutulara bölüp papağan gibi yeniden yazmamalıdır! "fact" tanımı/ilkeyi söylerken "visual" bunu somut bir günlük hayat/ders örneğiyle, alt türleriyle, karşılaştırmayla veya gerçek süreç aşamalarıyla tamamlamalıdır.
   - Kitap bölümündeki tüm kritik kazanımlar (tanımlar, farklar, örnekler, dikkat edilecek noktalar) tek tek ayrı ekranlara bölünsün; hiçbir önemli bilgi atlanmasın.
2. GEÇİŞ SORULARI (quickCheck):
   - Her bölümde en az 1, en fazla 2 anlatım adımına "quickCheck" (2 seçenekli, anında kontrollü hızlı soru) ekle.
   - "okFeedback" ve "retryFeedback" 1 kısa, motive edici ve öğretici cümle olsun.
3. GÖRSEL ŞEMA (visual — HER anlatım adımında ZORUNLU):
   Bilginin yapısına en uygun görseli seç ve bölüm içinde çeşitlendir:
   - {"kind":"highlight","badge":"kısa etiket","headline":"ana fikir","bullets":["madde 1","madde 2"]} (2-4 kısa madde)
   - {"kind":"compare","left":{"title":"Taraf A","points":["...","..."]},"right":{"title":"Taraf B","points":["...","..."]}} (iki kavramı karşılaştırma)
   - {"kind":"steps","items":["Adım 1","Adım 2","Adım 3"]} (2-5 sıralı aşama / neden-sonuç)
   - {"kind":"cards","items":[{"title":"Başlık","detail":"Kısa açıklama"}]} (2-4 tür / örnek kartı)
   - {"kind":"equation","inputs":["Girdi 1","Girdi 2"],"result":"Sonuç"} (iki-üç şeyin birleşimi)
4. BÖLÜM İÇİ OYUN — ÇOK TURLU KAVRAM AVI ("game"):
   - Her bölümün sonunda 3 kavramlık bir "kavram_avi" oturumu yaz.
   - "word": BÜYÜK HARFLE, 1 veya en fazla 2 kelimelik gerçek konu kavramı (ör. "GENLEŞME", "ISI ALIŞVERİŞİ").
   - "definition": Öğrencinin okuyup kavramı bulacağı net, 1 cümlelik tanım (kavramın kendisini tanım içinde geçirme!).
   - "praise": Kavram bulununca çıkacak 1 cümlelik pekiştirici tebrik.
5. BÖLÜM SONU KONTROLÜ ("checkQuestionIds"):
   - O bölümün havuz listesinden tam 2 adet geçerli soru ID'si seç (her soru en fazla 1 kez kullanılsın).
6. SESLİ OKUMA (TTS) VE YAZIM KURALLARI:
   - Tüm başlıklar, görsel maddeleri, "fact", "quickCheck" ve oyun metinleri sesli okunacaktır.
   - "steps.items", "highlight.bullets" ve "compare.points" öğelerinin başına ASLA madde numarası ("1.", "2.", "Adım 1:") veya madde işareti ("-", "•") koyma — oynatıcı numaraları ve madde işaretlerini otomatik ekler.
   - "&" yerine "ve", "|" yerine virgül, "→" yerine akıcı Türkçe ifade kullan; markdown backtick (\`) kullanma.
   - Parantez içinde gereksiz sembol tekrarı ("(=)", "(+)", "(*)", "(/)", "(:)") yapma; kart/karşılaştırma başlıklarının sonuna gereksiz ":" koyma.
   - Birim ve kısaltmaları mümkün olduğunca açık Türkçe yaz ("Hz." yerine "Hazreti", "sn" yerine "saniye", "vb." yerine "ve benzeri", "m/s" yanında tekrar etmeden sade kullanım).

ÇIKTI: YALNIZCA geçerli JSON döndür (markdown kod bloğu veya açıklama yazma):
{
  "guide": {
    "intro": "Merhaba! Ben ${ROBOT_NAME}. ... (1-2 cümle)",
    "finish": "Tebrikler! ... (1-2 cümle)"
  },
  "sections": [
    {
      "sectionId": 1234,
      "tabLabel": "1. Kısa Bölüm Adı",
      "title": "Tam Bölüm Başlığı",
      "beats": [
        {
          "id": "s1-b1",
          "kicker": "Kısa Kategori",
          "title": "Kısa Başlık (≤5 kelime)",
          "fact": "Tek net bilgi (1-2 kısa cümle).",
          "visual": { "kind": "highlight", "badge": "...", "headline": "...", "bullets": ["...", "..."] },
          "quickCheck": {
            "prompt": "Kısa soru?",
            "options": ["Doğru/Seçenek 1", "Seçenek 2"],
            "answer": 0,
            "okFeedback": "Harika! ...",
            "retryFeedback": "Tekrar düşün: ..."
          }
        }
      ],
      "game": {
        "kind": "kavram_avi",
        "title": "Bölüm 1 — Kavram Avı",
        "intro": "1. bölümü bitirdin! 3 kavramı harf çemberinden yakala.",
        "rounds": [
          { "word": "KAVRAM", "definition": "Kavramın tanımı.", "praise": "Harika! ..." }
        ]
      },
      "checkQuestionIds": [1001, 1002]
    }
  ]
}
${previousErrors ? `\nÖNCEKİ DENEMEDE ŞU HATALAR ÇIKTI, HEPSİNİ DÜZELT:\n${previousErrors}\n` : ''}`;
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

const ORDINAL_NOUN_RE = /^(?:kelime|bölüm|aşama|adım|sınıf|sıra|derece|gün|yıl|yüzyıl|kat|tur|kısım|madde)\b/i;
function cleanListItem(v: unknown, stripNumber = false): string {
  const s = str(v).replace(/^[-•*]\s+/, '').trim();
  if (!stripNumber) return s;
  const m = s.match(/^\d+[.)]\s+(.*)$/);
  return m && !ORDINAL_NOUN_RE.test(m[1]) ? m[1].trim() : s;
}

function parseVisual(v: unknown): V3BeatVisual | undefined {
  if (!isObj(v)) return undefined;
  switch (v.kind) {
    case 'highlight': {
      const bullets = arr(v.bullets).map((b) => cleanListItem(b, false)).filter(Boolean).slice(0, 4);
      if (!str(v.headline) || !bullets.length) return undefined;
      return { kind: 'highlight', badge: str(v.badge) || 'Ana Fikir', headline: str(v.headline), bullets };
    }
    case 'compare': {
      if (!isObj(v.left) || !isObj(v.right)) return undefined;
      const lp = arr(v.left.points).map((p) => cleanListItem(p, false)).filter(Boolean).slice(0, 4);
      const rp = arr(v.right.points).map((p) => cleanListItem(p, false)).filter(Boolean).slice(0, 4);
      if (!str(v.left.title) || !str(v.right.title) || !lp.length || !rp.length) return undefined;
      return {
        kind: 'compare',
        left: { title: str(v.left.title), points: lp },
        right: { title: str(v.right.title), points: rp },
      };
    }
    case 'steps': {
      const items = arr(v.items).map((it) => cleanListItem(it, true)).filter(Boolean).slice(0, 5);
      return items.length >= 2 ? { kind: 'steps', items } : undefined;
    }
    case 'cards': {
      const items = arr(v.items)
        .filter(isObj)
        .map((c) => ({ title: str(c.title), detail: str(c.detail) }))
        .filter((c) => c.title && c.detail)
        .slice(0, 4);
      return items.length >= 2 ? { kind: 'cards', items } : undefined;
    }
    case 'equation': {
      const inputs = arr(v.inputs).map(str).filter(Boolean).slice(0, 3);
      return inputs.length >= 2 && str(v.result) ? { kind: 'equation', inputs, result: str(v.result) } : undefined;
    }
    default:
      return undefined;
  }
}

export function parseGeneratedLessonV3(
  data: unknown,
  src: LessonSource,
): { lesson: LessonDefinitionV3; errors: string[] } {
  const errors: string[] = [];
  const root = isObj(data) ? data : {};
  const guide =
    isObj(root.guide) && str(root.guide.intro) && str(root.guide.finish)
      ? { intro: str(root.guide.intro), finish: str(root.guide.finish) }
      : {
          intro: `Merhaba! Ben ${ROBOT_NAME}. Bugün ${src.title} konusunu birlikte keşfedeceğiz.`,
          finish: `Tebrikler! ${src.title} konusunun tüm bölümlerini başarıyla tamamladın!`,
        };

  const bySection = new Map(src.sections.map((sec) => [sec.id, sec]));
  const usedQ = new Set<number>();

  const sections: V3Section[] = arr(root.sections)
    .filter(isObj)
    .flatMap((rawSec, sIdx): V3Section[] => {
      const srcSec = bySection.get(Number(rawSec.sectionId));
      if (!srcSec) {
        errors.push(`Bölüm ${sIdx + 1}: geçersiz sectionId (${String(rawSec.sectionId)})`);
        return [];
      }

      const beats: V3TeachBeat[] = arr(rawSec.beats)
        .filter(isObj)
        .flatMap((b, bIdx): V3TeachBeat[] => {
          const title = str(b.title);
          const fact = str(b.fact);
          if (!title || !fact) {
            errors.push(`Bölüm ${sIdx + 1}, adım ${bIdx + 1}: title veya fact eksik`);
            return [];
          }
          const qcRaw = isObj(b.quickCheck) ? b.quickCheck : null;
          const options = qcRaw ? arr(qcRaw.options).map(str).filter(Boolean) : [];
          const ans = qcRaw ? Number(qcRaw.answer) : -1;
          const quickCheck =
            qcRaw && str(qcRaw.prompt) && options.length >= 2 && Number.isInteger(ans) && ans >= 0 && ans < options.length
              ? {
                  prompt: str(qcRaw.prompt),
                  options: options.slice(0, 2),
                  answer: ans,
                  okFeedback: str(qcRaw.okFeedback) || 'Harika! Doğru bildin.',
                  retryFeedback: str(qcRaw.retryFeedback) || 'Bir kez daha dikkatlice düşün!',
                }
              : undefined;

          return [
            {
              id: str(b.id) || `s${sIdx + 1}-b${bIdx + 1}`,
              kicker: str(b.kicker) || `${bIdx + 1}. Bilgi`,
              title,
              fact,
              visual: parseVisual(b.visual),
              quickCheck,
            },
          ];
        });

      if (beats.length < 2) errors.push(`Bölüm ${sIdx + 1}: en az 2 tek-bilgi adımı olmalı`);

      const gameRaw = isObj(rawSec.game) ? rawSec.game : {};
      const rounds = arr(gameRaw.rounds)
        .filter(isObj)
        .map((r) => ({
          word: str(r.word).toLocaleUpperCase('tr-TR'),
          definition: str(r.definition),
          praise: str(r.praise) || 'Harika! Kavramı doğru buldun.',
        }))
        .filter((r) => r.word.length >= 3 && r.definition.length >= 8)
        .slice(0, 4);

      if (rounds.length < 2) errors.push(`Bölüm ${sIdx + 1}: Kavram Avı için en az 2 geçerli kavram olmalı`);

      const validPoolIds = new Set(srcSec.pool.map((q) => q.id));
      let checkQuestionIds = arr(rawSec.checkQuestionIds)
        .map(Number)
        .filter((id) => validPoolIds.has(id) && !usedQ.has(id))
        .slice(0, 2);

      // AI eksik soru seçtiyse havuzdan tamamla
      if (checkQuestionIds.length < 2) {
        for (const q of srcSec.pool) {
          if (checkQuestionIds.length >= 2) break;
          if (!usedQ.has(q.id) && !checkQuestionIds.includes(q.id)) checkQuestionIds.push(q.id);
        }
      }
      checkQuestionIds = checkQuestionIds.slice(0, 2);
      checkQuestionIds.forEach((id) => usedQ.add(id));

      return [
        {
          sectionId: srcSec.id,
          tabLabel: str(rawSec.tabLabel) || `${sIdx + 1}. ${srcSec.heading.slice(0, 24)}`,
          title: str(rawSec.title) || srcSec.heading,
          accent: ACCENTS[sIdx % ACCENTS.length],
          beats,
          game: {
            kind: 'kavram_avi',
            title: str(gameRaw.title) || `Bölüm ${sIdx + 1} — Kavram Avı`,
            intro: str(gameRaw.intro) || 'Bölümü pekiştirmek için kavramları harf çemberinden bul!',
            rounds,
          },
          checkQuestionIds,
        },
      ];
    });

  const missing = src.sections.filter((sec) => !sections.some((s) => s.sectionId === sec.id));
  if (missing.length) errors.push(`Eksik bölüm(ler): ${missing.map((m) => m.id).join(', ')}`);

  return {
    lesson: {
      version: 3,
      topicId: src.topicId,
      courseLabel: `${src.grade} ${src.lesson}`,
      sceneId: 'generic',
      guide,
      sections,
    },
    errors,
  };
}

export async function produceLessonV3(
  src: LessonSource,
  profile: GeminiWorkerProfile,
): Promise<{ lesson: LessonDefinitionV3; errors: string[]; model: string; calls: number }> {
  let errorsText: string | undefined;
  for (let calls = 1; calls <= 2; calls++) {
    const out = await generateGeminiJson(buildLessonV3Prompt(src, errorsText), profile);
    const { lesson, errors } = parseGeneratedLessonV3(out.data, src);
    if (!errors.length || calls >= 2) {
      return { lesson, errors, model: out.model, calls };
    }
    errorsText = errors.slice(0, 20).join('\n');
  }
  throw new Error('v3 ders üretimi beklenmedik şekilde sonlandı');
}
