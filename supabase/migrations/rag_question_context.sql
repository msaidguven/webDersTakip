-- Test sayfasındaki "neden A" tarzı bağlamsız sorular için, öğrencinin baktığı
-- test sorusunun (kökü+şıklar+doğru cevap) düz metin özeti burada saklanır —
-- admin bir bildirimi incelerken hangi soru bağlamında sorulduğunu görebilsin.
alter table public.rag_answers add column if not exists question_context text;
