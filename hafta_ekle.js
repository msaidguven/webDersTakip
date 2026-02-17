const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pwzbjhgrhkcdyowknmhe.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function haftaEkle() {
  console.log('Hafta bağlantıları ekleniyor...');
  
  // Mevcut kazanımları al
  const { data: outcomes } = await supabase
    .from('outcomes')
    .select('id, topic_id, description')
    .in('topic_id', [235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252])
    .order('topic_id')
    .order('id');
  
  // Konu-hafta eşleştirmesi
  const konuHaftalar = {
    235: [1],        // Zaman İçinde Değişen Gruplar
    236: [2, 3],     // Kültürel Bağlarımız
    237: [4, 5, 6],  // Toplumsal Sorunlar
    238: [7, 8],     // Konum Özellikleri
    239: [9, 10],    // Çevre Özellikleri
    240: [11, 12],   // İş Birlikleri
    241: [13, 14],   // İlk Türk Devletleri
    242: [15, 16],   // İslam Medeniyeti
    243: [17, 18],   // Sosyal Değişimler
    244: [19, 20],   // Askeri Mücadeleler
    245: [21, 22],   // Karar Alma Süreci
    246: [23, 24],   // Hak ve Sorumluluklar
    247: [25, 26],   // Dijitalleşme
    248: [27, 28],   // Ekonomik Faaliyetler
    249: [29, 30],   // Meslekler
    250: [31, 32],   // Yatırım ve Pazarlama
    251: [33],       // Ulaşım Teknolojileri
    252: [35, 36]    // Telif ve Patent
  };
  
  let eklenen = 0;
  
  for (const o of outcomes) {
    const haftalar = konuHaftalar[o.topic_id] || [];
    for (const hafta of haftalar) {
      const { error } = await supabase.from('outcome_weeks').insert({
        outcome_id: o.id,
        week: hafta
      });
      if (!error) eklenen++;
    }
  }
  
  console.log('✅ ' + eklenen + ' hafta bağlantısı eklendi');
}

haftaEkle();
