const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pwzbjhgrhkcdyowknmhe.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function ekle() {
  // Önce mevcut kazanımları al
  const { data: outcomes } = await supabase
    .from('outcomes')
    .select('id, topic_id')
    .in('topic_id', [235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252]);
  
  // Konu-hafta eşleştirmesi
  const konuHaftalar = {
    235: [1],
    236: [2, 3],
    237: [4, 5, 6],
    238: [7, 8],
    239: [9, 10],
    240: [11, 12],
    241: [13, 14],
    242: [15, 16],
    243: [17, 18],
    244: [19, 20],
    245: [21, 22],
    246: [23, 24],
    247: [25, 26],
    248: [27, 28],
    249: [29, 30],
    250: [31, 32],
    251: [33],
    252: [35, 36]
  };
  
  // Her konu için kazanımları grupla
  const konuKazanimlar = {};
  outcomes.forEach(o => {
    if (!konuKazanimlar[o.topic_id]) konuKazanimlar[o.topic_id] = [];
    konuKazanimlar[o.topic_id].push(o.id);
  });
  
  // Hafta bağlantılarını hazırla
  const haftaBaglantilari = [];
  Object.entries(konuKazanimlar).forEach(([topicId, kazanimIds]) => {
    const haftalar = konuHaftalar[topicId] || [];
    kazanimIds.forEach(outcomeId => {
      haftalar.forEach(hafta => {
        haftaBaglantilari.push({ outcome_id: outcomeId, week: hafta });
      });
    });
  });
  
  console.log('Toplam hafta bağlantısı: ' + haftaBaglantilari.length);
  
  // 50'şerli gruplar halinde ekle
  const batchSize = 50;
  let eklenen = 0;
  
  for (let i = 0; i < haftaBaglantilari.length; i += batchSize) {
    const batch = haftaBaglantilari.slice(i, i + batchSize);
    const { error } = await supabase.from('outcome_weeks').insert(batch);
    if (!error) {
      eklenen += batch.length;
      console.log('Batch ' + (i/batchSize + 1) + ': ' + batch.length + ' eklendi');
    } else {
      console.log('Hata: ' + error.message);
    }
  }
  
  console.log('\n✅ Toplam ' + eklenen + ' hafta bağlantısı eklendi');
}

ekle();
