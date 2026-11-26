# Etkileşimli Ders v3.1 — Evrensel Mikro-Laboratuvar Planı

> **Amaç:** Mevcut Etkileşimli Ders v3 (*Atom Keşif Dünyası*) mimarisini **hiç bozmadan** `schemaVersion: '3.1'` (`version: 3` geriye dönük %100 uyumlu) ile yükseltmek; tüm derslerde yapay zekâ tarafından otomatik üretilebilen, **önce öğreten sonra öğrencinin gerçekten düşünüp karar vererek uyguladığı** sade, kaydırmasız mikro-laboratuvarlar eklemek.

---

## 1. Mevcut Yapı Bozulacak mı? (Sıfır Kırılım Garantisi)

**Hayır.** Yeni sistem mevcut v3 altyapısına **geriye dönük %100 uyumlu bir eklenti (union extension)** olarak entegre edilir:

- **Veritabanı (`interactive_lessons`) şeması DEĞİŞMEZ.** Dersler yine aynı JSON sütununda `version: 3` olarak saklanır.
- **Yayındaki tüm mevcut v1, v2 ve v3 dersler aynen çalışmaya devam eder.** Mevcut 5 pasif görsel türü (`highlight`, `compare`, `steps`, `cards`, `equation`) silinmez ve bozulmaz.
- **Mevcut oyunlar ve ekranlar DEĞİŞMEZ:** `WorldMapView`, `DigestiveScene`, `KavramAviSession`, `PoolCheckStage`, `progressV3` ve `VoiceControls` aynen korunur.
- **Canlı AI maliyeti SIFIRDIR:** Etkileşimli içerik mevcut worker (`generateV3.ts`) ile konu başına **tek seferde** JSON olarak üretilir; öğrenci tıklarken canlı AI çağrısı yapılmaz, her şey istemcide (React) anında çalışır.

### Entegrasyon Noktaları (Dokunulacak Dosyalar)
| Dosya | Yapılacak Değişiklik |
|---|---|
| `app/src/lib/interactiveLesson/typesV3.ts` | `V3BeatVisual` union tipine yeni etkileşimli `kind` türleri eklenir. |
| `app/src/components/interactive/v3/scenes/GenericVisualScene.tsx` | Yeni `kind` türleri için etkileşimli alt bileşenler (ayrı dosya/klasör altında modüler) render edilir. |
| `app/src/components/interactive/v3/scenes/labs/*` *(Yeni klasör)* | 6 evrensel mikro-laboratuvar React bileşeni (ortak accent paleti ve mobil dokunmatik standartla). |
| `app/src/components/interactive/v3/PlayerV3.tsx` | Etkileşimli beat'lerde opsiyonel "Keşfedildi" geri bildirim sesi/rozeti ve POE (önce dene, sonra kuralı gör) yumuşak vurgusu. |
| `app/src/lib/interactiveLesson/guide.ts` | `v3BeatSpeech` fonksiyonuna yeni `kind` türlerinin kısa ve doğal TTS okuma kuralları eklenir. |
| `app/src/lib/interactiveLesson/generateV3.ts` | Gemini promptuna yeni motorların seçim rehberi + JSON şeması + deterministik doğrulayıcılar eklenir. |

---

## 2. Pedagojik ve UX Altın Kuralları

1. **Sıfır Yazma Sürtünmesi (Tap-Only Mobile-First):**
   - Ortaokul öğrencisine telefonda klavye açtırmak veya hassas sürükle-bırak yaptırmak yüksek terk oranına yol açar.
   - Tüm motorlar **tek dokunuş (çip aç/kapa, sırayla tıkla, kademe seç, metne dokun)** mantığıyla çalışır.
2. **Keşfet → Farkı Gör → Kuralı Anla (POE Akışı):**
   - Öğrenci önce çipe dokunur, ekrandaki değişimi (elenen sonuçları, değişen sayıları, parlayan kelimeleri) kendi gözüyle görür.
   - Atom'un alt kutudaki kural özeti (`fact`) etkileşimle doğrulanır; öğretmene gerek kalmadan sebep-sonuç zihinde oturur.
