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

// Komut satırı argümanları
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === '--list') {
    // Hiyerarşiyi listele
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

  if (args[0] === '--add') {
    // Manuel ekleme: --add <topicId> <week> <title> <content>
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

  // Yardım
  console.log(`
📖 Kullanım:

  node add-content.js --list              # Tüm sınıf ve dersleri listele
  node add-content.js --units <lessonId>  # Dersin ünitelerini listele
  node add-content.js --topics <unitId>   # Ünitenin konularını listele
  node add-content.js --add <topicId> <week> <"başlık"> <"içerik">  # İçerik ekle

📝 Örnek:
  node add-content.js --add 5 3 "Fotosentez" "Fotosentez bitkilerin..."
`);
}

main().catch(console.error);
