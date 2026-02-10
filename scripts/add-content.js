// scripts/add-content.js
// Otomatik içerik ekleme scripti

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Hiyerarşiyi getir
async function getHierarchy() {
  const { data: grades } = await supabase
    .from('grades')
    .select('id, name, order_no')
    .eq('is_active', true)
    .order('order_no');

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, name, icon')
    .eq('is_active', true)
    .order('order_no');

  const { data: lessonGrades } = await supabase
    .from('lesson_grades')
    .select('lesson_id, grade_id')
    .eq('is_active', true);

  return { grades, lessons, lessonGrades };
}

// Üniteleri getir
async function getUnits(lessonId) {
  const { data } = await supabase
    .from('units')
    .select('id, title, order_no')
    .eq('lesson_id', lessonId)
    .eq('is_active', true)
    .order('order_no');
  return data || [];
}

// Konuları getir
async function getTopics(unitId) {
  const { data } = await supabase
    .from('topics')
    .select('id, title, order_no')
    .eq('unit_id', unitId)
    .eq('is_active', true)
    .order('order_no');
  return data || [];
}

// İçerik ekle
async function addContent(topicId, title, content, week, orderNo = 0) {
  // Önce içeriği ekle
  const { data: contentData, error: contentError } = await supabase
    .from('topic_contents')
    .insert([{
      topic_id: topicId,
      title: title,
      content: content,
      order_no: orderNo
    }])
    .select()
    .single();

  if (contentError) {
    console.error('❌ İçerik eklenirken hata:', contentError.message);
    return null;
  }

  // Sonra hafta ilişkisini ekle
  const { error: weekError } = await supabase
    .from('topic_content_weeks')
    .insert([{
      topic_content_id: contentData.id,
      curriculum_week: week
    }]);

  if (weekError) {
    console.error('❌ Hafta ilişkisi eklenirken hata:', weekError.message);
    return null;
  }

  console.log('✅ İçerik başarıyla eklendi!');
  console.log(`   ID: ${contentData.id}`);
  console.log(`   Başlık: ${title}`);
  console.log(`   Hafta: ${week}`);
  
  return contentData.id;
}

// Haftaya göre kazanımları getir
async function getOutcomesByWeek(lessonId, week) {
  const { data, error } = await supabase
    .from('outcome_weeks')
    .select(`
      id,
      start_week,
      end_week,
      outcomes(
        id,
        description,
        topic_id,
        topics(
          id, 
          title, 
          unit_id,
          units(lesson_id)
        )
      )
    `)
    .lte('start_week', week)
    .gte('end_week', week);
  
  if (error) {
    console.error('❌ Kazanımlar çekilirken hata:', error.message);
    return [];
  }
  
  // Sadece istenen dersin kazanımlarını filtrele
  const filtered = (data || []).filter(ow => {
    return ow.outcomes?.topics?.units?.lesson_id === lessonId;
  });
  
  return filtered;
}

// Ders adını getir
async function getLessonName(lessonId) {
  const { data } = await supabase
    .from('lessons')
    .select('name')
    .eq('id', lessonId)
    .single();
  return data?.name || 'Bilinmeyen Ders';
}

// AI için içerik şablonu oluştur
function generateContentTemplate(lessonName, topicTitle, outcomes, week) {
  const outcomesText = outcomes.map((o, i) => `${i + 1}. ${o.description}`).join('\n');
  
  return `
# ${lessonName} - ${week}. Hafta
## Konu: ${topicTitle}

### Kazanımlar:
${outcomesText}

### İçerik Yapısı:
1. **Giriş**: Konunun günlük hayatla bağlantısı
2. **Ana Konu**: Kazanımlara uygun açıklamalar
3. **Örnekler**: Konuyla ilgili 2-3 örnek
4. **Özet**: Konunun kısa özeti
5. **Değerlendirme Soruları**: Kazanımları ölçen 3 soru

**Not:** İçerik ${lessonName} dersine uygun, öğrenci seviyesine göre hazırlanmalıdır.
`;
}