3. **Bilişsel Yük Dengesi (Her Slayt Ağır Etkileşim Olmaz):**
   - Bir bölümde 3–5 beat varsa: **2–3 adet etkileşimli mikro-laboratuvar + 1–2 adet sade özet/karşılaştırma kartı** en verimli ritimdir.
4. **Ses (TTS / Azure Speech) Maliyeti ve Akıcılığı:**
   - Etkileşimli kartların içindeki her sahte sonuç satırı veya her çip uzun uzun seslendirilmez.
   - `v3BeatSpeech` yalnızca **Başlık + Kısa Görev Yönergesi (`task`) + Atom Özeti (`fact`)** okur.
   - Başarı/dönüt cümleleri mümkün olduğunca `GUIDE` ortak havuzundan (içerik-adresli tek MP3) okunur; Azure TTS kotasını şişirmez.
5. **Deterministik AI Doğrulaması (`parseGeneratedLessonV3`):**
   - AI'ın ürettiği her etkileşimli JSON matematiksel olarak doğrulanır (ör. filtre çipi gerçekten en az 1 öğeyi eliyor mu, hedef kombinasyon geçerli mi?).
   - Hatalı JSON geçmez; worker mevcut retry mekanizmasıyla hatayı bildirip düzelttirir.

---

## 3. Altı Evrensel Mikro-Laboratuvar Motoru

### Motor 1: `filter_sandbox` — Canlı Filtre / Kural Laboratuvarı *(Faz 1 — Pilot)*
**Ne işe yarar?** Bir kural, operatör veya özellik eklendiğinde hangi örneklerin elenip hangilerinin kaldığını 1–2 dokunuşla canlı gösterir.

**Derslere göre kullanım:**
- **Bilişim:** Arama operatörleri (`"..."`, `site:`, `filetype:`, `intitle:`), güçlü şifre kuralları.
- **Matematik:** Bölünebilme kuralları (`2'ye bölünür`, `3'e bölünür`), asal sayılar, çokgen özellikleri.
- **Fen:** İletken/yalıtkan, mıknatıs çeker/çekmez, saf madde/karışım.
- **Türkçe / İngilizce:** Sözcük türü, ek, zaman veya kural filtresi.

**Önerilen TypeScript Şeması (`V3BeatVisual` eklentisi):**
```ts
export type V3FilterSandboxVisual = {
  kind: 'filter_sandbox';
  /** Tek satırlık görev (örn. "Sadece MEB sitesindeki Güneş Sistemi PDF dosyasını bul.") */
  task: string;
  /** Arama çubuğu veya kural başlığında sabit görünen temel ifade (örn. "güneş sistemi") */
  baseQuery?: string;
  /** Dokunmatik aç/kapa çipleri (1–3 adet) */
  filters: Array<{
    id: string;
    /** Çip üzerinde yazan kısa etiket (örn. 'site:meb.gov.tr', '"kara delik"', '3 ile bölünür') */
    label: string;
    /** Çip açıldığında temel ifadenin nasıl görüneceği (opsiyonel önizleme parçası) */
    queryToken?: string;
    /** Bu çip aktifken hangi sonuç özelliği vurgulanır */
    hint: string;
  }>;
  /** Canlı filtrelenecek 3–4 adet mini örnek kart */
  items: Array<{
    id: string;
    /** Kart başlığı (örn. sayfa başlığı, sayı, madde adı) */
    title: string;
    /** İkincil satır (örn. URL: "meb.gov.tr/fen/gunes.pdf" veya kısa açıklama) */
    meta?: string;
    /** Köşe rozeti (örn. "PDF", "DOC", "WEB", "Çift") */
    badge?: string;
    /** Kartın kısa gövde özeti (1 satır) */
    snippet?: string;
    /** Bu kartın HANGİ filtre ID'lerine uyduğu */
    matches: string[];
  }>;
  /** Görevin tamamlanması için açık olması gereken filtre ID'leri */
  goalFilterIds: string[];
  /** Hedef kombinasyon açılınca çıkacak 1 cümlelik öğretici dönüt */
  successNote: string;
};
```

