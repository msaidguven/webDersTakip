// scripts/add-content.js
// Akıllı içerik ekleme - Sınıf/Ders/Hafta ile

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ HATA: SUPABASE_SERVICE_KEY eksik!');
  console.log('\n📋 Kurulum:');
  console.log('1. Supabase Dashboard -> Project Settings -> API');
  console.log('2. service_role key\'i kopyala');
  console.log('3. .env.local dosyasına ekle:');
  console.log('   SUPABASE_SERVICE_KEY=eyJ...');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Sınıf ID'sini bul
async function getGradeId(gradeName) {
  const { data } = await supabase
    .from('grades')
    .select('id, name')
    .ilike('name', `%${gradeName}%`)
    .eq('is_active', true)
    .single();
  return data?.id;
}

// Ders ID'sini bul
async function getLessonId(lessonName) {
  const { data } = await supabase
    .from('lessons')
    .select('id, name')
    .ilike('name', `%${lessonName}%`)
    .eq('is_active', true)
    .single();
  return data?.id;
}

// Sınıf + Ders + Hafta ile konu ve kazanımları bul
async function getTopicsByWeek(gradeName, lessonName, week) {
  const gradeId = await getGradeId(gradeName);
  const lessonId = await getLessonId(lessonName);
  
  if (!gradeId) {
    console.error(`❌ Sınıf bulunamadı: ${gradeName}`);
    return null;
  }
  if (!lessonId) {
    console.error(`❌ Ders bulunamadı: ${lessonName}`);
    return null;
  }
  
  // Sınıf-ders ilişkisi kontrol et
  const { data: lgCheck } = await supabase
    .from('lesson_grades')
    .select('*')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .eq('is_active', true)
    .single();
    
  if (!lgCheck) {
    console.error(`❌ ${gradeName} ve ${lessonName} kombinasyonu bulunamadı!`);
    return null;
  }
  
  // Haftaya göre kazanımları bul
  const { data: outcomes } = await supabase
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
          units(id, title, lesson_id)
        )
      )
    `)
    .lte('start_week', week)
    .gte('end_week', week);
  
  // Sadece bu dersin kazanımlarını filtrele
  const filtered = (outcomes || []).filter(ow => {
    return ow.outcomes?.topics?.units?.lesson_id === lessonId;
  });
  
  if (filtered.length === 0) {
    console.error(`❌ ${week}. hafta için kazanım bulunamadı!`);
    return null;
  }
  
  // Konulara göre grupla
  const topics = {};
  filtered.forEach(ow => {
    const o = ow.outcomes;
    if (!o || !o.topics) return;
    
    const topicId = o.topics.id;
    if (!topics[topicId]) {
      topics[topicId] = {
        id: topicId,
        title: o.topics.title,
        unit: o.topics.units?.title,
        outcomes: []
      };
    }
    topics[topicId].outcomes.push(o.description);
  });
  
  return {
    gradeId,
    lessonId,
    gradeName,
    lessonName,
    week,
    topics: Object.values(topics)
  };
}

// HTML içerik şablonu oluştur
function generateHTMLContent(topic, week) {
  const outcomesList = topic.outcomes.map((o, i) => `  <li>${o}</li>`).join('\n');
  
  return {
    title: topic.title,
    html: `<section>
  <h2>${topic.title}</h2>
  
  <h3>Kazanımlar</h3>
  <ul>
${outcomesList}
  </ul>
  
  <h3>Konu Anlatımı</h3>
  <p>Bu bölümde ${topic.title.toLowerCase()} konusu işlenecektir.</p>
  
  <h3>Örnekler</h3>
  <p>Konuyla ilgili örnekler eklenecektir.</p>
  
  <h3>Özet</h3>
  <p>Konunun kısa özeti burada yer alacaktır.</p>
</section>`,
    outcomes: topic.outcomes
  };
}

// İçerik ekle
async function addContent(topicId, title, content, week) {
  const { data, error } = await supabase
    .from('topic_contents')
    .insert([{
      topic_id: topicId,
      title: title,
      content: content,
      order_no: 0
    }])
    .select()
    .single();

  if (error) {
    console.error('❌ Hata:', error.message);
    return null;
  }

  await supabase
    .from('topic_content_weeks')
    .insert([{
      topic_content_id: data.id,
      curriculum_week: week
    }]);

  return data.id;
}

// Ana fonksiyon
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log(`
📖 Kullanım:

  node add-content.js "sınıf" "ders" hafta

📝 Örnek:
  node add-content.js "5" "fen bilgisi" 3
  node add-content.js "6" "matematik" 10

📋 Çıktı:
  - Ünite ve konu bilgisi
  - Kazanımlar
  - Önerilen HTML içerik
  - Ekleme komutu
`);
    return;
  }

  const gradeName = args[0];
  const lessonName = args[1];
  const week = parseInt(args[2]);
  
  console.log(`\n🔍 Aranıyor: ${gradeName}. Sınıf ${lessonName}, ${week}. Hafta...\n`);
  
  const result = await getTopicsByWeek(gradeName, lessonName, week);
  
  if (!result) return;
  
  console.log('✅ BULUNDU!\n');
  console.log('='.repeat(60));
  console.log(`${result.gradeName} ${result.lessonName} - ${result.week}. Hafta`);
  console.log('='.repeat(60));
  
  result.topics.forEach((topic, index) => {
    console.log(`\n📄 KONU ${index + 1}: ${topic.title}`);
    console.log(`   Ünite: ${topic.unit}`);
    console.log(`   Konu ID: ${topic.id}`);
    console.log('\n   Kazanımlar:');
    topic.outcomes.forEach((o, i) => {
      console.log(`     ${i + 1}. ${o.substring(0, 80)}...`);
    });
    
    // HTML şablonu oluştur
    const content = generateHTMLContent(topic, week);
    
    console.log('\n   📋 ÖNERİLEN İÇERİK:');
    console.log('   ─'.repeat(30));
    console.log(content.html);
    console.log('   ─'.repeat(30));
    
    console.log(`\n   💾 EKLEME KOMUTU:`);
    console.log(`   node scripts/add-content.js --confirm ${topic.id} ${week} "${content.title}" "${content.html.replace(/"/g, '\\"')}"`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('📝 İçeriği düzenleyip eklemek için yukarıdaki komutu kullanın.');
  console.log('   Veya içeriği manuel olarak hazırlayıp bana gönderin.\n');
}

main().catch(console.error);
