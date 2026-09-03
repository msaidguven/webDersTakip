-- Geriye dönük veri düzeltmesi (kullanıcı bildirimi, 2026-09-04): comment_id mimarisi
-- devreye girmeden ÖNCE sorulmuş AI sorularının (rag_answers, parent_comment_id boş)
-- soru kısmı hiçbir zaman ayrı bir question_comments satırı olarak var olmadı — bu
-- yüzden ör. "Yorumlar (N)" sayacı bu tür eski kayıtları 2 değil 1 sayıyordu (soru
-- görünmeden sadece cevap vardı). Bu migration her eski rag_answers satırı için
-- soru metnini bir question_comments satırı olarak GERİYE DÖNÜK oluşturup
-- rag_answers.parent_comment_id'yi ona bağlıyor — tıpkı bugünden itibaren
-- /api/rag/ask'ın yeni sorular için yaptığı gibi.
--
-- İdempotent: zaten doğru şekilde bağlı satırları (parent_comment_id'nin işaret ettiği
-- yorum aynı öğrenciye/kapsama ait VE @hocam/@kanka ile başlıyorsa — bu imza sadece bu
-- akıştan gelen yorumlarda olur, çünkü "@hocam"/"@kanka" içeren her mesaj normalde
-- hiç düz yorum olarak kaydedilmez, doğrudan AI akışına gider) NOT EXISTS ile atlıyor,
-- bu yüzden birden fazla kez çalıştırılması güvenli.
do $$
declare
  r record;
  new_comment_id bigint;
  tag text;
begin
  for r in
    select ra.id, ra.student_id, ra.question, ra.model, ra.quiz_question_id, ra.unit_id, ra.created_at,
           ra.parent_comment_id as old_parent_comment_id,
           ra.parent_rag_answer_id as old_parent_rag_answer_id
    from public.rag_answers ra
    where ra.status <> 'deleted'
      and not exists (
        select 1 from public.question_comments qc
        where qc.id = ra.parent_comment_id
          and qc.student_id = ra.student_id
          and qc.question_id is not distinct from ra.quiz_question_id
          and qc.unit_id is not distinct from (case when ra.quiz_question_id is null then ra.unit_id else null end)
          and (qc.body like '@hocam %' or qc.body like '@kanka %')
      )
  loop
    -- quiz_question_id VE unit_id ikisi de boşsa question_comments'in scope check
    -- kısıtını ihlal eder (biri dolu olmalı) — teorik bir uç durum, atla.
    if r.quiz_question_id is null and r.unit_id is null then
      continue;
    end if;

    tag := case when r.model like '%kanka%' then '@kanka ' else '@hocam ' end;

    insert into public.question_comments (student_id, body, status, question_id, unit_id, parent_comment_id, parent_ai_answer_id, created_at)
    values (
      r.student_id,
      tag || r.question,
      'published',
      r.quiz_question_id,
      case when r.quiz_question_id is null then r.unit_id else null end,
      r.old_parent_comment_id,
      r.old_parent_rag_answer_id,
      r.created_at
    )
    returning id into new_comment_id;

    -- Yeni mimaride cevabın nesting'i sadece parent_comment_id üzerinden — eski
    -- parent_rag_answer_id artık yeni oluşturulan yorumun kendi parent_ai_answer_id'sine
    -- taşındı (yukarıda), burada temizlenmezse repliesOfAi() bu satırı YANLIŞLIKLA
    -- iki farklı yerde (hem yeni yorumun altında hem eski hedefin altında) gösterebilirdi.
    update public.rag_answers
    set parent_comment_id = new_comment_id, parent_rag_answer_id = null
    where id = r.id;
  end loop;
end $$;