**Deterministik Doğrulama Kuralları (`generateV3.ts`):**
- `filters.length` 1..3 arasında, `items.length` 3..4 arasında olmalı.
- Her filtre en az 1 item'ı elemeli VE en az 1 item'la eşleşmeli (boş veya hepsini geçiren anlamsız filtre yasak).
- `goalFilterIds` aktif olduğunda kalan item sayısı en az 1 ve `items.length`'ten kesinlikle az olmalı (gerçek eleme yaşanmalı).

---

### Motor 2: `token_builder` — Çip Birleştirici *(Faz 1 — Pilot)*
**Ne işe yarar?** Öğrenci klavye kullanmadan 3–5 hazır çipe dokunarak doğru sırayla bir sorgu, cümle, kelime yapısı veya formül kurar.

**Derslere göre kullanım:**
- **Bilişim:** Arama sorgusu kurma (`intitle:deprem` + `filetype:pdf`), algoritma adımı sıralama.
- **İngilizce:** Soru / olumsuz cümle kurma (`Do` + `you` + `like` + `science?`).
- **Türkçe:** Kök + yapım eki + çekim eki birleştirme.
- **Fen / Matematik:** Fotosentez / denklem / işlem sırası kurma.

**Önerilen TypeScript Şeması:**
```ts
export type V3TokenBuilderVisual = {
  kind: 'token_builder';
  /** Tek satırlık görev (örn. "Başlığında robot geçen PDF dosyalarını arayacak komutu kur.") */
  task: string;
  /** Seçilebilecek çipler (doğrular + 1–2 çeldirici, toplam 3–6 çip) */
  tokens: string[];
  /** Doğru sıralı çip listesi (hepsi tokens içinde olmalı) */
  solution: string[];
  /** Sıra önemsizse true (ör. arama operatörleri veya toplama) */
  anyOrder?: boolean;
  /** Doğru kurulunca gösterilecek canlı sonuç özeti */
  resultPreview: string;
  /** Yanlış denemede 1 cümlelik yol gösterici ipucu */
  hint: string;
};
```

**Deterministik Doğrulama Kuralları:**
- `tokens.length` 3..6, `solution.length` 2..4 olmalı.
- `solution` içindeki her token `tokens` dizisinde birebir bulunmalı.

---

### Motor 3: `cause_effect_dial` — Değiştir & Gör *(Faz 3)*
**Ne işe yarar?** Öğrenci 2–3 kademeli bir düğmeyi (ör. *Düşük / Orta / Yüksek* veya *Katı / Sıvı / Gaz*) değiştirdikçe sahnedeki göstergeler ve sonuç anında güncellenir.

**Derslere göre kullanım:**
- **Fen:** Sıcaklık artınca tanecik hareketi ve hal değişimi; sürtünme–hız; besin zinciri dengesi.
- **Sosyal:** Yükselti arttıkça sıcaklık, bitki örtüsü ve ekonomik faaliyet.
- **Matematik:** Pay/payda veya katsayı değişince kesir/oran değeri.
- **Bilişim:** Şifre uzunluğu ve karakter çeşitliliği arttıkça güvenlik seviyesi.

**Önerilen TypeScript Şeması:**
```ts
export type V3CauseEffectDialVisual = {
  kind: 'cause_effect_dial';
  /** Kontrol edilen değişken adı (örn. "Sıcaklık", "Şifre Karmaşıklığı") */
  controlLabel: string;
  /** 2–3 kademeli durum listesi */
  states: Array<{
    label: string;
    /** Öne çıkan değer/durum (örn. "Katı Hal", "1000+ Yıl") */
    headline: string;
    /** 2 kısa gözlem maddesi */
    effects: string[];
    /** Gösterge doluluk oranı (0–100) */
    meter?: number;
  }>;
  /** Tüm kademeler gezilince çıkacak özet çıkarım */
  takeaway: string;
};
```

---

### Motor 4: `spot_highlight` — Metinde / Örnekte Dokun-Bul *(Faz 3)*
**Ne işe yarar?** Kısa bir cümle, arama sorgusu, kod satırı veya problem parçalara bölünmüş halde gösterilir; öğrenci sorulan parçaya dokunup anında dönüt alır.

