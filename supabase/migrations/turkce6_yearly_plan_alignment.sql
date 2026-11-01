-- 6. Sınıf Türkçe'yi MEB 2026-2027 taslak çerçeve yıllık planına birebir hizalama (2026-10-31, kullanıcı kararı:
-- "resmiyete birebir uysun"). Plan tema bazlı: Dilimizin Zenginliği 1-6, Bağımsızlık Yolu 6-12, Farklı Dünyalar
-- 13-18, İletişim ve Sosyal İlişkiler 19-25, Bilim ve Teknoloji 25-30, Lider Ruhlar 30-36. hafta (37 sosyal etkinlik).
-- Kazanım metinleri DEĞİŞMEZ; yalnız konunun ünitesi, haftası ve ünite içi sırası.
--   Ünite değişen (öğrenme çıktısı kodu plandaki temaya göre):
--     942 Hikâye Unsurları (T.D.6.13, T.O.6.14)      Bağımsızlık Yolu   → Bilim ve Teknoloji
--     943 Söz Sanatları (T.D.6.18, T.O.6.20)         Bağımsızlık Yolu   → Bilim ve Teknoloji
--     954 Öznel ve Nesnel Yargı (T.D.6.12, T.O.6.13) Farklı Dünyalar    → İletişim ve Sosyal İlişkiler
--     957 Açık ve Örtük Anlam (T.K.6.23, T.Y.6.19)   İletişim           → Bilim ve Teknoloji
--     962 Biyografi ve Otobiyografi (T.O.6.17)       Lider Ruhlar       → Farklı Dünyalar
--   Tema dışına taşan haftalar temaya çekildi (946 13→10-11, 952 19→18, 958/959/960 30/31/33→28/29/30,
--   962 37→13, 954 16→19-20, 942/943 7/8→26/27); her ünitede sıra = hafta sırası.
-- Taşınan konuların eski adresleri app/src/lib/legacyRedirects.ts MOVED_TOPICS'te (308). Bu SQL kodla aynı anda
-- (push ile) canlıya çıkmalı: yalnız SQL çalışırsa eski adresler push'a kadar 404 verir.
begin;

-- (unit_id, order_no) benzersiz: önce 28 konuyu geçici sıraya al.
update public.topics set order_no = order_no + 1000 where id in (935, 936, 937, 938, 939, 940, 941, 942, 943, 944, 945, 946, 947, 948, 949, 950, 951, 952, 953, 954, 955, 956, 957, 958, 959, 960, 961, 962);

update public.topics set unit_id = 1626, order_no = 1 where id = 937;
update public.topics set unit_id = 1626, order_no = 2 where id = 939;
update public.topics set unit_id = 1626, order_no = 3 where id = 935;
update public.topics set unit_id = 1626, order_no = 4 where id = 938;
update public.topics set unit_id = 1626, order_no = 5 where id = 936;
update public.topics set unit_id = 1626, order_no = 6 where id = 940;
update public.topics set unit_id = 1627, order_no = 1 where id = 944;
update public.topics set unit_id = 1627, order_no = 2 where id = 941;
update public.topics set unit_id = 1627, order_no = 3 where id = 946;
update public.topics set unit_id = 1627, order_no = 4 where id = 945;
update public.topics set unit_id = 1628, order_no = 1 where id = 962;
update public.topics set unit_id = 1628, order_no = 2 where id = 950;
update public.topics set unit_id = 1628, order_no = 3 where id = 947;
update public.topics set unit_id = 1628, order_no = 4 where id = 953;
update public.topics set unit_id = 1628, order_no = 5 where id = 949;
update public.topics set unit_id = 1628, order_no = 6 where id = 948;
update public.topics set unit_id = 1628, order_no = 7 where id = 951;
update public.topics set unit_id = 1628, order_no = 8 where id = 952;
update public.topics set unit_id = 1629, order_no = 1 where id = 954;
update public.topics set unit_id = 1629, order_no = 2 where id = 956;
update public.topics set unit_id = 1629, order_no = 3 where id = 955;
update public.topics set unit_id = 1630, order_no = 1 where id = 957;
update public.topics set unit_id = 1630, order_no = 2 where id = 942;
update public.topics set unit_id = 1630, order_no = 3 where id = 943;
update public.topics set unit_id = 1630, order_no = 4 where id = 958;
update public.topics set unit_id = 1630, order_no = 5 where id = 959;
update public.topics set unit_id = 1630, order_no = 6 where id = 960;
update public.topics set unit_id = 1631, order_no = 1 where id = 961;

