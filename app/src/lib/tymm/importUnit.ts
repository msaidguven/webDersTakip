// app/src/lib/tymm/importUnit.ts
// TYMM'den ÇEKİLMİŞ (ve admin tarafından elle düzeltilmiş olabilecek) bir ünite verisini
// DB'ye YAZAR — kendisi hiçbir ağ isteği yapmaz. Fetch (TYMM'den çekme) ve save (DB'ye
// yazma) bilerek ayrı tutuluyor: admin önce içeriği önizler/düzeltir, sonra elle onaylayıp
// kaydeder — hiçbir şey admin onayı olmadan DB'ye yazılmaz (bkz. proje sohbeti: aynı ünite
// farklı curriculum_year değerleriyle iki kez otomatik kaydedilince mükerrer kayıt oluşmuştu).

import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { slugify } from '@/app/src/lib/yillikPlan/importer';
import { normUnitTitleForMatch, stripUnitTitleNumberPrefix, fuzzyNorm } from './compareUnits';
import type { TymmUnit } from './tymmParser';

type UnitRow = { id: number; order_no: number };
type TopicRow = { id: number };

export type SaveTymmUnitParams = {
  unit: TymmUnit;
  gradeId: number;
  lessonId: number;
  curriculumYear: string | null;
  // Yeni parse edilen bir kazanım metnini (comp.text), admin'in önizlemede elle seçtiği ESKİ
  // bir kazanım id'sine bağlar — otomatik fuzzy eşleşme "1-2 kelime değişti, farklı kazanım"
  // sanıp yeni satır açabileceği durumlar için (kullanıcının 2026-09-22 isteği: "ana konu
  // aynıysa ben elle eşleştirebilmeliyim, sorular kaybolmasın"). Eşleşen metin, bu id'ye
  // sahip satırı GÜNCELLER (insert değil) — o kazanıma bağlı question_outcomes korunur.
  manualOutcomeMerges?: Record<string, number>;
  // Aynı mantık KONU (topic) seviyesinde: yeni parse edilen bir konu başlığını, admin'in
  // önizlemede elle seçtiği MEVCUT bir DB konu id'sine bağlar — fuzzy eşleşmenin (aşağıya
  // bkz.) kaçırdığı ya da yanlış eşleştirdiği durumlar için. Manuel eşleşme her zaman fuzzy'den
  // ÖNCELİKLİDİR (bkz. manualOutcomeMerges ile aynı öncelik deseni).
  manualTopicMerges?: Record<string, number>;
  // Fuzzy/manuel eşleşen bir konunun title/slug'ını yeni parse edilen metinle GÜNCELLEMEK
  // için admin'in AÇIKÇA onayladığı DB topic id'leri. Konu slug'ları public URL'lerde
  // kullanıldığından, sadece "aynı konu" tespit edildi diye sessizce yeniden adlandırıp
  // mevcut linkleri/SEO'yu bozmuyoruz — admin bu id'yi listeye eklemediği sürece eşleşen
  // konunun title/slug'ı OLDUĞU GİBİ kalır, sadece kazanımları güncellenir.
  renameTopicIds?: number[];
};

export type ImportUnitResult =
  | {
      ok: true;
      unitId: number;
      unitTitle: string;
      topicsCreated: number;
      outcomesCreated: number;
      outcomesSkipped: number;
    }
  | { ok: false; error: string };

