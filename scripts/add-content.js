// scripts/add-content.js
// Manuel içerik ekleme scripti - Onaylı

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

// İçerik ekle
async function addContent(topicId, title, content, week) {
  // Önce içeriği ekle
  const { data: contentData, error: contentError } = await supabase
    .from('topic_contents')
    .insert([{
      topic_id: topicId,
      title: title,
      content: content,
      order_no: 0
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

// Ana fonksiyon
async function main() {
  const args = process.argv.slice(2);
  
  // Basit kullanım: node add-content.js <topicId> <week> <title> <content>
  if (args.length < 4) {
    console.log(`
📖 Kullanım:

  node add-content.js <topicId> <hafta> "başlık" "içerik"

📝 Örnek:
  node add-content.js 93 3 "Işık Nedir?" "<section><h2>...</h2></section>"

📋 Parametreler:
  topicId: Konu ID'si (örn: 93)
  hafta: Müfredat haftası (örn: 3)
  başlık: İçerik başlığı
  içerik: HTML formatında içerik
`);
    return;
  }

  const topicId = parseInt(args[0]);
  const week = parseInt(args[1]);
  const title = args[2];
  const content = args.slice(3).join(' ');
  
  if (!topicId || !week || !title || !content) {
    console.error('❌ Eksik parametre!');
    return;
  }

  // Önizleme göster
  console.log('\n' + '='.repeat(60));
  console.log('📋 EKLENECEK İÇERİK ÖNİZLEMESİ');
  console.log('='.repeat(60));
  console.log(`Konu ID: ${topicId}`);
  console.log(`Hafta: ${week}`);
  console.log(`Başlık: ${title}`);
  console.log('\nİçerik (ilk 500 karakter):');
  console.log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));
  console.log('='.repeat(60));
  console.log('\n⚠️  Şimdi eklensin mi? (evet/hayır)');
  console.log('Komut: --confirm flag\'i ile çalıştırın\n');
}

main().catch(console.error);
