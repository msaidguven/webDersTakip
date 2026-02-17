const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pwzbjhgrhkcdyowknmhe.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function ekle() {
  console.log('Hafta 21-36...');
  
  // Hafta 21-22
  const h21 = await supabase.from('outcomes').insert([
    {topic_id: 245, description: "a) Yönetimin karar alma sürecini etkileyen unsurları belirler.", order_index: 1},
    {topic_id: 245, description: "b) Yönetimin karar alma sürecini etkileyen unsurlar arasındaki ilişkiyi belirler.", order_index: 2}
  ]).select();
  
  for (let i = 0; i < h21.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h21.data[i].id, week: 21},
      {outcome_id: h21.data[i].id, week: 22}
    ]);
  }
  console.log('✅ Hafta 21-22');
  
  // Hafta 23-24
  const h23 = await supabase.from('outcomes').insert([
    {topic_id: 246, description: "a) Toplumsal düzenin sürdürülmesinde temel hak ve sorumlulukların önemini inceler.", order_index: 1},
    {topic_id: 246, description: "b) Toplumsal düzenin sürdürülmesinde temel hak ve sorumlulukların önemini yazılı, görsel veya dijital yollarla sunar.", order_index: 2},
    {topic_id: 246, description: "c) Toplumsal düzenin sürdürülmesinde temel hak ve sorumlulukların önemini ifade eder.", order_index: 3}
  ]).select();
  
  for (let i = 0; i < h23.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h23.data[i].id, week: 23},
      {outcome_id: h23.data[i].id, week: 24}
    ]);
  }
  console.log('✅ Hafta 23-24');
  
  // Hafta 25-26
  const h25 = await supabase.from('outcomes').insert([
    {topic_id: 247, description: "a) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkilerini tanımlar.", order_index: 1},
    {topic_id: 247, description: "b) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında sorular sorar.", order_index: 2},
    {topic_id: 247, description: "c) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında bilgi toplar.", order_index: 3},
    {topic_id: 247, description: "ç) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında topladığı bilgileri güncellik ve bilimsellik açısından değerlendirir.", order_index: 4},
    {topic_id: 247, description: "d) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında doğruluğunu değerlendirdiği bilgilerden hareketle çıkarımlar yapar.", order_index: 5}
  ]).select();
  
  for (let i = 0; i < h25.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h25.data[i].id, week: 25},
      {outcome_id: h25.data[i].id, week: 26}
    ]);
  }
  console.log('✅ Hafta 25-26');
  
  // Hafta 27-28
  const h27 = await supabase.from('outcomes').insert([
    {topic_id: 248, description: "a) Ülkemizin kaynakları ve ekonomik faaliyetlerin özelliklerini belirler.", order_index: 1},
    {topic_id: 248, description: "b) Ülkemizin kaynakları ve ekonomik faaliyetler arasındaki ilişkiyi belirler.", order_index: 2}
  ]).select();
  
  for (let i = 0; i < h27.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h27.data[i].id, week: 27},
      {outcome_id: h27.data[i].id, week: 28}
    ]);
  }
  console.log('✅ Hafta 27-28');
  
  // Hafta 29-30
  const h29 = await supabase.from('outcomes').insert([
    {topic_id: 249, description: "a) Gözlem ve deneyimlerinden yola çıkarak ekonomik faaliyetler ve meslekler arasındaki ilişkiyi belirler.", order_index: 1},
    {topic_id: 249, description: "b) Ekonomik faaliyetlerdeki değişime bağlı olarak gelecekte ortaya çıkabilecek meslekleri tahmin eder.", order_index: 2}
  ]).select();
  
  for (let i = 0; i < h29.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h29.data[i].id, week: 29},
      {outcome_id: h29.data[i].id, week: 30}
    ]);
  }
  console.log('✅ Hafta 29-30');
  
  // Hafta 31-32
  const h31 = await supabase.from('outcomes').insert([
    {topic_id: 250, description: "a) Tasarladığı bir ürün için yatırım ve pazarlama projelerini sunar.", order_index: 1},
    {topic_id: 250, description: "b) Tasarladığı ürünün yatırım ve pazarlama alanlarına ilişkin görevleri belirler.", order_index: 2},
    {topic_id: 250, description: "c) Olası riskleri değerlendirerek tasarladığı ürünün yatırım ve pazarlama aşaması için gerekli kaynakları belirler.", order_index: 3},
    {topic_id: 250, description: "ç) Tasarladığı ürünün yatırım ve pazarlama aşaması için gerekli kaynakları tahsis eder.", order_index: 4},
    {topic_id: 250, description: "d) Tasarladığı ürün için yatırım ve pazarlama proje öneri raporu hazırlar.", order_index: 5}
  ]).select();
  
  for (let i = 0; i < h31.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h31.data[i].id, week: 31},
      {outcome_id: h31.data[i].id, week: 32}
    ]);
  }
  console.log('✅ Hafta 31-32');
  
  // Hafta 33
  const h33 = await supabase.from('outcomes').insert([
    {topic_id: 251, description: "a) Ulaşım ve iletişim teknolojilerindeki gelişmelerin kültürel etkileşime yönelik nedensel ilişkileri ortaya koyar.", order_index: 1},
    {topic_id: 251, description: "b) Ulaşım ve iletişim teknolojilerindeki gelişmelerin kültürel etkileşime yönelik sonuçlarını açıklar.", order_index: 2}
  ]).select();
  
  for (let i = 0; i < h33.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h33.data[i].id, week: 33}
    ]);
  }
  console.log('✅ Hafta 33');
  
  // Hafta 35-36
  const h35 = await supabase.from('outcomes').insert([
    {topic_id: 252, description: "a) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili bilgi toplayacağı kaynakları belirler.", order_index: 1},
    {topic_id: 252, description: "b) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili bilgileri belirlediği kaynaklardan toplar.", order_index: 2},
    {topic_id: 252, description: "c) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili topladığı bilgileri doğrular.", order_index: 3},
    {topic_id: 252, description: "ç) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili doğruladığı bilgileri kaydeder.", order_index: 4}
  ]).select();
  
  for (let i = 0; i < h35.data.length; i++) {
    await supabase.from('outcome_weeks').insert([
      {outcome_id: h35.data[i].id, week: 35},
      {outcome_id: h35.data[i].id, week: 36}
    ]);
  }
  console.log('✅ Hafta 35-36');
  
  console.log('\n🎉 TÜM KAZANIMLAR EKLENDİ!');
}

ekle();