export async function saveTymmUnit(params: SaveTymmUnitParams): Promise<ImportUnitResult> {
  const { unit, gradeId, lessonId, curriculumYear, manualOutcomeMerges, manualTopicMerges, renameTopicIds } = params;
  const renameTopicIdSet = new Set(renameTopicIds || []);

  // Belirsiz sınır durumunda (bkz. tymmParser.ts fallback) topicTitle boş bırakılıyor —
  // burada ASLA "" başlıklı bir konu oluşturmuyoruz (sessizce çöp veri yazmaktansa, admin'e
  // önizlemede hangi öğrenme çıktılarının konusu eksik olduğunu söyleyip KAYDETMEYİ
  // reddediyoruz). Kullanıcının 2026-09-24 canlıda yakaladığı gerçek örnek: 5. Sınıf Sosyal
  // Bilgiler "Ortak Mirasımız" ünitesi kaydedilince konulardan biri sessizce kayboluyordu —
  // sessiz veri kaybı, sessiz çöp veriden de kötü, bu yüzden en güvenlisi kaydetmeden önce
  // durdurmak.
  const missingTopicTitleFor = unit.learningOutcomes.filter((lo) => !lo.topicTitle.trim());
  if (missingTopicTitleFor.length > 0) {
    return {
      ok: false,
      error: `${missingTopicTitleFor.length} öğrenme çıktısının konusu belirsiz ("(başlıksız)") — önce önizlemede İçerik Çerçevesi listesinden konu seçin, sonra kaydedin. Kod(lar): ${missingTopicTitleFor.map((lo) => lo.code || lo.title.slice(0, 30)).join(', ')}`,
    };
  }

  const supabase = createServiceClient();

  const { data: lgData } = await supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .maybeSingle();
  if (!lgData) {
    await supabase.from('lesson_grades').insert({ lesson_id: lessonId, grade_id: gradeId, is_active: true });
  }

  // Parser normalde "1. Öğrenme Alanı: " gibi bir öneki zaten ayıklıyor (bkz. tymmParser.ts
  // unitNumberMatch) ama bu ayıklama regex'in eşleşmediği bir h1 formatında sessizce
  // başarısız olabiliyor — stripUnitTitleNumberPrefix burada ikinci bir güvenlik ağı: yeni
  // ünite oluşturulurken DB'ye çirkin/tutarsız bir başlık yazılmasın diye.
  const unitTitle = stripUnitTitleNumberPrefix(unit.unitTitle);
  // Birebir title eşleşmesi YETERLİ DEĞİL: TYMM zaman zaman başlığın başına "1. Öğrenme
  // Alanı: " gibi bir sıra numarası ekliyor, DB'deki ünite bu önek olmadan kayıtlı —
  // normUnitTitleForMatch bu farkı yok sayar (bkz. compareUnits.ts, kullanıcının 2026-09-22
  // bulduğu mükerrer ünite bug'ı). Ünite sayısı az olduğu için (lesson+grade başına genelde
  // <15) tek tek çekip JS'te normalize ederek eşleştirmek ucuz.
  const { data: allUnitsForLessonGrade } = await supabase
    .from('units')
    .select('id, order_no, title')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId);
  const normalizedTarget = normUnitTitleForMatch(unitTitle);
  const existingUnit = ((allUnitsForLessonGrade as (UnitRow & { title: string })[] | null) || []).find(
    (u) => normUnitTitleForMatch(u.title) === normalizedTarget
  );

  let unitId: number;
  if (existingUnit) {
    unitId = (existingUnit as UnitRow).id;
    await supabase.from('units').update({ duration_hours: unit.durationHours, key_concepts: unit.keyConcepts }).eq('id', unitId);
  } else {
    const { data: maxOrderData } = await supabase
      .from('units')
      .select('order_no')
      .eq('lesson_id', lessonId)
      .eq('grade_id', gradeId)
      .order('order_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = ((maxOrderData as UnitRow | null)?.order_no ?? 0) + 1;
    // Ünite hiçbir yerde salt slug'la aranmıyor, her zaman lesson_id + grade_id + slug ile
    // aranıyor — düz slug dışında HİÇBİR EK/SIRA NUMARASI kullanılmıyor (kullanıcının
    // 2026-09-21 kesin kararı, bkz. yillikPlan/importer.ts'teki aynı düzeltme). Gerçek bir
    // çakışma olursa insert kendi unique-violation hatasıyla düşer, sessizce numaralandırılmaz.
    const slug = slugify(unitTitle);
    const { data: created, error: insertError } = await supabase
      .from('units')
      .insert({
        lesson_id: lessonId,
        grade_id: gradeId,
        title: unitTitle,
        slug,
        order_no: nextOrder,
        // ESKİDEN is_active:false — admin her ünite kaydından SONRA ayrıca Yayın
        // Yönetimi'ne gidip elle yayına almak zorundaydı, unutunca ünite (DB'de doğru
        // olsa da) public sitede hiç görünmüyordu. Kullanıcının 2026-09-24 isteği:
        // "yıllık plan eklerken bundan sonra otomatik yayında olsun ders ve üniteler" —
        // artık TYMM'den kaydedilen bir ünite direkt yayında; admin istemezse Yayın
        // Yönetimi'nden elle taslağa alabilir.
        is_active: true,
        description: `${unitTitle} ünitesi`,
        duration_hours: unit.durationHours,
        key_concepts: unit.keyConcepts,
      })
      .select('id')
      .single();
    if (insertError || !created) {
      return { ok: false, error: insertError?.message || 'Ünite oluşturulamadı' };
    }
    unitId = (created as { id: number }).id;
  }

  const { data: existingTopicsData } = await supabase.from('topics').select('id, title, order_no, learning_outcome').eq('unit_id', unitId);
  const existingTopicByTitle = new Map<string, number>(
    ((existingTopicsData as { id: number; title: string; order_no: number }[] | null) || []).map((t) => [t.title, t.id])
  );
  // Konu ilk kez oluşturulduğunda learning_outcome yazılıyor (aşağıda), ama daha ÖNCE
  // (ör. elle veya farklı bir yoldan) boş bırakılmış mevcut konularda bu alan hep boş
  // kalıyordu — TYMM'i yeniden aktarınca dolsun diye topicId → mevcut learning_outcome
  // değerini burada tutuyoruz (yalnızca boşsa aşağıda doldurulacak, dolu bir değer ASLA
  // ezilmez — admin'in elle yaptığı düzenlemeyi kaybetmemek için).
  const existingTopicLearningOutcomeById = new Map<number, string | null>(
    ((existingTopicsData as { id: number; learning_outcome: string | null }[] | null) || []).map((t) => [t.id, t.learning_outcome])
  );
  let nextTopicOrder = Math.max(0, ...((existingTopicsData as { order_no: number }[] | null) || []).map((t) => t.order_no)) + 1;

  let topicsCreated = 0;
  let outcomesCreated = 0;
  let outcomesSkipped = 0;
  // topic_id → bu import'ta güncellenen/oluşturulan outcome id'leri. Import sonunda,
  // her dokunulan konuda bu listenin DIŞINDA kalan is_current=true satırlar
  // is_current=false yapılır (metni değiştiği için eşleşmeyen eski yıl kazanımları) —
  // bkz. supabase/migrations/outcomes_is_current.sql.
  const touchedOutcomeIdsByTopic = new Map<number, number[]>();

  // Bir konunun kaç ayrı öğrenme çıktısı grubu aldığını (nextTopicOrder gibi) topic_id
  // bazında sayıyoruz — topic_learning_outcomes.order_no için, ve topics.learning_outcome
  // metnini SADECE konu ilk oluşturulduğunda yazıyoruz (bir konuya ikinci bir öğrenme
  // çıktısı grubu düştüğünde onun üstüne yazıp ilkini kaybetmemek için — asıl doğru kayıt
  // artık topic_learning_outcomes'ta, bkz. supabase/migrations/topic_learning_outcomes.sql).
  const learningOutcomeGroupCountByTopic = new Map<number, number>();

  // topic_id → o konunun kazanımları (id + description), yalnızca ihtiyaç oldukça çekilip
  // önbelleğe alınır. Eşleştirme artık BİREBİR metin değil FUZZY (bkz. compareUnits.ts
  // fuzzyNorm — noktalama/boşluk/Türkçe İ-I-ı-i farkını yok sayar): TYMM bir kazanımın
  // sonuna tek bir nokta eklediğinde bile eski metin eşleşmiyor, kazanım "değişti"
  // sanılıp arşivleniyor ve o kazanıma bağlı sorular (question_outcomes) "güncel değil"
  // görünüyordu (kullanıcının 2026-09-22 canlıda yakaladığı gerçek örnek — bkz.
  // supabase/migrations/outcomes_is_current.sql).
  const outcomesByTopicCache = new Map<number, { id: number; description: string }[]>();
  async function getTopicOutcomes(topicId: number) {
    let list = outcomesByTopicCache.get(topicId);
    if (!list) {
      const { data } = await supabase.from('outcomes').select('id, description').eq('topic_id', topicId);
      list = (data as { id: number; description: string }[] | null) || [];
      outcomesByTopicCache.set(topicId, list);
    }
    return list;
  }

  // Konuları hangi başlıkla bulduğumuzu (renamed'ı sadece bir kez uygulamak için) takip ediyoruz.
  const renamedTopicIds = new Set<number>();

  for (const learningOutcome of unit.learningOutcomes) {
    const topicTitle = learningOutcome.topicTitle;
    const learningOutcomeText = learningOutcome.code ? `${learningOutcome.code}. ${learningOutcome.title}` : learningOutcome.title;

    // Konu eşleştirme sırası (bkz. SaveTymmUnitParams.manualTopicMerges/renameTopicIds notu,
    // ve aynı önceliğin uygulandığı aşağıdaki kazanım eşleştirmesi):
    // 1) Admin'in elle seçtiği eşleştirme her zaman kazanır.
    // 2) Birebir başlık eşleşmesi.
    // 3) FUZZY başlık eşleşmesi (noktalama/boşluk/Türkçe İ-I-ı-i farkını yok sayar) — TYMM
    //    başlığın sonuna bir nokta eklediğinde bile "yeni konu" sanılıp mükerrer konu/kazanım
    //    oluşturulmasın diye (kazanımlar için zaten uygulanan aynı fuzzy mantığın konu
    //    seviyesindeki karşılığı, kullanıcının 2026-09-22 isteği).
    const manualMergeTopicId = manualTopicMerges?.[topicTitle];
    let topicId: number | undefined =
      (manualMergeTopicId != null && Array.from(existingTopicByTitle.values()).includes(manualMergeTopicId) ? manualMergeTopicId : undefined) ??
      existingTopicByTitle.get(topicTitle) ??
      Array.from(existingTopicByTitle.entries()).find(([title]) => fuzzyNorm(title) === fuzzyNorm(topicTitle))?.[1];

    if (topicId == null) {
      const { data: createdTopic, error: topicError } = await supabase
        .from('topics')
        .insert({
          unit_id: unitId,
          title: topicTitle,
          slug: slugify(topicTitle),
          order_no: nextTopicOrder,
          is_active: true,
          learning_outcome: learningOutcomeText,
        })
        .select('id')
        .single();
      if (topicError || !createdTopic) {
        return { ok: false, error: topicError?.message || `Konu oluşturulamadı: ${topicTitle}` };
      }
      topicId = (createdTopic as TopicRow & { id: number }).id;
      existingTopicByTitle.set(topicTitle, topicId);
      nextTopicOrder += 1;
      topicsCreated += 1;
    } else {
      if (!existingTopicLearningOutcomeById.get(topicId)) {
        // Mevcut konu, ama learning_outcome boş — geriye dönük doldur (bir sonraki öğrenme
        // çıktısı grubu aynı konuya düşerse tekrar UPDATE atmamak için map'i hemen güncelliyoruz).
        await supabase.from('topics').update({ learning_outcome: learningOutcomeText }).eq('id', topicId);
        existingTopicLearningOutcomeById.set(topicId, learningOutcomeText);
      }
      // Konu title/slug'ı ASLA sessizce değiştirilmez (public URL'lerde kullanılıyor) — admin
      // renameTopicIds ile bu konu id'sini AÇIKÇA seçtiyse ve yeni parse edilen başlık DB'dekinden
      // farklıysa, title/slug bir kez güncellenir.
      if (renameTopicIdSet.has(topicId) && !renamedTopicIds.has(topicId)) {
        renamedTopicIds.add(topicId);
        await supabase.from('topics').update({ title: topicTitle, slug: slugify(topicTitle) }).eq('id', topicId);
      }
    }

    // Öğrenme çıktısı grubu: aynı konuya ikinci (üçüncü, ...) kez düşen bir öğrenme çıktısı
    // varsa (ör. Matematik 6 "Bir Doğal Sayının Çarpanları ve Katları" hem MAT.6.1.1 hem
    // MAT.6.1.4'ü içeriyor) kod bazında bul-veya-oluştur — koda göre eşleşince tekrar tekrar
    // aynı grubun mükerrer oluşturulmasını önlüyoruz (üniteyi ikinci kez aktarınca).
    let learningOutcomeId: number | null = null;
    const { data: existingGroup } = await supabase
      .from('topic_learning_outcomes')
      .select('id')
      .eq('topic_id', topicId)
      .eq('code', learningOutcome.code || '')
      .maybeSingle();

    if (existingGroup) {
      learningOutcomeId = (existingGroup as { id: number }).id;
    } else {
      const order = (learningOutcomeGroupCountByTopic.get(topicId) ?? 0) + 1;
      learningOutcomeGroupCountByTopic.set(topicId, order);
      const { data: createdGroup, error: groupError } = await supabase
        .from('topic_learning_outcomes')
        .insert({ topic_id: topicId, code: learningOutcome.code || null, title: learningOutcome.title, order_no: order })
        .select('id')
        .single();
      if (groupError || !createdGroup) {
        return { ok: false, error: groupError?.message || `Öğrenme çıktısı grubu oluşturulamadı: ${learningOutcomeText}` };
      }
      learningOutcomeId = (createdGroup as { id: number }).id;
    }

    const touchedOutcomeIds = touchedOutcomeIdsByTopic.get(topicId) || [];
    const topicOutcomes = await getTopicOutcomes(topicId);
    for (const comp of learningOutcome.components) {
      // Önce ADMİN'İN ELLE SEÇTİĞİ eşleştirme (bkz. SaveTymmUnitParams.manualOutcomeMerges) —
      // fuzzy eşleşmeden ÖNCELİKLİ: admin "bu yeni metin aslında şu eski kazanımın güncellenmiş
      // hali" demişse, otomatik mantık bunu geçersiz kılmamalı.
      const manualMergeId = manualOutcomeMerges?.[comp.text];
      // FUZZY eşleşme (bkz. yukarıdaki not): noktalama/boşluk/Türkçe İ-I-ı-i farkı görmezden
      // gelinir, curriculum_year eşleşme anahtarının parçası değil. Bulunan satır güncel
      // yılın verisiyle (ve TYMM'in en son yazımıyla) yerinde güncellenir (is_current=true).
      const compFuzzy = fuzzyNorm(comp.text);
      const existingOutcome =
        (manualMergeId != null ? topicOutcomes.find((o) => o.id === manualMergeId) : undefined) ??
        topicOutcomes.find((o) => fuzzyNorm(o.description) === compFuzzy);

      if (existingOutcome) {
        const outcomeId = existingOutcome.id;
        const { error: updateError } = await supabase
          .from('outcomes')
          .update({ description: comp.text, code: comp.letter, curriculum_year: curriculumYear, learning_outcome_id: learningOutcomeId, is_current: true })
          .eq('id', outcomeId);
        if (updateError) {
          return { ok: false, error: updateError.message };
        }
        existingOutcome.description = comp.text;
        touchedOutcomeIds.push(outcomeId);
        outcomesSkipped += 1;
        continue;
      }

      const { data: createdOutcome, error: outcomeError } = await supabase
        .from('outcomes')
        .insert({
          topic_id: topicId,
          description: comp.text,
          code: comp.letter,
          curriculum_year: curriculumYear,
          learning_outcome_id: learningOutcomeId,
          is_current: true,
        })
        .select('id')
        .single();
      if (outcomeError || !createdOutcome) {
        return { ok: false, error: outcomeError?.message || 'Kazanım oluşturulamadı' };
      }
      const newId = (createdOutcome as { id: number }).id;
      topicOutcomes.push({ id: newId, description: comp.text });
      touchedOutcomeIds.push(newId);
      outcomesCreated += 1;
    }
    touchedOutcomeIdsByTopic.set(topicId, touchedOutcomeIds);
  }

  // İçerik Çerçevesi'nde olup HİÇBİR öğrenme çıktısına düşmeyen konular (ör. bir ünitenin
  // giriş/genel bakış konusunun TYMM'de ayrı bir kazanımı olmayabiliyor) — yukarıdaki döngü
  // SADECE unit.learningOutcomes'u işlediği için bunlar hiç oluşturulmuyordu (kullanıcının
  // 2026-09-24 bildirdiği "4 konu var, 3 tanesini kaydediyor" — tam bu senaryo). Kazanım
  // ATFETMİYORUZ (TAHMİN yok, bkz. compareUnits.ts aynı karar), sadece konu satırının kendisi
  // eksik kalmasın diye boş (kazanımsız) oluşturuyoruz — admin sonradan Kazanım Yönetimi'nden
  // elle doldurabilir.
  for (const frameworkTitle of unit.contentFramework) {
    const trimmed = frameworkTitle.trim();
    if (!trimmed || trimmed.endsWith(':')) continue; // grup başlığı satırı, gerçek konu değil
    const alreadyExists =
      existingTopicByTitle.has(frameworkTitle) || Array.from(existingTopicByTitle.keys()).some((title) => fuzzyNorm(title) === fuzzyNorm(frameworkTitle));
    if (alreadyExists) continue;
    const { data: createdTopic, error: topicError } = await supabase
      .from('topics')
      .insert({ unit_id: unitId, title: frameworkTitle, slug: slugify(frameworkTitle), order_no: nextTopicOrder, is_active: true })
      .select('id')
      .single();
    if (topicError || !createdTopic) {
      return { ok: false, error: topicError?.message || `Konu oluşturulamadı: ${frameworkTitle}` };
    }
    existingTopicByTitle.set(frameworkTitle, (createdTopic as TopicRow & { id: number }).id);
    nextTopicOrder += 1;
    topicsCreated += 1;
  }

  // Bu importta dokunulan her konuda, yukarıdaki eşleştirme/güncellemeye YAKALANMAYAN
  // (metni değiştiği için eşleşmeyen) eski is_current=true kazanımları arşivle. Tüm
  // konular işlendikten SONRA, tek seferde çalışması önemli — aksi halde henüz o
  // konuya sıra gelmemiş kazanımlar erken arşivlenip touchedOutcomeIds'e hiç girmezdi.
  for (const [topicId, keepIds] of touchedOutcomeIdsByTopic) {
    await supabase
      .from('outcomes')
      .update({ is_current: false })
      .eq('topic_id', topicId)
      .eq('is_current', true)
      .not('id', 'in', `(${keepIds.join(',') || '0'})`);
  }

  return { ok: true, unitId, unitTitle, topicsCreated, outcomesCreated, outcomesSkipped };
}
