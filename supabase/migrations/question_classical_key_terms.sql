-- question_classical.answer_words hiç kullanılmıyordu (admin panelinden hep boş dizi
-- gönderiliyordu, hiçbir yerde okunmuyordu) — öğretmen paneli için AI ile klasik/açık
-- uçlu soru üretimi kurulurken bu alanı gerçek bir amaca kavuşturuyoruz: cevapta
-- geçmesi beklenen anahtar kavramlar, öğretmenin elle değerlendirirken hızlı referans
-- alması için. Veri kaybı yok (sütun zaten boştu), sadece isim/anlam netleşiyor.
ALTER TABLE public.question_classical
  RENAME COLUMN answer_words TO key_terms;
