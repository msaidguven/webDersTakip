const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pwzbjhgrhkcdyowknmhe.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function temizle() {
  console.log('Tekrarlanan kazanımlar temizleniyor...');
  
  const { data: outcomes } = await supabase
    .from('outcomes')
    .select('id, topic_id, description')
    .in('topic_id', [235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252])
    .order('topic_id')
    .order('id');
  
  console.log('Toplam kazanım: ' + outcomes?.length);
  
  const gruplar = {};
  outcomes?.forEach(o => {
    if (!gruplar[o.topic_id]) gruplar[o.topic_id] = [];
    gruplar[o.topic_id].push(o);
  });
  
  const silinecek = [];
  Object.values(gruplar).forEach(konuKazanimlar => {
    const aciklamaGruplari = {};
    konuKazanimlar.forEach(k => {
      if (!aciklamaGruplari[k.description]) {
        aciklamaGruplari[k.description] = k.id;
      } else {
        silinecek.push(k.id);
      }
    });
  });
  
  console.log('Silinecek tekrar: ' + silinecek.length);
  
  if (silinecek.length > 0) {
    await supabase.from('outcome_weeks').delete().in('outcome_id', silinecek);
    await supabase.from('outcomes').delete().in('id', silinecek);
    console.log('✅ Tekrarlar temizlendi!');
  }
  
  // Son durumu kontrol et
  const { data: kalan } = await supabase
    .from('outcomes')
    .select('id, topic_id')
    .in('topic_id', [235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252]);
  
  console.log('\nKalan kazanım: ' + kalan?.length);
}

temizle();