// Haftalık içerik ekleme (kazanımlara göre)
async function addWeeklyContent(lessonId, week, customTitle = null, customContent = null) {
  const lessonName = await getLessonName(lessonId);
  
  console.log(`\n📚 ${lessonName} - ${week}. Hafta Kazanımları:`);
  console.log('─'.repeat(50));
  
  // Kazanımları çek
  const outcomes = await getOutcomesByWeek(lessonId, week);
  
  if (outcomes.length === 0) {
    console.log('⚠️ Bu hafta için kazanım bulunamadı!');
    return;
  }
  
  // Konulara göre grupla
  const topicGroups = {};
  outcomes.forEach(ow => {
    const outcome = ow.outcomes;
    if (!outcome || !outcome.topics) return;
    
    const topicId = outcome.topics.id;
    if (!topicGroups[topicId]) {
      topicGroups[topicId] = {
        topic: outcome.topics,
        outcomes: []
      };
    }
    topicGroups[topicId].outcomes.push({
      id: outcome.id,
      description: outcome.description
    });
  });
  
  // Her konu için içerik hazırla
  for (const [topicId, group] of Object.entries(topicGroups)) {
    console.log(`\n📄 Konu: ${group.topic.title}`);
    console.log('Kazanımlar:');
    group.outcomes.forEach((o, i) => console.log(`  ${i + 1}. ${o.description}`));
    
    // İçerik şablonu oluştur
    const template = generateContentTemplate(lessonName, group.topic.title, group.outcomes, week);
    console.log('\n📝 Önerilen İçerik Yapısı:');
    console.log(template);
    
    // Eğer içerik verildiyse ekle
    if (customTitle && customContent) {
      const contentId = await addContent(topicId, customTitle, customContent, week);
      if (contentId) {
        console.log(`✅ Konu "${group.topic.title}" için içerik eklendi!`);
      }
    }
  }
  
  return topicGroups;
}

// Komut satırı argümanları
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === '--list') {
    const { grades, lessons, lessonGrades } = await getHierarchy();
    
    console.log('\n📚 SINIFLAR:');
    grades?.forEach(g => console.log(`  ${g.id}: ${g.name}`));
    
    console.log('\n📖 DERSLER:');
    lessons?.forEach(l => console.log(`  ${l.id}: ${l.name} ${l.icon || ''}`));
    
    console.log('\n🔗 SINIF-DERS İLİŞKİSİ:');
    for (const lg of lessonGrades || []) {
      const grade = grades?.find(g => g.id === lg.grade_id);
      const lesson = lessons?.find(l => l.id === lg.lesson_id);
      if (grade && lesson) {
        console.log(`  ${grade.name} → ${lesson.name}`);
      }
    }
    return;
  }

  if (args[0] === '--units') {
    const lessonId = args[1];
    const units = await getUnits(lessonId);
    console.log(`\n📁 ÜNİTELER (Ders ID: ${lessonId}):`);
    units.forEach(u => console.log(`  ${u.id}: ${u.title}`));
    return;
  }

  if (args[0] === '--topics') {
    const unitId = args[1];
    const topics = await getTopics(unitId);
    console.log(`\n📄 KONULAR (Ünite ID: ${unitId}):`);
    topics.forEach(t => console.log(`  ${t.id}: ${t.title}`));
    return;
  }

  if (args[0] === '--outcomes') {
    // Kazanımları listele: --outcomes <lessonId> <week>
    const lessonId = parseInt(args[1]);
    const week = parseInt(args[2]);
    
    if (!lessonId || !week) {
      console.log('Kullanım: node add-content.js --outcomes <lessonId> <week>');
      return;
    }
    
    await addWeeklyContent(lessonId, week);
    return;
  }

  if (args[0] === '--add-weekly') {
    // Kazanımlara göre içerik ekle: --add-weekly <lessonId> <week> <"başlık"> <"içerik">
    const lessonId = parseInt(args[1]);
    const week = parseInt(args[2]);
    const title = args[3];
    const content = args.slice(4).join(' ');
    
    if (!lessonId || !week || !title || !content) {
      console.log('Kullanım: node add-content.js --add-weekly <lessonId> <week> <"başlık"> <"içerik">');
      console.log('Örnek: node add-content.js --add-weekly 3 5 "Güneş Sistemi" "Güneş sistemi güneş ve..."');
      return;
    }
    
    await addWeeklyContent(lessonId, week, title, content);
    return;
  }

  if (args[0] === '--add') {
    const topicId = parseInt(args[1]);
    const week = parseInt(args[2]);
    const title = args[3];
    const content = args.slice(4).join(' ');
    
    if (!topicId || !week || !title || !content) {
      console.log('Kullanım: node add-content.js --add <topicId> <week> <"başlık"> <"içerik">');
      return;
    }
    
    await addContent(topicId, title, content, week);
    return;
  }

  console.log(`
📖 Kullanım:

  node add-content.js --list                           # Tüm sınıf ve dersleri listele
  node add-content.js --units <lessonId>               # Dersin ünitelerini listele
  node add-content.js --topics <unitId>                # Ünitenin konularını listele
  node add-content.js --outcomes <lessonId> <week>     # Haftanın kazanımlarını listele
  node add-content.js --add-weekly <lessonId> <week> <"başlık"> <"içerik">  # Kazanıma göre içerik ekle
  node add-content.js --add <topicId> <week> <"başlık"> <"içerik">          # Direkt içerik ekle

📝 Örnekler:
  node add-content.js --outcomes 3 5                   # 5. hafta kazanımlarını göster
  node add-content.js --add-weekly 3 5 "Başlık" "İçerik..."  # 5. haftaya içerik ekle
`);
}

main().catch(console.error);
