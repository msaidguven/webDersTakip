# Yazılı Soruları Planı

2026-10-22 · Durum: 1–4. adımlar kodlandı ve yerelde test edildi, push yok. 6. Mat 1. yazılıya 77 soru girildi. Sırada 5. adım (kalan sınıf-derslerin soru üretimi). Kaldığın yerden devam etmek için ilk işaretlenmemiş maddeden başla.

## Amaç

Yazılı aramaları başlamadan önce sınıf/ders/yazılı bazlı yazılı soruları sayfaları açmak.
Örnek: "6. Sınıf Matematik 1. Dönem 1. Yazılı Soruları".
Sorular herkese açık olur. Bu sayfalar öğretmen ve veliden üye toplamak için de kullanılır.

## Mevcut durum (2026-10-20 ölçümü)

- İlk 9 haftaya ait konusu olan 12 sınıf-ders var: 5–7 Matematik/Fen/Sosyal, 5. Din, 6. Bilişim, 6. Türkçe. Her birinde 3–13 konu var.
- Sitede yalnız **8 klasik soru** var. Diğer ~2.800 soru test, boşluk doldurma veya eşleştirme. Asıl iş klasik soru üretmek.
- 6. Türkçe'de yalnız 3 soru var, ilk turda dışarıda kalır.
- Kullanılacak mevcut altyapı:
  - Klasik soru kuralları: `app/prompt/_classical-question-rules.md`, prompt 13–16 ve 25.
  - JSON okuma ve kaydetme: `parseMixedQuestions.ts`, `questionInsert.ts`.
  - Görselli sorular için SVG Soruları akışı.
  - PDF altyapısı.
  - Öğretmen paneli: soru seçme ve Word indirme.

## MEB 2026-2027 bulguları (2026-10-20 araştırması)