-- Haftalar: konunun bütün kazanımları aynı aralıkta (her kazanımın tek outcome_weeks satırı var).
update public.outcome_weeks w set start_week = 1, end_week = 1 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 937 and (w.start_week, w.end_week) is distinct from (1, 1);
update public.outcome_weeks w set start_week = 2, end_week = 2 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 939 and (w.start_week, w.end_week) is distinct from (2, 2);
update public.outcome_weeks w set start_week = 3, end_week = 4 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 935 and (w.start_week, w.end_week) is distinct from (3, 4);
update public.outcome_weeks w set start_week = 3, end_week = 4 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 938 and (w.start_week, w.end_week) is distinct from (3, 4);
update public.outcome_weeks w set start_week = 5, end_week = 5 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 936 and (w.start_week, w.end_week) is distinct from (5, 5);
update public.outcome_weeks w set start_week = 5, end_week = 6 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 940 and (w.start_week, w.end_week) is distinct from (5, 6);
update public.outcome_weeks w set start_week = 7, end_week = 7 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 944 and (w.start_week, w.end_week) is distinct from (7, 7);
update public.outcome_weeks w set start_week = 8, end_week = 9 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 941 and (w.start_week, w.end_week) is distinct from (8, 9);
update public.outcome_weeks w set start_week = 10, end_week = 11 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 946 and (w.start_week, w.end_week) is distinct from (10, 11);
update public.outcome_weeks w set start_week = 12, end_week = 12 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 945 and (w.start_week, w.end_week) is distinct from (12, 12);
update public.outcome_weeks w set start_week = 13, end_week = 13 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 962 and (w.start_week, w.end_week) is distinct from (13, 13);
update public.outcome_weeks w set start_week = 14, end_week = 14 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 950 and (w.start_week, w.end_week) is distinct from (14, 14);
update public.outcome_weeks w set start_week = 15, end_week = 15 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 947 and (w.start_week, w.end_week) is distinct from (15, 15);
update public.outcome_weeks w set start_week = 15, end_week = 15 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 953 and (w.start_week, w.end_week) is distinct from (15, 15);
update public.outcome_weeks w set start_week = 16, end_week = 16 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 949 and (w.start_week, w.end_week) is distinct from (16, 16);
update public.outcome_weeks w set start_week = 17, end_week = 17 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 948 and (w.start_week, w.end_week) is distinct from (17, 17);
update public.outcome_weeks w set start_week = 18, end_week = 18 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 951 and (w.start_week, w.end_week) is distinct from (18, 18);
update public.outcome_weeks w set start_week = 18, end_week = 18 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 952 and (w.start_week, w.end_week) is distinct from (18, 18);
update public.outcome_weeks w set start_week = 19, end_week = 20 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 954 and (w.start_week, w.end_week) is distinct from (19, 20);
update public.outcome_weeks w set start_week = 22, end_week = 22 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 956 and (w.start_week, w.end_week) is distinct from (22, 22);
update public.outcome_weeks w set start_week = 23, end_week = 23 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 955 and (w.start_week, w.end_week) is distinct from (23, 23);
update public.outcome_weeks w set start_week = 25, end_week = 25 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 957 and (w.start_week, w.end_week) is distinct from (25, 25);
update public.outcome_weeks w set start_week = 26, end_week = 26 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 942 and (w.start_week, w.end_week) is distinct from (26, 26);
update public.outcome_weeks w set start_week = 27, end_week = 27 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 943 and (w.start_week, w.end_week) is distinct from (27, 27);
update public.outcome_weeks w set start_week = 28, end_week = 28 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 958 and (w.start_week, w.end_week) is distinct from (28, 28);
update public.outcome_weeks w set start_week = 29, end_week = 29 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 959 and (w.start_week, w.end_week) is distinct from (29, 29);
update public.outcome_weeks w set start_week = 30, end_week = 30 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 960 and (w.start_week, w.end_week) is distinct from (30, 30);
update public.outcome_weeks w set start_week = 35, end_week = 35 from public.outcomes o where o.id = w.outcome_id and o.topic_id = 961 and (w.start_week, w.end_week) is distinct from (35, 35);

commit;
