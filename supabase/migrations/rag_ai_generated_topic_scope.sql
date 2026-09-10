-- Kitapsız ders akışı değişti: admin artık 2-3 farklı AI'ın bağımsız ürettiği kaynak
-- metinlerinin HER BİRİNİ ayrı ayrı DB'ye kaydediyor (source='ai_generated'), sonra
-- hepsini TEK TIKLAMAYLA kopyalayıp sentez prompt'uyla birlikte 4. bir AI'a veriyor,
-- dönen sonucu kaydedince ham taslaklar silinip yerine tek bir "sentez" kaydı kalıyor
-- (2026-09-10 kullanıcı talebi). Bunun için üç yeni sütun gerekiyor:
--
-- 1) topic_id: hangi taslakların hangi KONUYA ait olduğunu unit_id+title eşleşmesinden
--    daha güvenilir bulmak için (rag_documents şu ana kadar sadece ünite bazlıydı).
-- 2) raw_text: chunk'lardan (örtüşmeli parçalardan) geri birleştirmek yerine orijinal
--    metni bozulmadan saklamak için — sentez prompt'una TAM ve doğru halini vermek gerekiyor.
-- 3) is_synthesis: bir kaydın "ham taslak" mı yoksa "birden fazla taslağın birleştirilmiş
--    nihai hali" mi olduğunu ayırt etmek için — sentez kaydedilince ham taslaklar
--    (is_synthesis=false olanlar) silinecek.
alter table public.rag_documents
  add column if not exists topic_id bigint references public.topics(id),
  add column if not exists raw_text text,
  add column if not exists is_synthesis boolean not null default false;

-- Bu migration'dan ÖNCE (topic_id/raw_text sütunları yokken) kaydedilmiş ai_generated
-- kayıtlarını geriye dönük doldur — admin'in az önce elle kaydettiği 4 taslak kaybolmasın.
-- topic_id: title + unit_id eşleşmesiyle bulunuyor (o tarihte tek kaynak title'ı hep
-- topic.title'dı). raw_text: chunk'ları chunk_index sırasına göre birleştirerek — chunking
-- ~100 token'lık bindirme yaptığından sınırlarda küçük tekrarlar olabilir ama sentez
-- prompt'u (19-rag-topic-source-synthesis.md) zaten tekrarları elemesi için tasarlandı.
update public.rag_documents rd
set topic_id = t.id
from public.topics t
where rd.source = 'ai_generated'
  and rd.topic_id is null
  and t.unit_id = rd.unit_id
  and t.title = rd.title;

update public.rag_documents rd
set raw_text = sub.joined
from (
  select document_id, string_agg(content, E'\n\n' order by chunk_index) as joined
  from public.rag_document_chunks
  group by document_id
) sub
where rd.id = sub.document_id
  and rd.source = 'ai_generated'
  and rd.raw_text is null;
