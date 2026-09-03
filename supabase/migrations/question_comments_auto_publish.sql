-- Kullanıcı isteği (2026-09-04): yorumlar artık AI soru-cevabı gibi moderasyon
-- beklemeden anında yayınlansın ("hemen yayınlansın") — ama admin panelden hâlâ
-- geriye dönük "İncelendi" olarak işaretlenebilsinler ("kontrolümden 1 defa geçecek"),
-- bu YAYIN durumunu değil sadece admin'in görüp göz attığını kaydeden ayrı bir
-- adım. Var olan reviewed_by/reviewed_at kolonları bu iz için zaten uygun —
-- publish/reject akışının dışında, sadece "işaretle" amacıyla yeniden kullanılıyor
-- (bkz. /api/admin/all-comments/[id]'deki yeni 'review' action'ı).
alter table public.question_comments alter column status set default 'published';