**Derslere göre kullanım:**
- **Türkçe:** Özne/yüklem, yazım yanlışı, mecaz sözcük bulma.
- **Bilişim:** Hatalı arama operatörünü veya güvensiz link parçasını bulma.
- **Matematik / İngilizce:** İşlem hatasını veya yanlış fiil çekimini yakalama.

**Önerilen TypeScript Şeması:**
```ts
export type V3SpotHighlightVisual = {
  kind: 'spot_highlight';
  task: string;
  /** Yan yana dizilen tıklanabilir parçalar (3–7 parça) */
  segments: Array<{
    text: string;
    isTarget?: boolean;
    /** Dokunulduğunda çıkan 1 cümlelik açıklama */
    feedback: string;
  }>;
};
```

---

### Motor 5: `classify_tap` — Tek Dokunuşla Ayır *(Faz 3)*
**Ne işe yarar?** Ortada tek bir örnek kart görünür, altta 2–3 kategori butonu vardır. Öğrenci 3–4 örneği tek dokunuşla doğru sepete gönderir (mobilde sürükle-bırak yerine çok daha hızlı ve hatasız).

**Derslere göre kullanım:**
- **Fen:** Fiziksel / kimyasal değişim, yenilenebilir / yenilenemez enerji.
- **Türkçe:** Gerçek / mecaz anlam, öznel / nesnel yargı.
- **Sosyal:** Hak / sorumluluk, doğal / beşeri unsur.
- **Matematik:** Rasyonel / irrasyonel, dar / dik / geniş açı.

**Önerilen TypeScript Şeması:**
```ts
export type V3ClassifyTapVisual = {
  kind: 'classify_tap';
  task: string;
  /** 2–3 kategori etiketi */
  buckets: string[];
  /** 3–4 örnek kart */
  cards: Array<{
    text: string;
    bucketIndex: number;
    note: string;
  }>;
};
```

---

### Motor 6: `step_reveal` — Tahmin Et & İlerle *(Faz 3)*
**Ne işe yarar?** Pasif `steps` şemasının aktif hali: Sürecin ilk adımı açık gelir, öğrenci sonraki adımı 2 seçenekten tahmin ederek zinciri kurar.

**Derslere göre kullanım:**
- **Sosyal:** Tarihsel neden-sonuç zinciri.
- **Fen:** Deney aşamaları, sindirim/dolaşım akışı.
- **Matematik:** Problem çözüm adımları.

**Önerilen TypeScript Şeması:**
```ts
export type V3StepRevealVisual = {
  kind: 'step_reveal';
  task: string;
  /** Başlangıç adımı (açık görünür) */
  startStep: string;
  /** Öğrencinin sırayla tahmin edeceği 2–3 adım */
  nextSteps: Array<{
    prompt: string;
    options: [string, string];
    answer: 0 | 1;
    okNote: string;
  }>;
};
```

---

## 4. Aşamalı Uygulama Yol Haritası

Her faz bağımsız bir oturumda güvenle uygulanıp test edilebilecek şekilde bölünmüştür:

