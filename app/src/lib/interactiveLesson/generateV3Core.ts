import type { LessonSource } from './generate';
import { ROBOT_NAME } from './guide';
import {
  isInteractiveBeatVisual,
  type LessonDefinitionV3,
  type V3BeatVisual,
  type V3CauseEffectDialState,
  type V3ClassifyTapCard,
  type V3FilterSandboxFilter,
  type V3FilterSandboxItem,
  type V3Section,
  type V3SpotHighlightSegment,
  type V3StepRevealNext,
  type V3TeachBeat,
} from './typesV3';

// v3 Etkileşimli Ders AI Promptu ve Deterministik Doğrulayıcısı (server-only bağımsız çekirdek).
// Hem sunucu worker'ı (generateV3.ts) hem de CLI test betiği (scripts/generate-v3-topic.ts)
// tek kaynak olarak bu modülü kullanır.

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
   - ÇOK ÖNEMLİ: "visual" alanı ASLA "fact" cümlesini kelimesi kelimesine tekrar etmemeli veya aynı tanım cümlesini 1-2-3 diye kutulara bölüp papağan gibi yeniden yazmamalıdır! "fact" tanımı/ilkeyi söylerken "visual" bunu somut bir günlük hayat/ders örneğiyle, canlı mikro-laboratuvar deneyiyle, karşılaştırmayla veya gerçek süreç aşamalarıyla tamamlamalıdır.
   - Kitap bölümündeki tüm kritik kazanımlar (tanımlar, farklar, örnekler, dikkat edilecek noktalar) tek tek ayrı ekranlara bölünsün; hiçbir önemli bilgi atlanmasın.
2. GEÇİŞ SORULARI (quickCheck):
   - Her bölümde en az 1, en fazla 2 anlatım adımına "quickCheck" (2 seçenekli, anında kontrollü hızlı soru) ekle.
   - "okFeedback" ve "retryFeedback" 1 kısa, motive edici ve öğretici cümle olsun.
