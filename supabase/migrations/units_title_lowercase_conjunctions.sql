-- Ünite adlarında bağlaçlar küçük harf (2026-10-03): "Güneş Sistemi Ve Tutulmalar" →
-- "Güneş Sistemi ve Tutulmalar". 89 ünitenin 32'si etkileniyordu; başlık, breadcrumb ve
-- Google sonuçlarında görünüyordu. Yalnız kelime ortasındaki bağlaçlar (baştaki kelimeye
-- dokunulmaz). Slug'lar değişmez → URL'ler aynı kalır.

update public.units
set title = regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(title, ' Ve ', ' ve ', 'g'),
                ' İle ', ' ile ', 'g'),
              ' Ya Da ', ' ya da ', 'g'),
            ' Veya ', ' veya ', 'g'),
    updated_at = now()
where title ~ ' (Ve|İle|Ya Da|Veya) ';
