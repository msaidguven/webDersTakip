const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pwzbjhgrhkcdyowknmhe.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function ekle() {
  const { data: outcomes } = await supabase
    .from('outcomes')
    .select('id, topic_id')
    .in('topic_id', [235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252]);
  
  // Konu-hafta aralığı eşleştirmesi
  const konuHaftalar = {
    235: [1, 1],     // Hafta 1
    236: [2, 3],     // Hafta 2-3
    237: [4, 6],     // Hafta 4-6
    238: [7, 8],     // Hafta 7-8
    239: [9, 10],    // Hafta 9-10
    240: [11, 12],   // Hafta 11-12
    241: [13, 14],   // Hafta 13-14
    242: [15, 16],   // Hafta 15-16
    243: [17, 18],   // Hafta 17-18
    244: [19, 20],   // Hafta 19-20
    245: [21, 22],   // Hafta 21-22
    246: [23, 24],   // Hafta 23-24
    247: [25, 26],   // Hafta 25-26
    248: [27, 28],   // Hafta 27-28
    249: [29, 30],   // Hafta 29-30
    250: [31, 32],   // Hafta 31-32
    251: [33, 33],   // Hafta 33
    252: [35, 36]    // Hafta 35-36
  };
  
  // Her kazanım için outcome_weeks kaydı
  const baglantilar = [];
  outcomes.forEach(o => {
    const [start, end] = konuHaftalar[o.topic_id] || [1, 1];
    baglantilar.push({
      outcome_id: o.id,
      start_week: start,
      end_week: end
    });
  });
  
  console.log('Toplam kayıt: ' + baglantilar.length);
  
  // 30'arlı ekle
  const batchSize = 30;
  let eklenen = 0;
  
  for (let i = 0; i < baglantilar.length; i += batchSize) {
    const batch = baglantilar.slice(i, i + batchSize);
    const { error } = await supabase.from('outcome_weeks').insert(batch);
    if (!error) {
      eklenen += batch.length;
      console.log('✅ Batch ' + Math.floor(i/batchSize + 1) + ': ' + batch.length);
    } else {
      console.log('❌ Hata: ' + error.message);
    }
  }
  
  console.log('\n🎉 Toplam ' + eklenen + ' kayıt eklendi');
}

ekle();
