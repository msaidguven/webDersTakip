-- TYMM'den aktarılan bir konunun bağlı olduğu resmi "öğrenme çıktısı" metnini (ör.
-- "DKAB.6.1.1. Peygamberlerin insanlara rehber olarak gönderilmesi hakkında bilgi
-- toplayabilme") ayrı tutar. topics.title artık İçerik Çerçevesi'ndeki kısa başlığı
-- taşıyor (ör. "İnsanlara Rehber: Peygamber") — ikisi farklı amaçlara hizmet ediyor.
alter table topics add column if not exists learning_outcome text;
