const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://pwzbjhgrhkcdyowknmhe.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function ekle() {
  const icerik = fs.readFileSync('icerik_hafta_19_20_son.html', 'utf8');
  
  const { data, error } = await supabase.from('topic_contents').insert([{
    topic_id: 244,
    title: "Anadolu'nun Türk Yurdu Olması: XI-XIII. Yüzyıllar Arası Mücadeleler",
    content: icerik,
    content_type: "html"
  }]).select();
  
  if (error) {
    console.log('❌ Hata: ' + error.message);
  } else {
    console.log('✅ İçerik eklendi! ID: ' + data[0].id);
    console.log('📚 Konu ID: 244');
    console.log('📅 Hafta: 19-20');
  }
}

ekle();
