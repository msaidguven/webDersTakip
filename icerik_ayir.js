const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://pwzbjhgrhkcdyowknmhe.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function duzelt() {
  // 1. Mevcut içeriği sil
  console.log('Mevcut içerik siliniyor...');
  await supabase.from('topic_content_weeks').delete().eq('topic_content_id', 289);
  await supabase.from('topic_contents').delete().eq('id', 289);
  console.log('✅ Eski içerik silindi');
  
  // 2. Dosyayı oku ve böl
  const tamIcerik = fs.readFileSync('icerik_hafta_19_20_son.html', 'utf8');
  
  // CDATA kısmını çıkar
  const cdataMatch = tamIcerik.match(/<!\[CDATA\[([\s\S]*)\]\]>/);
  if (!cdataMatch) {
    console.log('CDATA bulunamadı');
    return;
  }
  
  const icerik = cdataMatch[1];
  
  // İki bölüme ayır
  const bolum1Match = icerik.match(/(<section>[\s\S]*?<\/section>)/);
  const bolum2Match = icerik.match(/<hr\/><hr\/>([\s\S]*<section>[\s\S]*<\/section>)/);
  
  if (!bolum1Match || !bolum2Match) {
    console.log('Bölümler bulunamadı');
    return;
  }
  
  const bolum1 = bolum1Match[1];
  const bolum2 = bolum2Match[1];
  
  // 3. Birinci Bölümü ekle (Hafta 19)
  const { data: data1, error: error1 } = await supabase.from('topic_contents').insert([{
    topic_id: 244,
    title: "Anadolu'nun Türk Yurdu Olması - Birinci Bölüm: Malazgirt ve Sonrası (1071-1176)",
    content: `<![CDATA[${bolum1}]]>`
  }]).select();
  
  if (error1) {
    console.log('❌ Bölüm 1 hatası: ' + error1.message);
    return;
  }
  
  await supabase.from('topic_content_weeks').insert([
    { topic_content_id: data1[0].id, curriculum_week: 19 }
  ]);
  console.log('✅ Birinci Bölüm (Hafta 19) eklendi! ID: ' + data1[0].id);
  
  // 4. İkinci Bölümü ekle (Hafta 20)
  const { data: data2, error: error2 } = await supabase.from('topic_contents').insert([{
    topic_id: 244,
    title: "Anadolu'nun Türk Yurdu Olması - İkinci Bölüm: Miryokefalon ve Beylikler (1176-1300)",
    content: `<![CDATA[${bolum2}]]>`
  }]).select();
  
  if (error2) {
    console.log('❌ Bölüm 2 hatası: ' + error2.message);
    return;
  }
  
  await supabase.from('topic_content_weeks').insert([
    { topic_content_id: data2[0].id, curriculum_week: 20 }
  ]);
  console.log('✅ İkinci Bölüm (Hafta 20) eklendi! ID: ' + data2[0].id);
  
  console.log('\n🎉 İKİ AYRI İÇERİK BAŞARIYLA EKLENDİ!');
}

duzelt();
