# Site İyileştirme Fikirleri (Özet)

> Bu bir karar/plan taslağıdır, henüz uygulanmadı. Konuşulduğu tarih: 2026-09-01.

## 1. Giriş (Login/Register)
- Şu an jenerik bir email/şifre formu ([app/login/page.tsx](../app/login/page.tsx)), öğrenci kitlesine özgü bir his vermiyor.
- Fikir: Kayıt akışına sınıf/ders seçimini erken sok, ilk girişte boş bir dashboard yerine "bugün ne çalışacaksın" sorusuna götür.

## 2. Tasarım / Panel
- [app/panel/page.tsx](../app/panel/page.tsx) hâlâ mock veri üzerinde ("Ali", `mockData`'dan `navItems`) — gerçek kullanıcı deneyimi henüz test edilmedi.
- SRS (aralıklı tekrar) widget'ı güçlü bir ayırt edici özellik ama sayfanın ortasında kayboluyor; öne çıkarılmalı.
- Streak/stats/activity feed var ama ödül anı zayıf — sadece sayı gösteriyor, "başarı" hissi yaratmıyor.

## 3. Kullanıcının Sitede Vakit Geçirmesi
- Asıl eksik: net bir günlük döngü (loop) yok.
- Fikirler:
  - Girişte tek net CTA: "bugünkü görev" (örn. 5 soru, 1 ünite tekrarı).
  - Streak kaybetme korkusu (Duolingo tarzı mekanik).
  - Haftalık ilerlemede hafif bir sosyal katman (arkadaş/sınıf karşılaştırması).

## Sıradaki Adım
Yukarıdakilerden biri seçilip somut bir tasarım/akış (wireframe, sayfa akışı) haline getirilecek.