- ÖDSGM 10.09.2026'da 1. dönem **konu-soru dağılım tablolarını** yayımladı: [tablolar sayfası](https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724). Ders başına bir Excel, sınıf başına bir sayfa.
- Dağılım **öğrenme çıktısı kodu** (MAT.6.1.1) bazında ve her yazılı için **4–7 senaryo** var. Zümre birini seçer. Kodlar sitedeki `topic_learning_outcomes.code` ile birebir eşleşiyor.
- **2. yazılı 1. yazılının devamı değil**, kendi konularını soruyor. Bazı konular iki yazılıda da var.
- Yıllık plan haftası her zaman doğru kapsamı vermiyor. Örnek: 5. Matematik 1. yazılı Geometrik Şekiller ünitesinden.
- **6. sınıf Matematik 1. dönem 1. yazılı ülke geneli ortak sınav: 11 Kasım 2026, Çarşamba.**
  - Kapsam MAT.6.1.1–6.1.4 (Sayılar ve Nicelikler (1)).
  - Tamamı açık uçlu, kitapçığı Bakanlık gönderiyor.
  - Senaryo tablosu "sınav öncesi kılavuzla" yayımlanacak.
  - Kaynak: [Menderes İlçe MEM rehberi](https://menderes.meb.gov.tr/www/2026-2027-egitim-ogretim-yili-1-donem-ortak-yazili-sinav-rehberi/icerik/1797/tr).
- **7. sınıf Türkçe 2. yazılı** tablosunda da "Ülke Geneli" yazıyor.
- Tüm sorular açık uçlu ve kısa cevaplı olacak. Her soru için **puanlama anahtarı (rubrik)** hazır bulundurulacak.
- Bilişim için tablo yok, il zümresi hazırlıyor. O derste kapsam yıllık plan haftasından önerilir.

## Kararlar

| Konu | Karar |
|---|---|
| Üretim | **Yalnız manuel.** Prompt kopyalanır, AI'ya sorulur, dönen JSON yapıştırılır. Worker ile otomatik Gemini üretimi şimdilik yok. |
| Üretim birimi | **Konu konu** üretilir. Gösterim yazılı bazlıdır. |
| Soru sayısı | Konu başına **8–15 klasik soru, mümkünse tek seferde**. Konunun tüm kazanımları kapsanır, zorluk dengeli olur, her soruda puan bulunur. |
| İkinci tur | Yalnız gerekirse ve **diğer kaynaktan** yapılır. İçerikten üretildiyse ikinci tur mevcut sorulardan olur, ya da tersi. Prompt mevcut klasik soruları da verir: "tekrarlama, eksik kazanımları kapat". |
| Kaynak modları | **A. İçerikten:** konu anlatımı ve anahtar kavramlar. **B. Mevcut sorulardan:** test/boşluk/eşleştirme soruları, "kopyalama, yeniden kurgula" kuralıyla. |
| Görünürlük | Sorular ve cevaplar **herkese açık**. Cevap soru başına "Cevabı göster" ile açılır. **PDF yalnız üyelere.** |
| Hazır kağıt | Her yazılıya **2 örnek sınav kağıdı**: 10–15 soru, toplam 100 puan. Aynı soru havuzundan seçilir, ayrıca soru üretilmez. |
| Adres | `/yazili-sorulari/6-sinif/matematik/1-donem-1-yazili`. Sondaki "-sorulari" tekrarı yok. Tam ifade başlıkta ve H1'de geçer. |
| Kapsam | **MEB tablosundan** gelir: admin ÖDSGM Excel'ini yükler, sitedeki her sınıf için o dersin senaryoları ve konuları yazılır. Tablo yoksa yıllık plan haftasından öneri. Ülke geneli sınavda konular elle seçilir. Admin her durumda konu ekleyip çıkarabilir. |
| MEB dağılımı | Elle girilmez, Excel'den gelir (senaryo × öğrenme çıktısı → soru sayısı). Tahmin gösterilmez. Admin'de her öğrenme çıktısı için "havuz / en çok × 2" kontrolü var. |

## Veri yapısı

- **`questions` (mevcut):** Sorular burada klasik tip olarak, konuya ve kazanıma bağlı durur. Kaynak `yazili` olur. Ayrı bir soru tablosu yok.
- **`exams`:** sınıf, ders, dönem (1/2), yazılı no (1/2), konu listesi, durum (taslak/yayında), slug.
- **`exam_topics`:** yazılının konu listesi.
- **`exam_lo_targets`:** yazılı × senaryo × öğrenme çıktısı kodu → soru sayısı (MEB Excel'inden).
- **`exams.national`, `exams.exam_date`:** ülke geneli sınav işareti ve sınav tarihi (sayfada gösterilir).
- **`exam_papers`:** yazılı başına 2 kağıt: sıralı soru listesi ve puanlar.
- Tablolarda RLS olur: herkese yalnız yayındaki kayıtları okuma izni, yazma yalnız admin.

## Ekranlar

### Admin → Yazılı Soruları

1. Sınıf → ders → 1. dönem 1. yazılı / 2. yazılı seçilir. O yazılının konuları listelenir.
2. Her konuda şunlar görünür:
   - Klasik soru sayısı.
   - Durum işareti: Yetersiz (<8), Tamam (8–15) ya da "Kazanım X'te soru yok".
   - "Prompt kopyala" düğmesi (kaynak: İçerikten / Mevcut sorulardan).
3. JSON yapıştır → önizleme → kaydet. Kaydetmeden önce sorular düzenlenebilir veya silinebilir. Kazanım kodu tanınmayan soru kırmızı işaretlenir.
4. Elle tek soru ekleme ve düzenleme: soru, cevap, anahtar kelimeler, puan, kazanım.
5. Prompt boyutu ekranda gösterilir. Çok uzunsa konu metni yerine özet ve anahtar kavramlar gider.
6. MEB dağılım tablosu düzenlenir.
7. "Kağıtları oluştur" düğmesi kazanım dağılımına göre otomatik seçer. Sorular elle değiştirilebilir. Sonra yayınlanır.
8. Görsel gereken sorular `svg_prompt` ile SVG Soruları'na düşer ve görsel gelene kadar taslakta kalır.

### Herkese açık sayfalar

- `/yazili-sorulari`: sınıf ve ders listesi.
- `/yazili-sorulari/6-sinif/matematik`: o dersin yazılıları.
- `/yazili-sorulari/6-sinif/matematik/1-donem-1-yazili`:
  - **Konu konu sorular:** her konu ayrı bölüm, "Cevabı göster".
  - **1. ve 2. örnek sınav kağıdı:** önizleme. PDF (kağıt ve ayrı cevap anahtarı) yalnız üyelere. Üye olmayan kişi "PDF için ücretsiz üye ol" görür.
- Sayfalar önbellekli (ISR) ve indekslenebilir olur. Site haritasına eklenir. Başlıkta "2026-2027 · MEB müfredatına uygun" yazar.
- Kayıt kaynağı bu sayfalardan gelen üyeleri Üye Aktivitesi'nde gösterir.

### Öğretmen paneli → "Yazılı hazırla" (mevcut paneli genişletme)

- Sınıf → ders → yazılı seçilir. Konular ve sorular görünür. Öğretmen seçtiklerini sepete ekler.
- **Rehber panel:** MEB'in istediği kazanım dağılımı ile öğretmenin seçimi canlı karşılaştırılır.
  - ✓ yeşil: tamam
  - "1 eksik" sarı
  - "MEB bu yazılıda istemiyor" gri
  - Yalnız bilgi verir. **Karar öğretmenindir, indirme hiçbir zaman engellenmez.**
- Puanlar düzenlenebilir ve toplam 100 olmalı uyarısı çıkar. Soru sırası sürükle-bırak ile değişir.
- Tek tıkla **Word** (mevcut) ve **PDF** (yeni) indirme. Kağıtta okul adı, sınıf ve ad-soyad satırı bulunur, cevap anahtarı ayrı sayfadadır.
- Yalnız onaylı öğretmen (`is_verified`) kullanabilir. Öğrenci giremez.

## Uygulama sırası

- [x] **1. Tablolar ve admin üretim ekranı.** (2026-10-21: üç migration canlıda — `yazili_exams.sql`, `yazili_meb_targets.sql`, `question_classical_rubric.sql`. MEB Matematik/Fen/Sosyal/Din tabloları içe aktarıldı. 6. Din'in eksik öğrenme çıktısı kodları MEB tablosundan eklendi. 6. Mat 1. yazılı: ülke geneli, 11 Kasım, 3 konu.) Yazılı kapsamı, kazanım dağılımı, konu bazlı prompt (iki kaynak), JSON önizleme/kaydetme, elle ekleme.
  Doğrulama: 6. Matematik 1. yazılının bir konusunda prompttan JSON'a ve kayda kadar uçtan uca.
- [x] **2. Herkese açık `/yazili-sorulari/...` sayfaları** (2026-10-21: dizin, ders, yazılı sayfaları + geri sayım + anasayfa "Yaklaşan yazılılar" kartı + site haritası. Sorusu olmayan yazılı 404.) (konu bölümleri ve cevap göster). Google'a erken girmesi için öne alındı.
  Doğrulama: giriş yapılmış ve yapılmamış haliyle, mobil, karanlık tema.
- [x] **3. İki örnek kağıt ve üyelere özel PDF.** (2026-10-21: kağıtlar saklanmıyor, her senaryo için A/B havuzdan kuruluyor; PDF `/api/yazili-pdf/...` yalnız giriş yapmış üyeye.)
  Doğrulama: iki kağıt, toplam 100 puan, üye olmayan PDF alamıyor.
- [x] **4. Öğretmen paneli "Yazılı hazırla".** (2026-10-22, yerelde test edildi, push yok.)
  - Sayfa `/ogretmen/yazili` (`app/ogretmen/yazili/`). Öğretmen yalnız yayındaki yazılıları ve kendi branşlarını görür, admin hepsini.
  - Soru havuzu: konu ve öğrenme çıktısı süzgeci, "Cevabı gör", kağıttakileri gizle.
  - "Kağıdım": sürükle-bırak ve ↑↓ ile sıra, soru başı puan, varsayılan eşit dağıtım. Elle değişince elle kalır; "Puanları eşit dağıt" ile geri döner. Toplam 100 değilse uyarı çıkar.
  - "Hazır kağıtla başla": sitedeki A/B kağıtları.
  - MEB rehberi:
    - Senaryolu yazılıda zümre senaryosu seçilir.
    - Ülke genelinde dengeli dağılım önerisi gösterilir.
    - Her öğrenme çıktısı için durum: tamam / eksik / fazla / senaryoda yok. Satıra tıklayınca havuz süzülür.
    - Yalnız bilgi verir, indirmeyi asla engellemez.
  - İndirme: kağıt PDF, ayrı cevap anahtarı PDF, düzenlenebilir Word (cevap anahtarı ayrı sayfada, LaTeX düz metne çevrilir).
    - Okul adı, sınav başlığı ve isteğe bağlı öğretmen adı (imza) eklenebilir.
    - Sunucu her soruyu o yazılının havuzunda doğrular.
  - Taslak cihazda (localStorage) saklanır.
  - Header menüsünde öğretmen ve admin için "Öğretmen Paneli" bağlantısı. `/ogretmen`'de "Yazılı hazırla / Konudan soru seç" sekmeleri.
  - Doğrulama: admin ile uçtan uca (Playwright, PDF ve Word içeriği okundu), misafir 401, öğrenci 403, başka yazılının sorusu 400, mobil taşma yok.
    - Onaylı gerçek öğretmen hesabıyla denenmedi; test hesabı yok, branş süzgeci kodda.
- [ ] **5. İçerik üretimi.** 6. Matematik ile deneme turu ve kalite kontrolü, sonra kalan 10 sınıf-ders (Türkçe en son).

## Fikirler ve notlar (2026-10-20)

- **Rubrik:** MEB her soru için puanlama anahtarı istiyor. Klasik soru şemasına "kısmi puan ölçütü" alanı eklenebilir (ör. "tam: … / yarım: …"). Bu, 3. adımdaki kağıt ve PDF için çok değerli. Şimdilik `model_answer` + `key_terms` var.
- **Senaryoya göre kağıt:** Örnek kağıtlar rastgele değil, MEB senaryosuna birebir uygun kurulmalı ("Senaryo 2'ye göre hazırlanmıştır"). Öğretmen için en güven veren ifade bu. Öğretmen panelinde de zümrenin seçtiği senaryo seçilir, rehber o senaryoya göre uyarır.
- **6. Matematik ülke geneli sınav (11 Kasım):** En çok aranacak sayfa bu olur. Öncelik: 4 konunun havuzu 11 Kasım'dan en az 1 hafta önce dolu olmalı. MEB kılavuzu (senaryo tablosu) yayımlanınca Excel tekrar yüklenmeli.
- **Geri sayım:** Sınav tarihi girilen yazılıların sayfasında "Sınava X gün kaldı", anasayfada da "Yaklaşan yazılılar" kutusu. Retention ve SEO için iyi.
- **2. dönem tabloları:** Şubat'ta yayımlanınca aynı "MEB tablosu yükle" akışı çalışır, kod değişikliği gerekmez.
- **8. sınıf ve İngilizce:** Tabloları da var ama sitede yok. Sınıf veya ders eklenince Excel tekrar yüklenmesi yeterli.
- **Türkçe — BEKLETİLİYOR (kullanıcı kararı 2026-10-21, sonra bakılacak):** Tablo okuma/yazma becerisi bazlı (T.O.6.6 vb.), bizim tema-metin konularıyla eşleşmesi kontrol edilmeli. Türkçe yazılısının %50'si dinleme-konuşma uygulaması. Türkçe Excel'i bu yüzden içe aktarılmadı.
- **Uygulandı (2026-10-21):** rubrik (puanlama ölçütü) alanı, senaryoya göre A/B kağıt, sınav sayfasında ve anasayfada geri sayım.
- **PDF CPU:** Her indirme Chromium'la 3–8 sn üretiliyor. Yoğun yazılı haftasında Vercel CPU'yu zorlayabilir. Gerekirse aynı kağıdın PDF'i (soru listesi değişmedikçe) Supabase Storage'da önbelleğe alınabilir.

## Yapılanlar (2026-10-21, ek)

- **Eksik havuz özeti:** Admin'de yazılı başına eksik öğrenme çıktıları ve sayıları, sınav tarihine göre sıralı. "Aç" ile o yazılıya gidilir.
- **Header:** "Yazılı Soruları" bağlantısı eklendi (mobil alt çubukta "Yazılı").
  - 1024–1279 px arasında girişli header'da seri göstergesi gizli.
  - "Ders Takip Çizelgesi" bağlantısı yalnız ≥1536 px'te görünüyor (taşma düzeltmesi).
- **Eski klasik sorular silindi:** 8 soru, 6. Bilişim "Yenilikçi Bilişim Teknolojileri", 12 Eylül deneme üretimi. Sitede klasik soru kalmadı; hepsi yeni prompt ve rubrikle sıfırdan üretilecek.

## Cevap görseli (cevap SVG'si) — KODLANDI (2026-10-23)

Kullanıcıyla artısı-eksisi konuşulup onaylandı (2026-10-21), 10 adımın hepsi 2026-10-23'te kodlandı ve bir [TEST]
sorusuyla uçtan uca doğrulandı (önizleme uyarısı, SVG sayfası, site, A kağıdı + cevap anahtarı; test verisi silindi).
Uygulamada verilen iki ek karar:
- Cevap anahtarında (PDF/Word) cevap görseli olan soruda sorunun görseli ayrıca basılmaz (aynı çizim iki kez çıkardı).
- Cevap görseli, soru görselinden farklı bir kural metni alır ("doğru cevabı göster"); soru görselindeki
  "şekil soruyu çözmesin" yasağı yalnız soru görseline gider (svgPromptRules.ts).
Bu bölümdeki kuralların hiçbiri atlanmamalı.

### Amaç

Çizim isteyen klasik sorularda cevap anahtarında doğru çizim de görünsün. Örnekler: "sayı doğrusunda
işaretleyiniz", "grafiği tamamlayınız", "Venn şemasına yerleştiriniz", "açıyı çiziniz".

Asıl kazanç, şu an düzgün üretilemeyen "doldurmalı" soru tipi:
- Soruda boş çerçeve olur (boş sayı doğrusu, ızgara, grafik).
- Öğrenci üstünü doldurur.
- Cevap anahtarında dolu hâli görünür.

### Artılar

1. Yeni soru tipini açar: MEB yazılılarında sık çıkan "gösteriniz / tamamlayınız" soruları.
2. Öğretmen daha kolay puanlar. Çizim cevabını yazıyla tarif etmek zayıf kalıyor.
3. Üretim maliyeti yok. Cevap görsel prompt'u, soruyu üreten AI çağrısında yazılır.
4. Yayını bekletmez. Soru yazılı cevabıyla hemen yayına girer, görsel sonra gelir.
5. Daha az el emeği. Cevap görseli sorunun görselinden türetilir, sıfırdan çizilmez.

### Eksiler

1. Elle SVG işi artar. Yalnız çizim isteyen sorularda, ama 11 Kasım'a kadarki zamandan yer.
2. AI alanı gereğinden çok doldurabilir. Bir kısmı gereksiz çıkar, admin temizler.
3. Çizimde cevap hatası daha zor fark edilir. Her cevap görseli kontrol edilmeli.
4. Sıra bağımlılığı var. Sorunun görseli girilmeden cevabın görseli üretilemez.
5. Kalıcı karmaşıklık artar:
   - Veritabanında 2 alan.
   - SVG sayfasında ikinci bir iş türü.
   - Düzenleme penceresinde 2 alan.
   - PDF cevap anahtarı uzar.
6. Mevcut sorular yararlanmaz. Yalnız yeni üretimler prompt alır; eskilere elle eklenir.

Hüküm: artılar ağır basıyor. En büyük eksi (elle iş) yalnız gerçekten çizim isteyen sorularda doğuyor.

### Kesin kurallar

1. **Yayını bekletmez.**
   - Cevap görseli bekleyen soru yayında kalır (`is_active` etkilenmez).
   - Havuz sayımına girer.
   - Bugünkü "soru görseli bekleyen → taslak" kuralı yalnız soru görseli için geçerli kalır.
2. **AI yalnız çizim isteyen sorularda yazar.**
   - Soru metninde şunlardan biri geçmeli: "işaretleyiniz", "çiziniz", çizimle "gösteriniz",
     "yerleştiriniz", "tamamlayınız".
   - "Göster" kanıtla anlamındaysa prompt yazılmaz. Örnek: "56'nın 7'nin katı olduğunu gösteriniz"
     sorusu PROMPT ALMAZ.
3. **Cevap görseli sorunun görselinden türetilir.**
   - Sorunun SVG'si varsa, cevap prompt'u onu temel alır: "Bu çizimi aynen koru (ölçek, renk, sayılar),
     yalnız cevabı işaretle."
   - Sorunun görseli yoksa (ör. "bir dikdörtgen çiziniz") cevap görseli tek başına üretilir.
4. **Yazılı cevap her zaman zorunlu.**
   - `model_answer` esas kaynak olarak kalır.
   - Görsel yalnız destektir; görseli olmayan soru da geçerlidir.
5. **Tek doğru çizim yoksa** (karar a):
   - Görselin üstünde "Örnek cevap" yazar.
   - Yazılı cevapta "başka doğru çizimler de kabul edilir" denir.
   - Örnek soru: "alanı 12 olan bir dikdörtgen çiziniz".
6. **Boş çerçeve öğrenci kağıdında basılır** (karar b).
   - Öğrencinin üstüne çizeceği çerçeve sorunun görselidir.
   - PDF öğrenci kağıdında da çıkar; yoksa soru kağıtta cevaplanamaz.
7. **Cevap görseli her yerde gösterilir:**
   - PDF cevap anahtarında.
   - Sitede "Cevabı göster" altında, diğer cevaplarla aynı yerde.

### Uygulama listesi

Bu oturumda dosyalar incelendi, ilgili yerler bunlar.

1. **Migration**
   - `question_classical`'a `answer_svg_prompt text` ve `answer_svg_content text` eklenecek.
   - Kullanıcı onayıyla Management API'den çalıştırılacak.
2. **AI prompt'u**
   - `app/prompt/39-exam-topic-classical-questions.md` ile `app/prompt/_svg-question-fragment.md`
     (prompt'u `app/api/admin/yazili/prompt/route.ts` birleştiriyor) güncellenecek.
   - JSON'a `answer_svg_prompt` alanı eklenecek.
   - Kural 2 ve kural 5 prompt'a yazılacak.
3. **Ayrıştırma ve kayıt**
   - `app/src/lib/parseMixedQuestions.ts`: `ParsedClassical`'a `answer_svg_prompt` eklenecek.
   - `app/src/lib/questionInsert.ts`: alan `question_classical`'a yazılacak.
4. **"1 · Kontrol et" önizlemesi** (`app/src/components/admin/YaziliPanel.tsx`)
   - Soru metninde kural 2'deki fiiller yokken `answer_svg_prompt` dolu gelirse uyarı göster.
   - Tek tıkla prompt'u kaldırma imkânı olsun.
5. **SVG Soruları sayfası** (`app/src/components/admin/SvgQuestionsPanel.tsx`,
   `app/api/admin/svg-questions/route.ts`)
   - "Cevap görseli" iş türü eklenecek (ayrı sekme ya da filtre).
   - Sorunun görseli yoksa ve soru prompt'u da varsa (soru görseli bekleniyorsa) "Kopyala" kapalı kalır,
     "Önce soru görseli" yazar.
   - Kopyalanan prompt'a sorunun SVG kodu gömülür (kural 3). Üretici `app/src/lib/svgPromptRules.ts`
     yanında yeni bir fonksiyon.
   - Kaydetmek `is_active`'e dokunmaz (kural 1).
6. **Düzenleme penceresi** (`app/src/components/admin/QuizQuestionEditModal.tsx`,
   GET/PATCH `app/api/admin/manage/questions/route.ts`)
   - Cevap görsel prompt'u ve SVG alanı eklenecek.
   - SVG için önizleme.
   - PATCH'te SVG doğrulaması, soru SVG'siyle aynı kurallarla.
7. **Herkese açık sayfa** (`app/yazili-sorulari/[sinif]/[ders]/[yazili]/page.tsx`,
   `app/src/lib/yazili/publicData.ts`)
   - "Cevabı göster" içinde, Cevap satırının altında `YaziliSvg`.
8. **PDF** (`app/src/lib/yazili/paperPdfHtml.ts`)
   - Cevap anahtarında görsel gösterilecek.
   - Öğrenci kağıdında soru görseli zaten var (kural 6).
   - Uzun cevap anahtarı sayfa bölünmesine dikkat edilmeli.
9. **Eksik sayımı**
   - Admin'e "N cevap görseli bekliyor" bilgisi verilecek, ama yalnız bilgi: yayını ve havuzu etkilemez.
10. **Doğrulama**
    - Çizim isteyen bir [TEST] soru kaydedilecek, cevap görseli sırasıyla eklenecek.
    - Kontrol edilecekler: site, A kağıdı ve cevap anahtarı PDF'i, misafir/admin görünümü.
    - Test verisi sonunda silinecek.

## Sonraya bırakılanlar

- Worker ile otomatik Gemini üretimi (manuel kalite oturunca aynı prompt bağlanır).
- 3. örnek kağıt.
- 6. Türkçe yazılıları (önce soru altyapısı tamamlanmalı).
