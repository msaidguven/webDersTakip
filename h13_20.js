const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pwzbjhgrhkcdyowknmhe.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function ekle() {
  console.log('Hafta 13-20...');
  
  // Hafta 13-14
  const h13 = await supabase.from('outcomes').insert([
    {topic_id: 241, description: "a) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında merak ettiği konuyu tanımlar.", order_index: 1},
    {topic_id: 241, description: "b) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında verilen kaynaklara dayanarak sorular sorar.", order_index: 2},
    {topic_id: 241, description: "c) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında verilen kaynaklardan bilgi toplar.", order_index: 3},
    {topic_id: 241, description: "ç) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında topladığı bilgilerin doğruluğunu değerlendirir.", order_index: 4},
    {topic_id: 241, description: "d) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında toplanan bilgiler üzerinden çıkarım yapar.", order_index: 5}
  ]).select();
  
  for (let i = 0; i < h13.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h13.data[i].id, week: 13, lesson_id: 4},
      {outcome_id: h13.data[i].id, week: 14, lesson_id: 4}
    ]);
  }
  console.log('✅ Hafta 13-14');
  
  // Hafta 15-16
  const h15 = await supabase.from('outcomes').insert([
    {topic_id: 242, description: "a) İslam medeniyetinin insanlığın ortak mirasına katkılarını belirler.", order_index: 1},
    {topic_id: 242, description: "b) İslam medeniyetinin insanlığın ortak mirasına yaptığı katkıları eğitim, bilim, hukuk, kültür, sanat ve mimari alanları ile ilişkilendirir.", order_index: 2},
    {topic_id: 242, description: "c) İslam medeniyetinin insanlığın ortak mirasına yaptığı katkıları eğitim, bilim, hukuk, kültür, sanat ve mimari alanları açısından çıkarım yapar.", order_index: 3}
  ]).select();
  
  for (let i = 0; i < h15.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h15.data[i].id, week: 15, lesson_id: 4},
      {outcome_id: h15.data[i].id, week: 16, lesson_id: 4}
    ]);
  }
  console.log('✅ Hafta 15-16');
  
  // Hafta 17-18
  const h17 = await supabase.from('outcomes').insert([
    {topic_id: 243, description: "a) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişimi kaynaklara dayanarak çözümler.", order_index: 1},
    {topic_id: 243, description: "b) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişime ilişkin dönemin koşullarını fark eder.", order_index: 2},
    {topic_id: 243, description: "c) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişimin sonuçlarını günümüz koşullarıyla karşılaştırır.", order_index: 3},
    {topic_id: 243, description: "ç) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişimin sonuçlarını dönemin koşulları içinde açıklar.", order_index: 4}
  ]).select();
  
  for (let i = 0; i < h17.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h17.data[i].id, week: 17, lesson_id: 4},
      {outcome_id: h17.data[i].id, week: 18, lesson_id: 4}
    ]);
  }
  console.log('✅ Hafta 17-18');
  
  // Hafta 19-20
  const h19 = await supabase.from('outcomes').insert([
    {topic_id: 244, description: "a) XI-XIII. yüzyıllar arasında Anadolu'nun Türkleşmesi ve İslamlaşmasına etkide bulunan siyasi faaliyetler ve askerî mücadeleleri çözümler.", order_index: 1},
    {topic_id: 244, description: "b) XI-XIII. yüzyıllar arasında Anadolu'nun Türkleşmesi ve İslamlaşmasına etkide bulunan siyasi faaliyetler ve askerî mücadeleleri sınıflandırır.", order_index: 2},
    {topic_id: 244, description: "c) XI-XIII. yüzyıllar arasında meydana gelen siyasi faaliyetler ve askerî mücadelelerin Anadolu'nun Türkleşmesi ve İslamlaşmasına etkisini yorumlar.", order_index: 3}
  ]).select();
  
  for (let i = 0; i < h19.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h19.data[i].id, week: 19, lesson_id: 4},
      {outcome_id: h19.data[i].id, week: 20, lesson_id: 4}
    ]);
  }
  console.log('✅ Hafta 19-20');
  
  console.log('\n🎉 Hafta 13-20 tamamlandı!');
}

ekle();
