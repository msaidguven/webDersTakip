Ayrıca, TÜM alt başlıklar tamamlandıktan sonra, konunun geneline ait TEK bir özet ve TEK bir tartışma sorusu üret (JSON'un en üst seviyesinde, "sections" listesinin DIŞINDA, "cover" ile aynı hizada):

1. **summary_markdown — Konu Özeti.** Tüm alt başlıkların en önemli/ezberlenecek somut bilgisi (tanım/sayı/formül), TEK listede.
   - Format: `- **Terim**: Tanım cümlesi.` GERÇEK/TAM cümle (çekimli fiil veya -dır/-dir, MUTLAKA nokta) — yarım/asılı bırakma, kendi başına bitmiş cümle olsun. ~10-16 kelime ama eksik bırakma.
   - Alt başlığa göre gruplama/başlık YAZMA — tek düz liste.
   - Madde sayısı kapsama göre (genelde 6-14) — her alt başlıktan en az bir madde, gereksiz ayrıntı yok.
   - Terim = kısa isim tamlaması (max 2-4 kelime), ASLA yan cümle. Öncül gerektiren zamir ("bu/bunlar/yukarıdaki") kullanma. Terim "Fark/Kullanım alanları/Örnek/Avantaj/Dezavantaj" gibi TEK BAŞINA jenerik OLMASIN — bu bilgiyi ilgili terimin kendi tanımına kat.
2. **discussion_prompt_markdown — Düşün ve Yorumla.** TEK doğrusu olmayan, tartışmaya açık soru.
   - Açık uçlu: kişisel görüş/değerlendirme/günlük hayat bağlantısı, "sence hangisi daha önemli/doğru" tarzı — kapalı/kesin cevaplı sınav sorusu DEĞİL.
   - TEK kısa soru cümlesi ("Sence.../Sen olsan..." gibi başlayabilir).
   - Konu mekanik/tartışmaya elverişsizse bile günlük hayata/kişisel deneyime bağlayan bir soru bulmaya çalış — uydurma hissettirmesin.
