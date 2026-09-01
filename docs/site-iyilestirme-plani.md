# Site İyileştirme — Bekleyen İşler

> Konuşulduğu tarih: 2026-09-01. Bu dosya artık sadece bekleyen/gelecek işleri tutuyor — tamamlanan ilk üç madde (giriş/kayıt akışı, panel gerçek veri, günlük döngü/streak + sosyal sıralama) buradan kaldırıldı.

## Referans tasarım karşılaştırması (2026-09-01)

Kullanıcı "EğitimApp" adlı örnek bir panel tasarımı paylaştı. Karşılaştırma sonucunda şunlar **hemen yapıldı**:
- Profil sayfasına panelle aynı Sidebar + TopBar kabuğu eklendi (`PanelShell.tsx`), panel ⟷ profil arası geçiş artık kendi menüsü üzerinden.
- Global header'ın panel/profil sayfalarının üstüne binip çift navigasyon çubuğu oluşturduğu bir hata bulunup düzeltildi (`MainLayout.tsx`, `hideHeader`).
- Sidebar'daki "Ana Sayfa" artık `/panel`'e gidiyor (önceden genel siteye gidip kafa karıştırıyordu); genel siteye dönüş ayrı bir "Siteye Dön" linkiyle yapılıyor.

Aşağıdakiler ise **kapsamı büyük olduğu için ertelendi** — hangisiyle başlanacağı ayrıca konuşulmalı, hiçbiri şu an istenmedi:

1. **Çoklu ders özeti** — referans görselde tek ünite listesi değil, sınıftaki TÜM derslerin (Matematik/Türkçe/Fen/Sosyal/İngilizce...) her biri için ayrı bir ilerleme kartı var. Panelimiz şu an sadece kullanıcının en son çalıştığı tek dersi gösteriyor. Gerekli: sınıftaki tüm dersleri listeleyip her biri için `units` + `user_unit_summary`'den ilerleme yüzdesi hesaplamak.
2. **Konu bazlı "Devam Edilen Konular" detayı** — referans görsel aktif ünitenin içindeki konuları tek tek, durumlarıyla (tamamlandı/kilitli/devam ediyor) ve "Konu Anlatımı"/"Soru Çöz" butonlarıyla gösteriyor. Şemada bunun için `user_topic_content_progress` tablosu zaten var ama hiç kullanılmadı.
3. **Haftalık performans grafiği** (Pzt–Paz çizgi grafik) — projede şu an hiçbir chart kütüphanesi yok, önce bir bağımlılık kararı (recharts/chart.js vb.) gerekiyor.
4. **"Bu Haftanın Planı" — kişisel haftalık çalışma programı** — hangi gün hangi ders/konu çalışılacağını gösteren bir program. Otomatik mi üretilecek (müfredat hızına göre) yoksa kullanıcı mı elle düzenleyecek, netleşmesi gereken ayrı bir tasarım kararı.
5. **Yeni sayfalar (şu an hiçbiri yok)**: Denemeler (deneme sınavları), Rozetlerim (başarım/rozet sistemi), Favorilerim (favori soru işaretleme — DB'de karşılık gelen bir tablo yok), Raporlarım (mevcut `/progress`'in genişletilmiş hali olabilir), Ayarlar (hesap ayarları sayfası), Takvimim (kişisel takvim — sadece `/admin/takvim` var, o da müfredat takvimi ayarlamak için, kişisel değil).
6. **XP/seviye sistemi** (görselde "1260/2000 XP") — streak'ten ayrı, yeni bir puan/seviye (gamification) katmanı, yeni şema gerektirir.
7. **Hızlı Erişim kısayolları** (Ünite Seç, Konu Seç, Soru Bankası, Favori Sorularım) — çoğu yukarıdaki maddelere (özellikle 2 ve 5) bağlı, onlar bittikçe eklenebilir.

## Diğer notlar
- Liderlik tablosunda takma ad (`profiles.username`) gösteriliyor ama profil sayfasından hâlâ düzenlenemiyor — bu yüzden çoğu kullanıcı şimdilik "Öğrenci" olarak görünecek. İstenirse `/profil`'e bir kullanıcı adı alanı eklenebilir.
