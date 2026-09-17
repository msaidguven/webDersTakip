Her alt başlık için İKİ metin (amaçları farklı) + konu sonunda TEK özet + TEK tartışma sorusu.

YASAK (hepsinde): kaynak/dipnot referansı ("[2,4]", "¹" vb.), kitapta geçse bile.

1. **explanation_markdown — Konu Anlatımı.** TAM/DETAYLI ders notu (kısa özet ayrı, summary_markdown'da). Telefonda taranabilecek kısa bloklar, ama derinlik tam. Sohbet metni DEĞİL, duvar paragraf da DEĞİL. {grade} seviyesine uygun sade dil.
   - Yapı: `### Terim` → 1-3 cümlelik paragraf(lar) → gerekirse örnek/madde → sonraki başlık. Birden fazla terim/aşama varsa mini başlıklarla böl; tek kavramsa yine 2-4 kısa paragraf.
   - HER paragraf 1-3 cümle, asla duvar paragraf. Birden fazla fikir → ayrı paragraflar. Gerçek `\n\n` ile ayır.
   - Terimi ilk geçtiği yerde **kalın** (tekrar etme); nüans için *italik* (az).
   - Madde listesi sadece gerçekten daha anlaşılırsa; çoğu bilgi paragraf kalsın.
   - Somut ol (sayı/isim/tarih/mekanizma), genel-geçer cümle yazma; günlük hayattan kısa örnek olabilir. YASAK: retorik soru, "sen/senin" hitabı, hikâye, "Yani.../Kısacası..." kapanışı.
   - TOPLAM UZUNLUĞU KISALTMA: müfredat bilgisini "kısa olsun" diye çıkarma — konu genişse gereken kadar başlık/paragraf kullan. Kısıtlama paragraf uzunluğu, toplam uzunluk DEĞİL. Bilgi uydurma; SEO dolgusu ekleme.
2. **activity_prompt_markdown + activity_example_markdown — düşünme etkinliği.** Deftere kopyalamak değil, ÜZERİNDE DÜŞÜNMEK; yazı gerektirmez. Önce kendi kafasında düşünür, sonra "Örneğe Bak"la örneği görür.
   - prompt: konuya EN UYGUN TEK çerçeve (hepsini denemeye çalışma):
     "Düşün:" kapalı çıkarım · "Hayal Et:" sahne canlandırma · "Dene:" fiziksel/pratik deneme · "Sen Olsan?" karar/değer boyutu (sosyal/ahlaki/kişisel) · "Karşılaştır:" karıştırılan İKİ+ terim, farkı kendi cümlesiyle · "Günlük Hayattan Bul:" soyut kavrama kendi çevresinden örnek.
     Konuyla DOĞRUDAN ilgili, somut bağlam — soyut/genel soru sorma. 1-3 cümle.
   - example: istemi yanıtlayan KISA (2-4 cümle) örnek. Tek doğru gibi sunma (özellikle "Sen Olsan?"/"Günlük Hayattan Bul"da tek doğru yok), ama tutarlı/doğru olsun; retorik soru/"sen/senin" yerine doğrudan dil.
   - Her alt başlıkta MUTLAKA etkinlik olsun; aynı çerçeveyi art arda kullanma, çeşitlendir.
3. **summary_markdown (JSON üst seviye, konu için TEK SEFER) — Konu Özeti.** Tüm alt başlıkların en önemli/ezberlenecek somut bilgisi (tanım/sayı/formül), TEK listede.
   - Format: `- **Terim**: Tanım cümlesi.` GERÇEK/TAM cümle (çekimli fiil veya -dır/-dir, MUTLAKA nokta) — yarım/asılı bırakma, kendi başına bitmiş cümle olsun. ~10-16 kelime ama eksik bırakma.
   - Alt başlığa göre gruplama/başlık YAZMA — tek düz liste.
   - Madde sayısı kapsama göre (genelde 6-14) — her alt başlıktan en az bir madde, gereksiz ayrıntı yok.
   - Terim = kısa isim tamlaması (max 2-4 kelime), ASLA yan cümle. Öncül gerektiren zamir ("bu/bunlar/yukarıdaki") kullanma. Terim "Fark/Kullanım alanları/Örnek/Avantaj/Dezavantaj" gibi TEK BAŞINA jenerik OLMASIN — bu bilgiyi ilgili terimin kendi tanımına kat.
4. **discussion_prompt_markdown (JSON üst seviye, konu için TEK SEFER) — Düşün ve Yorumla.** TEK doğrusu olmayan, tartışmaya açık soru.
   - Açık uçlu: kişisel görüş/değerlendirme/günlük hayat bağlantısı, "sence hangisi daha önemli/doğru" tarzı — kapalı/kesin cevaplı sınav sorusu DEĞİL.
   - TEK kısa soru cümlesi ("Sence.../Sen olsan..." gibi başlayabilir).
   - Konu mekanik/tartışmaya elverişsizse bile günlük hayata/kişisel deneyime bağlayan bir soru bulmaya çalış — uydurma hissettirmesin.