3. GÖRSEL ŞEMA VE MİKRO-LABORATUVARLAR ("visual" — HER anlatım adımında ZORUNLU):
   PEDAGOJİK SIRA (ASLA İHLAL ETME):
   - **ÖNCE ÖĞRET, SONRA UYGULAT:** Her bölümün **1. adımı KESİNLİKLE sade bir öğretim görseli** ("highlight", "compare", "steps", "cards" veya "equation") olmalıdır; ilk ekranda öğrenciye bilgi vermeden ASLA etkileşimli mikro-laboratuvar koyma!
   - Etkileşimli mikro-laboratuvarları ("classify_tap", "spot_highlight", "cause_effect_dial", "step_reveal", "token_builder", "filter_sandbox") yalnızca kavram öğretildikten sonraki adımlarda (2. veya sonraki adımlarda, bölüm başına 1-2 adet; farklı motorları konunun doğasına göre çeşitlendirerek) kullan.
   - Etkileşimli adımlarda alttaki "fact" cümlesi doğru cevabı doğrudan kopya vermemeli, kuralın/ilkenin mantığını pekiştirmelidir.
   - "filter_sandbox" kartlarında "badge" alanı cevabı ele veren ("Doğru", "Sağlıklı", "Başarısız" gibi) kelimeler yerine nesnel tür etiketi ("PDF", "WEB", "Senkron" gibi) olmalı veya boş bırakılmalıdır; kartlar kısa ve tek bakışta okunabilir (kısa "title" + 3-5 kelimelik "meta") olmalıdır.

   ETKİLEŞİMLİ MİKRO-LABORATUVARLAR (Öğrencinin GERÇEKTEN DÜŞÜNÜP KARAR VERDİĞİ sade ekranlar):
   a) "classify_tap" (Tek Dokunuşla Ayır — kavramları, örnekleri veya türleri 2-3 gruba ayırmak için en sade ve etkili motordur):
      {
        "kind": "classify_tap",
        "task": "Her örneği doğru gruba ayır:",
        "buckets": ["Eş Zamanlı", "Farklı Zamanlı"],
        "cards": [
          { "text": "Video Konferans", "bucketIndex": 0, "note": "Taraflar aynı anda çevrim içi olur." },
          { "text": "E-posta", "bucketIndex": 1, "note": "Alıcı uygun zamanda okuyup yanıtlar." },
          { "text": "Telefon Görüşmesi", "bucketIndex": 0, "note": "Anlık konuşma ve yanıt vardır." },
          { "text": "İnternet Forumu", "bucketIndex": 1, "note": "Mesajlar sonradan okunup yanıtlanır." }
        ]
      }
      KURALLAR ("classify_tap"): "buckets" 2-3 adet, "cards" 4-6 adet (mümkünse 5-6 zengin örnek); her "bucketIndex" geçerli olmalı ve en az 2 farklı kategori kullanılmalı.

   b) "spot_highlight" (Olayda / Metinde Dokun-Bul — kısa bir günlük hayat olayı, cümle, işlem veya örnekte sorulan kavramı/hatayı buldurmak için idealdir):
      {
        "kind": "spot_highlight",
        "task": "Bu olayda GÜRÜLTÜ olan parçaya dokun:",
        "segments": [
          { "text": "Elif", "feedback": "Elif süreci başlatan gönderendir." },
          { "text": "telefonla Mert'i aradı,", "feedback": "Telefon hattı mesajı taşıyan kanaldır." },
          { "text": "hattaki cızırtı yüzünden", "isTarget": true, "feedback": "Doğru! Hattaki cızırtı mesajın anlaşılmasını engelleyen gürültüdür." },
          { "text": "Mert sesi duyamadı.", "feedback": "Mert mesajı alan alıcıdır." }
        ]
      }
      KURALLAR ("spot_highlight"): "segments" 3-7 parça (yan yana okunduğunda doğal bir cümle oluşturmalı), en az 1 "isTarget": true ve en az 2 hedef-dışı parça olmalı; her parçanın öğretici 1 cümle "feedback"i olmalı.

   c) "cause_effect_dial" (Değiştir & Gör — bir değişken/kademe değişince sonucun nasıl değiştiğini keşfettirmek için idealdir: Fen sıcaklık-hal değişimi/sürtünme, Sosyal yükselti-iklim, Matematik payda/katsayı değişimi, Bilişim şifre gücü):
      {
        "kind": "cause_effect_dial",
        "controlLabel": "Sıcaklık",
        "states": [
          { "label": "Düşük (-5 °C)", "headline": "Katı Hal (Buz)", "effects": ["Tanecikler düzenli ve sıkı dizilir.", "Yalnızca titreşim hareketi yapar."], "meter": 20 },
          { "label": "Orta (25 °C)", "headline": "Sıvı Hal (Su)", "effects": ["Tanecikler birbiri üzerinden kayar.", "Akışkandır ve kabın şeklini alır."], "meter": 55 },
          { "label": "Yüksek (110 °C)", "headline": "Gaz Hal (Buhar)", "effects": ["Tanecikler çok hızlı ve serbest hareket eder.", "Bulunduğu kabın tamamını doldurur."], "meter": 95 }
        ],
        "takeaway": "Sıcaklık arttıkça taneciklerin hareket hızı ve aralarındaki boşluk artar."
      }
      KURALLAR ("cause_effect_dial"): "states" 2-3 farklı kademe olmalı; her kademede kısa "label", çarpıcı "headline", 1-2 kısa "effects" maddesi ve opsiyonel "meter" (0-100); tüm kademeleri özetleyen 1 cümle "takeaway" zorunlu.

   d) "step_reveal" (Tahmin Et & İlerle — sıralı deney aşamaları, tarihsel neden-sonuç zinciri, sindirim/dolaşım akışı veya problem çözüm adımları için pasif "steps" yerine aktif tahmin zinciri kurar):
      {
        "kind": "step_reveal",
        "task": "Sürecin sonraki aşamalarını tahmin ederek zinciri tamamla:",
        "startStep": "Bitki kökleriyle topraktan su ve mineral alır.",
        "nextSteps": [
          {
            "prompt": "Yapraklara ulaşan su ne ile birleşir?",
            "options": ["Güneş ışığı ve karbondioksit ile", "Yalnızca azot gazı ile"],
            "answer": 0,
            "okNote": "Yapraklardaki klorofil güneş ışığını soğurarak su ve karbondioksiti tepkimeye sokar."
          },
          {
            "prompt": "Bu sürecin sonunda hangi ürünler oluşur?",
            "options": ["Besin ve oksijen", "Yalnızca su buharı"],
            "answer": 0,
            "okNote": "Fotosentez sonucunda bitki kendi besinini üretir ve ortama oksijen verir."
          }
        ]
      }
      KURALLAR ("step_reveal"): "startStep" (açık ilk adım) + "nextSteps" 2-3 adet; her adımda kısa "prompt", 2 farklı "options", "answer" (0 veya 1 — hep 0 yapma, dengeli dağıt) ve 1 cümle "okNote" zorunlu.

   e) "token_builder" (Çip Birleştirici — öğrencinin klavyesiz 3-6 çipe dokunarak sıralı süreç, arama sorgusu, İngilizce/Türkçe cümle veya formül kurması için idealdir):
      {
        "kind": "token_builder",
        "task": "Tek satırlık net görev (örn. Başlığında robot geçen PDF dosyalarını arayacak komutu kur.)",
        "tokens": ["intitle:robot", "filetype:pdf", "site:robot", "filetype:jpg"],
        "solution": ["intitle:robot", "filetype:pdf"],
        "anyOrder": true,
        "resultPreview": "Doğru kurulunca çıkacak canlı sonuç özeti (1 cümle).",
        "hint": "Yanlış denemede 1 cümlelik yol gösterici ipucu."
      }
      KURALLAR ("token_builder"): "tokens" 3-6 çip (doğru parçalar + 1-2 çeldirici), "solution" 2-4 çip; "solution" içindeki her çip "tokens" içinde BİREBİR bulunmalı. Sıra önemsizse "anyOrder": true, önemliyse false yaz.

   f) "filter_sandbox" (Canlı Filtre — YALNIZCA gerçekten arama operatörü veya matematiksel bölünebilme/kural filtresi olan konularda kullan; sözel konularda kullanma!):
      {
        "kind": "filter_sandbox",
        "task": "Sadece MEB sitesindeki Güneş Sistemi PDF dosyasını bul:",
        "baseQuery": "güneş sistemi",
        "filters": [
          { "id": "f1", "label": "site:meb.gov.tr", "queryToken": "site:meb.gov.tr", "hint": "Yalnızca meb.gov.tr sonuçlarını bırakır" },
          { "id": "f2", "label": "filetype:pdf", "queryToken": "filetype:pdf", "hint": "Sadece PDF belgelerini süzer" },
          { "id": "f3", "label": "filetype:pptx", "queryToken": "filetype:pptx", "hint": "Yalnızca sunum dosyalarını süzer" }
        ],
        "items": [
          { "id": "i1", "title": "Güneş Sistemi Ders Notu", "meta": "meb.gov.tr/fen/gunes.pdf", "badge": "PDF", "matches": ["f1", "f2"] },
          { "id": "i2", "title": "Güneş Sistemi Sunumu", "meta": "meb.gov.tr/fen/gunes.pptx", "badge": "PPTX", "matches": ["f1", "f3"] },
          { "id": "i3", "title": "Uzay Rehberi", "meta": "bilimblog.com/gunes.pdf", "badge": "PDF", "matches": ["f2"] },
          { "id": "i4", "title": "Güneş Haberleri", "meta": "haberler.com/uzay", "badge": "WEB", "matches": [] }
        ],
        "goalFilterIds": ["f1", "f2"],
        "successNote": "İki operatör birleşince yalnızca MEB sitesindeki PDF belgesi kaldı."
      }
      KURALLAR ("filter_sandbox"): "filters" 1-3, "items" 3-4 adet; her filtre en az 1 öğeyi elemeli ve en az 1 öğeyle eşleşmeli; "goalFilterIds" aktifken en az 1 ve toplamdan az öğe kalmalı; mümkünse en az 1 çeldirici filtre ekle.

   SADE GÖRSEL ŞEMALAR:
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
   - Başlıklar, pasif görsel maddeleri, etkileşimli laboratuvarların "task" yönergesi, "fact", "quickCheck" ve oyun metinleri sesli okunacaktır.
   - Etkileşimli çip etiketlerinde ("filters.label", "queryToken", "tokens", "solution") gerçek teknik/operatör sözdizimi (örn. site:meb.gov.tr, filetype:pdf, "kara delik", -reklam) serbestçe kullanılabilir; bunlar sesli okunmaz.
   - "steps.items", "highlight.bullets" ve "compare.points" öğelerinin başına ASLA madde numarası ("1.", "2.", "Adım 1:") veya madde işareti ("-", "•") koyma — oynatıcı numaraları ve madde işaretlerini otomatik ekler.
   - Sesli okunan cümlelerde "&" yerine "ve", "|" yerine virgül, "→" yerine akıcı Türkçe ifade kullan; markdown backtick (\`) kullanma.
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

function parseFilterSandbox(
  v: Raw,
  ctx: string,
  errors: string[],
): V3BeatVisual | undefined {
  const task = str(v.task);
  const successNote = str(v.successNote);
  const baseQuery = str(v.baseQuery) || undefined;

  const seenFilterIds = new Set<string>();
  const filters: V3FilterSandboxFilter[] = arr(v.filters)
    .filter(isObj)
    .map((f): V3FilterSandboxFilter => ({
      id: str(f.id),
      label: str(f.label),
      queryToken: str(f.queryToken) || undefined,
      hint: str(f.hint),
    }))
    .filter((f) => {
      if (!f.id || !f.label || !f.hint || seenFilterIds.has(f.id)) return false;
      seenFilterIds.add(f.id);
      return true;
    })
    .slice(0, 3);

  const validFilterIds = new Set(filters.map((f) => f.id));

  const seenItemIds = new Set<string>();
  const items: V3FilterSandboxItem[] = arr(v.items)
    .filter(isObj)
    .map((it): V3FilterSandboxItem => ({
      id: str(it.id),
      title: str(it.title),
      meta: str(it.meta) || undefined,
      badge: str(it.badge) || undefined,
      snippet: str(it.snippet) || undefined,
      matches: [...new Set(arr(it.matches).map(str).filter((id) => validFilterIds.has(id)))],
    }))
    .filter((it) => {
      if (!it.id || !it.title || seenItemIds.has(it.id)) return false;
      seenItemIds.add(it.id);
      return true;
    })
    .slice(0, 4);

  const goalFilterIds = [
    ...new Set(arr(v.goalFilterIds).map(str).filter((id) => validFilterIds.has(id))),
  ];

  const localErrors: string[] = [];
  if (!task) localErrors.push('task eksik');
  if (!successNote) localErrors.push('successNote eksik');
  if (filters.length < 1 || filters.length > 3) {
    localErrors.push(`filters sayısı 1-3 olmalı (gelen: ${filters.length})`);
  }
  if (items.length < 3 || items.length > 4) {
    localErrors.push(`items sayısı 3-4 olmalı (gelen: ${items.length})`);
  }

  if (filters.length >= 1 && items.length >= 3) {
    for (const f of filters) {
      const matchCount = items.filter((it) => it.matches.includes(f.id)).length;
      if (matchCount === 0) {
        localErrors.push(`"${f.label}" filtresi hiçbir öğeyle eşleşmiyor`);
      } else if (matchCount >= items.length) {
        localErrors.push(`"${f.label}" filtresi hiçbir öğeyi elemiyor`);
      }
    }

    if (goalFilterIds.length === 0) {
      localErrors.push('goalFilterIds en az 1 geçerli filtre ID içermeli');
    } else {
      const remaining = items.filter((it) =>
        goalFilterIds.every((gid) => it.matches.includes(gid)),
      ).length;
      if (remaining < 1) {
        localErrors.push('goalFilterIds aktifken en az 1 öğe kalmalı (0 öğe kaldı)');
      } else if (remaining >= items.length) {
        localErrors.push('goalFilterIds aktifken en az 1 öğe elenmeli');
      }
    }
  }

  if (localErrors.length) {
    errors.push(`${ctx} (filter_sandbox): ${localErrors.join('; ')}`);
    return undefined;
  }

  return {
    kind: 'filter_sandbox',
    task,
    baseQuery,
    filters,
    items,
    goalFilterIds,
    successNote,
  };
}

function parseTokenBuilder(
  v: Raw,
  ctx: string,
  errors: string[],
): V3BeatVisual | undefined {
  const task = str(v.task);
  const resultPreview = str(v.resultPreview);
  const hint = str(v.hint);
  const tokens = arr(v.tokens).map(str).filter(Boolean).slice(0, 6);
  const solution = arr(v.solution).map(str).filter(Boolean).slice(0, 4);
  const anyOrder = typeof v.anyOrder === 'boolean' ? v.anyOrder : undefined;

  const localErrors: string[] = [];
  if (!task) localErrors.push('task eksik');
  if (!resultPreview) localErrors.push('resultPreview eksik');
  if (!hint) localErrors.push('hint eksik');
  if (tokens.length < 3 || tokens.length > 6) {
    localErrors.push(`tokens sayısı 3-6 olmalı (gelen: ${tokens.length})`);
  }
  if (solution.length < 2 || solution.length > 4) {
    localErrors.push(`solution sayısı 2-4 olmalı (gelen: ${solution.length})`);
  }

  if (tokens.length >= 3 && solution.length >= 2) {
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const s of solution) {
      const rem = counts.get(s) ?? 0;
      if (rem <= 0) {
        localErrors.push(`solution içindeki "${s}" çipi tokens dizisinde bulunmuyor`);
      } else {
        counts.set(s, rem - 1);
      }
    }
  }

  if (localErrors.length) {
    errors.push(`${ctx} (token_builder): ${localErrors.join('; ')}`);
    return undefined;
  }

  return {
    kind: 'token_builder',
    task,
    tokens,
    solution,
    anyOrder,
    resultPreview,
    hint,
  };
}

function parseClassifyTap(
  v: Raw,
  ctx: string,
  errors: string[],
): V3BeatVisual | undefined {
  const task = str(v.task);
  const buckets = arr(v.buckets).map(str).filter(Boolean).slice(0, 3);
  const cards: V3ClassifyTapCard[] = arr(v.cards)
    .filter(isObj)
    .map((c): V3ClassifyTapCard => ({
      text: str(c.text),
      bucketIndex: Number(c.bucketIndex),
      note: str(c.note),
    }))
    .filter(
      (c) =>
        Boolean(c.text) &&
        Boolean(c.note) &&
        Number.isInteger(c.bucketIndex) &&
        c.bucketIndex >= 0 &&
        c.bucketIndex < buckets.length,
    )
    .slice(0, 6);

  const localErrors: string[] = [];
  if (!task) localErrors.push('task eksik');
  if (buckets.length < 2 || buckets.length > 3) {
    localErrors.push(`buckets sayısı 2-3 olmalı (gelen: ${buckets.length})`);
  }
  if (cards.length < 3 || cards.length > 6) {
    localErrors.push(`geçerli cards sayısı 3-6 olmalı (gelen: ${cards.length})`);
  }
  const usedBuckets = new Set(cards.map((c) => c.bucketIndex));
  if (cards.length >= 3 && usedBuckets.size < 2) {
    localErrors.push('kartlar en az 2 farklı kategoriye dağılmalı');
  }

  if (localErrors.length) {
    errors.push(`${ctx} (classify_tap): ${localErrors.join('; ')}`);
    return undefined;
  }

  return { kind: 'classify_tap', task, buckets, cards };
}

function parseSpotHighlight(
  v: Raw,
  ctx: string,
  errors: string[],
): V3BeatVisual | undefined {
  const task = str(v.task);
  const segments: V3SpotHighlightSegment[] = arr(v.segments)
    .filter(isObj)
    .map((seg): V3SpotHighlightSegment => ({
      text: str(seg.text),
      isTarget: seg.isTarget === true ? true : undefined,
      feedback: str(seg.feedback),
    }))
    .filter((seg) => Boolean(seg.text) && Boolean(seg.feedback))
    .slice(0, 7);

  const targetCount = segments.filter((seg) => seg.isTarget).length;
  const nonTargetCount = segments.length - targetCount;

  const localErrors: string[] = [];
  if (!task) localErrors.push('task eksik');
  if (segments.length < 3 || segments.length > 7) {
    localErrors.push(`segments sayısı 3-7 olmalı (gelen: ${segments.length})`);
  }
  if (targetCount < 1) localErrors.push('en az 1 segment isTarget: true olmalı');
  if (segments.length >= 3 && nonTargetCount < 2) {
    localErrors.push('en az 2 hedef-dışı segment bulunmalı');
  }

  if (localErrors.length) {
    errors.push(`${ctx} (spot_highlight): ${localErrors.join('; ')}`);
    return undefined;
  }

  return { kind: 'spot_highlight', task, segments };
}

function parseCauseEffectDial(
  v: Raw,
  ctx: string,
  errors: string[],
): V3BeatVisual | undefined {
  const controlLabel = str(v.controlLabel);
  const takeaway = str(v.takeaway);
  const seenLabels = new Set<string>();

  const states: V3CauseEffectDialState[] = arr(v.states)
    .filter(isObj)
    .map((st): V3CauseEffectDialState => {
      const effects = arr(st.effects)
        .map((e) => cleanListItem(e, false))
        .filter(Boolean)
        .slice(0, 2);
      const rawMeter = typeof st.meter === 'number' && Number.isFinite(st.meter) ? st.meter : undefined;
      const meter = rawMeter !== undefined ? Math.max(0, Math.min(100, Math.round(rawMeter))) : undefined;
      return {
        label: str(st.label),
        headline: str(st.headline),
        effects,
        ...(meter !== undefined ? { meter } : {}),
      };
    })
    .filter((st) => {
      const key = st.label.toLocaleLowerCase('tr-TR');
      if (!st.label || !st.headline || st.effects.length < 1 || seenLabels.has(key)) return false;
      seenLabels.add(key);
      return true;
    })
    .slice(0, 3);

  const localErrors: string[] = [];
  if (!controlLabel) localErrors.push('controlLabel eksik');
  if (!takeaway) localErrors.push('takeaway eksik');
  if (states.length < 2 || states.length > 3) {
    localErrors.push(`geçerli states sayısı 2-3 olmalı (gelen: ${states.length})`);
  }

  if (localErrors.length) {
    errors.push(`${ctx} (cause_effect_dial): ${localErrors.join('; ')}`);
    return undefined;
  }

  return { kind: 'cause_effect_dial', controlLabel, states, takeaway };
}

function parseStepReveal(
  v: Raw,
  ctx: string,
  errors: string[],
): V3BeatVisual | undefined {
  const task = str(v.task);
  const startStep = cleanListItem(v.startStep, true);

  const nextSteps: V3StepRevealNext[] = arr(v.nextSteps)
    .filter(isObj)
    .flatMap((st): V3StepRevealNext[] => {
      const prompt = str(st.prompt);
      const opts = arr(st.options).map((o) => cleanListItem(o, false)).filter(Boolean);
      const ans = Number(st.answer);
      const okNote = str(st.okNote);
      if (
        !prompt ||
        opts.length < 2 ||
        opts[0].toLocaleLowerCase('tr-TR') === opts[1].toLocaleLowerCase('tr-TR') ||
        (ans !== 0 && ans !== 1) ||
        !okNote
      ) {
        return [];
      }
      return [{ prompt, options: [opts[0], opts[1]], answer: ans as 0 | 1, okNote }];
    })
    .slice(0, 3);

  const localErrors: string[] = [];
  if (!task) localErrors.push('task eksik');
  if (!startStep) localErrors.push('startStep eksik');
  if (nextSteps.length < 2 || nextSteps.length > 3) {
    localErrors.push(`geçerli nextSteps sayısı 2-3 olmalı (gelen: ${nextSteps.length})`);
  }

  if (localErrors.length) {
    errors.push(`${ctx} (step_reveal): ${localErrors.join('; ')}`);
    return undefined;
  }

  return { kind: 'step_reveal', task, startStep, nextSteps };
}

function parseVisual(
  v: unknown,
  ctx: string,
  errors: string[],
): V3BeatVisual | undefined {
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
    case 'filter_sandbox':
      return parseFilterSandbox(v, ctx, errors);
    case 'token_builder':
      return parseTokenBuilder(v, ctx, errors);
    case 'classify_tap':
      return parseClassifyTap(v, ctx, errors);
    case 'spot_highlight':
      return parseSpotHighlight(v, ctx, errors);
    case 'cause_effect_dial':
      return parseCauseEffectDial(v, ctx, errors);
    case 'step_reveal':
      return parseStepReveal(v, ctx, errors);
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
          const beatCtx = `Bölüm ${sIdx + 1}, adım ${bIdx + 1}`;
          if (!title || !fact) {
            errors.push(`${beatCtx}: title veya fact eksik`);
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

          const parsedVisual = parseVisual(b.visual, beatCtx, errors);
          if (bIdx === 0 && isInteractiveBeatVisual(parsedVisual)) {
            errors.push(`${beatCtx}: İlk ekran önce bilgi vermelidir; etkileşimli laboratuvar 2. veya sonraki adımlarda kullanılmalıdır`);
          }

          return [
            {
              id: str(b.id) || `s${sIdx + 1}-b${bIdx + 1}`,
              kicker: str(b.kicker) || `${bIdx + 1}. Bilgi`,
              title,
              fact,
              visual: parsedVisual,
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
      schemaVersion: '3.1',
      topicId: src.topicId,
      courseLabel: `${src.grade} ${src.lesson}`,
      sceneId: 'generic',
      guide,
      sections,
    },
    errors,
  };
}