### Faz 1 — Pilot & Temel Altyapı *(Tamamlandı)*
- [x] `typesV3.ts` içine `schemaVersion?: '3.1'`, `isInteractiveBeatVisual` ve etkileşimli tipleri (`filter_sandbox`, `token_builder`, `classify_tap`, `spot_highlight`) ekle.
- [x] Ortak tema (`labTheme.ts`) + kaydırmasız, 1 saniyede anlaşılır laboratuvar bileşenlerini (`ClassifyTapLab.tsx`, `SpotHighlightLab.tsx`, `TokenBuilderLab.tsx`, `FilterSandboxLab.tsx`) yaz ve `GenericVisualScene.tsx` içine bağla.
- [x] `guide.ts` içine yalnızca **Başlık + Kısa Görev (`task`) + Atom Özeti (`fact`)** okuma kurallarını ve `GUIDE.v3LabDone` ortak ses havuzunu ekle.
- [x] `generateV3Core.ts` içine **Önce Öğret → Sonra Uygula** zorunlu kuralını (1. adım asla laboratuvar olamaz), `classify_tap` (4–6 örnek) + `spot_highlight` önceliklendirmesini ve deterministik doğrulayıcıları ekle (`filter_sandbox` yalnızca gerçek arama/kural filtresi konularına kısıtlandı).
- [x] **Admin Önizleme Modu:** `voice_done = false` olan hazır derslerin öğrencilere gizli kalıp yalnızca admin oturumunda `"Admin önizleme (sessiz)"` olarak açılmasını sağla (`/api/interactive-lesson?check=1&preview=1` + `DersClientV1.tsx`).
- [x] **Pilot Doğrulama (Konu #578 — v3.1):** 6 örnekli `classify_tap`, `spot_highlight`, her açılışta karıştırılan `token_builder` ve `PlayerV3` oyun ekranında çift İleri butonu çakışmasının giderilmesi doğrulandı.

### Faz 2 — Oyuncu (PlayerV3) & POE Cilası *(Tamamlandı)*
- [x] `PlayerV3.tsx` içinde etkileşimli beat'lerde `onLabComplete` ile tek yerden başarı sesi (`soundOn` senkronlu), yeşil çerçeve vurgusu ve Atom `celebrate` ruh hali senkronunu bağla.
- [x] Gereksiz çift yönergeyi kaldır; tamamlanınca Atom balonunda yeşil **Keşfedildi** rozeti göster (*"İleri"* butonunu kilitleme).
- [x] `Kavram Avı` ekranında alttaki ikinci yeşil *"Sorular →"* butonunu gizle (çift ileri kafa karışıklığı giderildi).
- [x] Ortak dönüt cümlesini (`GUIDE.v3LabDone`) içerik-adresli ses havuzuna ekle.

### Faz 3 — Kalan 2 Motor & Çapraz Ders Doğrulaması *(Tamamlandı)*
- [x] `cause_effect_dial` (`CauseEffectDialLab.tsx`) — *Değiştir & Gör* motorunu (2–3 kademeli değişken/sonuç: Fen sıcaklık-hal değişimi, Sosyal yükselti-iklim, Bilişim şifre gücü) ekle + `generateV3Core.ts` + `guide.ts`.
- [x] `step_reveal` (`StepRevealLab.tsx`) — *Tahmin Et & İlerle* motorunu (ilk adım açık, sonraki 2–3 adımı 2 seçenekten tahmin ederek neden-sonuç/deney zinciri kurma) ekle + `generateV3Core.ts` + `guide.ts`.
- [x] **Admin Paneli v3.1 Ayrımı:** `AdminInteractiveLessons.tsx` "Son üretilenler" listesinde `v3.1` ve eski `v3` derslerini ayırt eden rozet + tek tıkla "v3.1 ile yeniden üret" akışını ekle/doğrula.
- [x] **Çapraz Ders Doğrulaması:** Veritabanındaki gerçek kitap içeriklerinden Fen (`#804` Isı ve Sıcaklık — `cause_effect_dial`, `step_reveal`, `classify_tap`, `spot_highlight`) ve Türkçe (`#943` Söz Sanatları — `spot_highlight`, `token_builder`, `classify_tap`) v3.1 dersleri `parseGeneratedLessonV3` ile sıfır hatayla doğrulanıp `voice_done = false` (admin önizleme) olarak kaydedildi.

### Faz 4 — Seslendirme (Azure TTS) & Yayına Alma
- [x] Faz 3 push sonrası geçici park edilen Konu #578'i (`status = 'ready', runs = 0, voice_done = false`) tekrar aktif et.
- [ ] Onaylanan v3.1 pilot derslerinde Azure TTS (`voice_done`) üretiminin yeni `task` + `GUIDE.v3LabDone` satırlarını hatasız seslendirdiğini doğrula ve öğrenciye aç.
- [ ] Öğrenci kullanım verisinden (tamamlama oranı / etkileşim) motor performansını gözlemle.

---

## 5. Yarın Yeni Bir Oturumda Devam Etmek İçin Kısa Komut

Sonraki oturumda sadece şunu yazmanız yeterlidir:
> *"docs/etkilesimli-ders-v3-mikro-laboratuvar-plani.md dosyasını oku ve Faz 3'ü uygula."*
