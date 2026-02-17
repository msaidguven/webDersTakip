const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pwzbjhgrhkcdyowknmhe.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function ekle() {
  // Kazanımlar ve hafta bilgileri
  const kazanimlar = [
    // HAFTA 1 - Konu 235
    {topic_id: 235, desc: "a) Dâhil olduğu gruplar ve bu gruplardaki rollerinin zaman içerisinde değişebileceğine ilişkin varsayımda bulunur.", order: 1, hafta: 1},
    {topic_id: 235, desc: "b) Farklı grupları ve bu gruplardaki rolleri listeler.", order: 2, hafta: 1},
    {topic_id: 235, desc: "c) Farklı grupları ve bu gruplardaki rolleri karşılaştırır.", order: 3, hafta: 1},
    {topic_id: 235, desc: "ç) Gelecekte dâhil olabileceği gruplar ve roller ile ilgili tahminlerde bulunur.", order: 4, hafta: 1},
    {topic_id: 235, desc: "d) Dâhil olduğu grupların ve bu gruplardaki rollerinin zaman içinde değişebileceğini değerlendirir.", order: 5, hafta: 1},
    
    // HAFTA 2 - Konu 236
    {topic_id: 236, desc: "a) Kültürel bağlarımızın ve millî değerlerimizin toplumsal birliğe etkisini inceler.", order: 1, hafta: 2},
    {topic_id: 236, desc: "b) Kültürel bağlarımızın ve millî değerlerimizin toplumsal birliğe etkisine ilişkin edindiği bilgileri yazılı, görsel veya dijital bir ürüne dönüştürür.", order: 2, hafta: 2},
    {topic_id: 236, desc: "c) Kültürel bağlarımızın ve millî değerlerimizin toplumsal birliğe etkisini ifade eder.", order: 3, hafta: 2},
    
    // HAFTA 3 - Konu 236
    {topic_id: 236, desc: "a) Kültürel bağlarımızın ve millî değerlerimizin toplumsal birliğe etkisini inceler.", order: 1, hafta: 3},
    {topic_id: 236, desc: "b) Kültürel bağlarımızın ve millî değerlerimizin toplumsal birliğe etkisine ilişkin edindiği bilgileri yazılı, görsel veya dijital bir ürüne dönüştürür.", order: 2, hafta: 3},
    {topic_id: 236, desc: "c) Kültürel bağlarımızın ve millî değerlerimizin toplumsal birliğe etkisini ifade eder.", order: 3, hafta: 3},
    
    // HAFTA 4 - Konu 237
    {topic_id: 237, desc: "a) Toplumsal hayatta karşılaşılan sorunları fark eder.", order: 1, hafta: 4},
    {topic_id: 237, desc: "b) Toplumsal hayatta karşılaşılan sorunların nedenlerine yönelik farklı bakış açılarını karşılaştırır.", order: 2, hafta: 4},
    {topic_id: 237, desc: "c) Toplumsal hayatta karşılaşılan sorunlara yönelik çözüm önerileri geliştirir.", order: 3, hafta: 4},
    {topic_id: 237, desc: "ç) Toplumsal hayatta karşılaşılan sorunlara yönelik çözüm önerilerini farklı görüş ve düşünceleri dikkate alarak düzenler.", order: 4, hafta: 4},
    {topic_id: 237, desc: "d) Toplumsal hayatta karşılaşılan sorunlara yönelik çözüm önerilerini savunur.", order: 5, hafta: 4},
    
    // HAFTA 5 - Konu 237
    {topic_id: 237, desc: "a) Toplumsal hayatta karşılaşılan sorunları fark eder.", order: 1, hafta: 5},
    {topic_id: 237, desc: "b) Toplumsal hayatta karşılaşılan sorunların nedenlerine yönelik farklı bakış açılarını karşılaştırır.", order: 2, hafta: 5},
    {topic_id: 237, desc: "c) Toplumsal hayatta karşılaşılan sorunlara yönelik çözüm önerileri geliştirir.", order: 3, hafta: 5},
    {topic_id: 237, desc: "ç) Toplumsal hayatta karşılaşılan sorunlara yönelik çözüm önerilerini farklı görüş ve düşünceleri dikkate alarak düzenler.", order: 4, hafta: 5},
    {topic_id: 237, desc: "d) Toplumsal hayatta karşılaşılan sorunlara yönelik çözüm önerilerini savunur.", order: 5, hafta: 5},
    
    // HAFTA 6 - Konu 237
    {topic_id: 237, desc: "a) Toplumsal hayatta karşılaşılan sorunları fark eder.", order: 1, hafta: 6},
    {topic_id: 237, desc: "b) Toplumsal hayatta karşılaşılan sorunların nedenlerine yönelik farklı bakış açılarını karşılaştırır.", order: 2, hafta: 6},
    {topic_id: 237, desc: "c) Toplumsal hayatta karşılaşılan sorunlara yönelik çözüm önerileri geliştirir.", order: 3, hafta: 6},
    {topic_id: 237, desc: "ç) Toplumsal hayatta karşılaşılan sorunlara yönelik çözüm önerilerini farklı görüş ve düşünceleri dikkate alarak düzenler.", order: 4, hafta: 6},
    {topic_id: 237, desc: "d) Toplumsal hayatta karşılaşılan sorunlara yönelik çözüm önerilerini savunur.", order: 5, hafta: 6},
    
    // HAFTA 7 - Konu 238
    {topic_id: 238, desc: "a) Ülkemizin göreceli ve mutlak konum özellikleri ile kıtaların ve okyanusların göreceli konum özelliklerini belirler.", order: 1, hafta: 7},
    {topic_id: 238, desc: "b) Ülkemizin göreceli ve mutlak konum özellikleri ile kıtaların ve okyanusların göreceli konum özelliklerini görselleştirir.", order: 2, hafta: 7},
    {topic_id: 238, desc: "c) Ülkemizin göreceli ve mutlak konum özellikleri ile kıtaların ve okyanusların göreceli konum özelliklerini özetler.", order: 3, hafta: 7},
    
    // HAFTA 8 - Konu 238
    {topic_id: 238, desc: "a) Ülkemizin göreceli ve mutlak konum özellikleri ile kıtaların ve okyanusların göreceli konum özelliklerini belirler.", order: 1, hafta: 8},
    {topic_id: 238, desc: "b) Ülkemizin göreceli ve mutlak konum özellikleri ile kıtaların ve okyanusların göreceli konum özelliklerini görselleştirir.", order: 2, hafta: 8},
    {topic_id: 238, desc: "c) Ülkemizin göreceli ve mutlak konum özellikleri ile kıtaların ve okyanusların göreceli konum özelliklerini özetler.", order: 3, hafta: 8},
    
    // HAFTA 9 - Konu 239
    {topic_id: 239, desc: "a) Ülkemizdeki doğal ve beşerî çevre özelliklerini belirler.", order: 1, hafta: 9},
    {topic_id: 239, desc: "b) Ülkemizdeki doğal ve beşerî çevre özellikleri arasındaki ilişkiyi belirler.", order: 2, hafta: 9},
    
    // HAFTA 10 - Konu 239
    {topic_id: 239, desc: "a) Ülkemizdeki doğal ve beşerî çevre özelliklerini belirler.", order: 1, hafta: 10},
    {topic_id: 239, desc: "b) Ülkemizdeki doğal ve beşerî çevre özellikleri arasındaki ilişkiyi belirler.", order: 2, hafta: 10},
    
    // HAFTA 11 - Konu 240
    {topic_id: 240, desc: "a) Ülkemizin Türk dünyası ile kültürel iş birliklerini inceler.", order: 1, hafta: 11},
    {topic_id: 240, desc: "b) Ülkemizin Türk dünyası ile kültürel iş birliğine örnekler verir.", order: 2, hafta: 11},
    {topic_id: 240, desc: "c) Ülkemizin Türk dünyasıyla kültürel iş birliklerini ifade eder.", order: 3, hafta: 11},
    
    // HAFTA 12 - Konu 240
    {topic_id: 240, desc: "a) Ülkemizin Türk dünyası ile kültürel iş birliklerini inceler.", order: 1, hafta: 12},
    {topic_id: 240, desc: "b) Ülkemizin Türk dünyası ile kültürel iş birliğine örnekler verir.", order: 2, hafta: 12},
    {topic_id: 240, desc: "c) Ülkemizin Türk dünyasıyla kültürel iş birliklerini ifade eder.", order: 3, hafta: 12},
    
    // HAFTA 13 - Konu 241
    {topic_id: 241, desc: "a) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında merak ettiği konuyu tanımlar.", order: 1, hafta: 13},
    {topic_id: 241, desc: "b) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında verilen kaynaklara dayanarak sorular sorar (5N1K).", order: 2, hafta: 13},
    {topic_id: 241, desc: "c) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında verilen kaynaklardan bilgi toplar.", order: 3, hafta: 13},
    {topic_id: 241, desc: "ç) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında topladığı bilgilerin doğruluğunu değerlendirir.", order: 4, hafta: 13},
    {topic_id: 241, desc: "d) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında toplanan bilgiler üzerinden çıkarım yapar.", order: 5, hafta: 13},
    
    // HAFTA 14 - Konu 241
    {topic_id: 241, desc: "a) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında merak ettiği konuyu tanımlar.", order: 1, hafta: 14},
    {topic_id: 241, desc: "b) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında verilen kaynaklara dayanarak sorular sorar (5N1K).", order: 2, hafta: 14},
    {topic_id: 241, desc: "c) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında verilen kaynaklardan bilgi toplar.", order: 3, hafta: 14},
    {topic_id: 241, desc: "ç) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında topladığı bilgilerin doğruluğunu değerlendirir.", order: 4, hafta: 14},
    {topic_id: 241, desc: "d) Türkistan'da kurulan ilk Türk devletlerinin medeniyetimize katkıları hakkında toplanan bilgiler üzerinden çıkarım yapar.", order: 5, hafta: 14},
    
    // HAFTA 15 - Konu 242
    {topic_id: 242, desc: "a) İslam medeniyetinin insanlığın ortak mirasına katkılarını belirler.", order: 1, hafta: 15},
    {topic_id: 242, desc: "b) İslam medeniyetinin insanlığın ortak mirasına yaptığı katkıları eğitim, bilim, hukuk, kültür, sanat ve mimari alanları ile ilişkilendirir.", order: 2, hafta: 15},
    {topic_id: 242, desc: "c) İslam medeniyetinin insanlığın ortak mirasına yaptığı katkıları eğitim, bilim, hukuk, kültür, sanat ve mimari alanları açısından çıkarım yapar.", order: 3, hafta: 15},
    
    // HAFTA 16 - Konu 242
    {topic_id: 242, desc: "a) İslam medeniyetinin insanlığın ortak mirasına katkılarını belirler.", order: 1, hafta: 16},
    {topic_id: 242, desc: "b) İslam medeniyetinin insanlığın ortak mirasına yaptığı katkıları eğitim, bilim, hukuk, kültür, sanat ve mimari alanları ile ilişkilendirir.", order: 2, hafta: 16},
    {topic_id: 242, desc: "c) İslam medeniyetinin insanlığın ortak mirasına yaptığı katkıları eğitim, bilim, hukuk, kültür, sanat ve mimari alanları açısından çıkarım yapar.", order: 3, hafta: 16},
    
    // HAFTA 17 - Konu 243
    {topic_id: 243, desc: "a) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişimi kaynaklara dayanarak çözümler.", order: 1, hafta: 17},
    {topic_id: 243, desc: "b) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişime ilişkin dönemin koşullarını fark eder.", order: 2, hafta: 17},
    {topic_id: 243, desc: "c) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişimin sonuçlarını günümüz koşullarıyla karşılaştırır.", order: 3, hafta: 17},
    {topic_id: 243, desc: "ç) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişimin sonuçlarını dönemin koşulları içinde açıklar.", order: 4, hafta: 17},
    
    // HAFTA 18 - Konu 243
    {topic_id: 243, desc: "a) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişimi kaynaklara dayanarak çözümler.", order: 1, hafta: 18},
    {topic_id: 243, desc: "b) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişime ilişkin dönemin koşullarını fark eder.", order: 2, hafta: 18},
    {topic_id: 243, desc: "c) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişimin sonuçlarını günümüz koşullarıyla karşılaştırır.", order: 3, hafta: 18},
    {topic_id: 243, desc: "ç) İslamiyet'in kabulüyle Türklerin sosyal ve kültürel hayatlarında meydana gelen değişimin sonuçlarını dönemin koşulları içinde açıklar.", order: 4, hafta: 18},
    
    // HAFTA 19 - Konu 244
    {topic_id: 244, desc: "a) XI-XIII. yüzyıllar arasında Anadolu'nun Türkleşmesi ve İslamlaşmasına etkide bulunan siyasi faaliyetler ve askerî mücadeleleri çözümler.", order: 1, hafta: 19},
    {topic_id: 244, desc: "b) XI-XIII. yüzyıllar arasında Anadolu'nun Türkleşmesi ve İslamlaşmasına etkide bulunan siyasi faaliyetler ve askerî mücadeleleri sınıflandırır.", order: 2, hafta: 19},
    {topic_id: 244, desc: "c) XI-XIII. yüzyıllar arasında meydana gelen siyasi faaliyetler ve askerî mücadelelerin Anadolu'nun Türkleşmesi ve İslamlaşmasına etkisini yorumlar.", order: 3, hafta: 19},
    
    // HAFTA 20 - Konu 244
    {topic_id: 244, desc: "a) XI-XIII. yüzyıllar arasında Anadolu'nun Türkleşmesi ve İslamlaşmasına etkide bulunan siyasi faaliyetler ve askerî mücadeleleri çözümler.", order: 1, hafta: 20},
    {topic_id: 244, desc: "b) XI-XIII. yüzyıllar arasında Anadolu'nun Türkleşmesi ve İslamlaşmasına etkide bulunan siyasi faaliyetler ve askerî mücadeleleri sınıflandırır.", order: 2, hafta: 20},
    {topic_id: 244, desc: "c) XI-XIII. yüzyıllar arasında meydana gelen siyasi faaliyetler ve askerî mücadelelerin Anadolu'nun Türkleşmesi ve İslamlaşmasına etkisini yorumlar.", order: 3, hafta: 20},
    
    // HAFTA 21 - Konu 245
    {topic_id: 245, desc: "a) Yönetimin karar alma sürecini etkileyen unsurları belirler.", order: 1, hafta: 21},
    {topic_id: 245, desc: "b) Yönetimin karar alma sürecini etkileyen unsurlar arasındaki ilişkiyi belirler.", order: 2, hafta: 21},
    
    // HAFTA 22 - Konu 245
    {topic_id: 245, desc: "a) Yönetimin karar alma sürecini etkileyen unsurları belirler.", order: 1, hafta: 22},
    {topic_id: 245, desc: "b) Yönetimin karar alma sürecini etkileyen unsurlar arasındaki ilişkiyi belirler.", order: 2, hafta: 22},
    
    // HAFTA 23 - Konu 246
    {topic_id: 246, desc: "a) Toplumsal düzenin sürdürülmesinde temel hak ve sorumlulukların önemini inceler.", order: 1, hafta: 23},
    {topic_id: 246, desc: "b) Toplumsal düzenin sürdürülmesinde temel hak ve sorumlulukların önemini yazılı, görsel veya dijital yollarla sunar.", order: 2, hafta: 23},
    {topic_id: 246, desc: "c) Toplumsal düzenin sürdürülmesinde temel hak ve sorumlulukların önemini ifade eder.", order: 3, hafta: 23},
    
    // HAFTA 24 - Konu 246
    {topic_id: 246, desc: "a) Toplumsal düzenin sürdürülmesinde temel hak ve sorumlulukların önemini inceler.", order: 1, hafta: 24},
    {topic_id: 246, desc: "b) Toplumsal düzenin sürdürülmesinde temel hak ve sorumlulukların önemini yazılı, görsel veya dijital yollarla sunar.", order: 2, hafta: 24},
    {topic_id: 246, desc: "c) Toplumsal düzenin sürdürülmesinde temel hak ve sorumlulukların önemini ifade eder.", order: 3, hafta: 24},
    
    // HAFTA 25 - Konu 247
    {topic_id: 247, desc: "a) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkilerini tanımlar.", order: 1, hafta: 25},
    {topic_id: 247, desc: "b) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında sorular sorar (5N1K).", order: 2, hafta: 25},
    {topic_id: 247, desc: "c) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında bilgi toplar.", order: 3, hafta: 25},
    {topic_id: 247, desc: "ç) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında topladığı bilgileri güncellik ve bilimsellik açısından değerlendirir.", order: 4, hafta: 25},
    {topic_id: 247, desc: "d) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında doğruluğunu değerlendirdiği bilgilerden hareketle çıkarımlar yapar.", order: 5, hafta: 25},
    
    // HAFTA 26 - Konu 247
    {topic_id: 247, desc: "a) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkilerini tanımlar.", order: 1, hafta: 26},
    {topic_id: 247, desc: "b) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında sorular sorar (5N1K).", order: 2, hafta: 26},
    {topic_id: 247, desc: "c) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında bilgi toplar.", order: 3, hafta: 26},
    {topic_id: 247, desc: "ç) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında topladığı bilgileri güncellik ve bilimsellik açısından değerlendirir.", order: 4, hafta: 26},
    {topic_id: 247, desc: "d) Vatandaşlık haklarının kullanımında dijitalleşme ve teknolojik gelişmelerin etkileri hakkında doğruluğunu değerlendirdiği bilgilerden hareketle çıkarımlar yapar.", order: 5, hafta: 26},
    
    // HAFTA 27 - Konu 248
    {topic_id: 248, desc: "a) Ülkemizin kaynakları ve ekonomik faaliyetlerin özelliklerini belirler.", order: 1, hafta: 27},
    {topic_id: 248, desc: "b) Ülkemizin kaynakları ve ekonomik faaliyetler arasındaki ilişkiyi belirler.", order: 2, hafta: 27},
    
    // HAFTA 28 - Konu 248
    {topic_id: 248, desc: "a) Ülkemizin kaynakları ve ekonomik faaliyetlerin özelliklerini belirler.", order: 1, hafta: 28},
    {topic_id: 248, desc: "b) Ülkemizin kaynakları ve ekonomik faaliyetler arasındaki ilişkiyi belirler.", order: 2, hafta: 28},
    
    // HAFTA 29 - Konu 249
    {topic_id: 249, desc: "a) Gözlem ve deneyimlerinden yola çıkarak ekonomik faaliyetler ve meslekler arasındaki ilişkiyi belirler.", order: 1, hafta: 29},
    {topic_id: 249, desc: "b) Ekonomik faaliyetlerdeki değişime bağlı olarak gelecekte ortaya çıkabilecek meslekleri tahmin eder.", order: 2, hafta: 29},
    
    // HAFTA 30 - Konu 249
    {topic_id: 249, desc: "a) Gözlem ve deneyimlerinden yola çıkarak ekonomik faaliyetler ve meslekler arasındaki ilişkiyi belirler.", order: 1, hafta: 30},
    {topic_id: 249, desc: "b) Ekonomik faaliyetlerdeki değişime bağlı olarak gelecekte ortaya çıkabilecek meslekleri tahmin eder.", order: 2, hafta: 30},
    
    // HAFTA 31 - Konu 250
    {topic_id: 250, desc: "a) Tasarladığı bir ürün için yatırım ve pazarlama projelerini sunar.", order: 1, hafta: 31},
    {topic_id: 250, desc: "b) Tasarladığı ürünün yatırım ve pazarlama alanlarına ilişkin görevleri belirler.", order: 2, hafta: 31},
    {topic_id: 250, desc: "c) Olası riskleri değerlendirerek tasarladığı ürünün yatırım ve pazarlama aşaması için gerekli kaynakları belirler.", order: 3, hafta: 31},
    {topic_id: 250, desc: "ç) Tasarladığı ürünün yatırım ve pazarlama aşaması için gerekli kaynakları tahsis eder.", order: 4, hafta: 31},
    {topic_id: 250, desc: "d) Tasarladığı ürün için yatırım ve pazarlama proje öneri raporu hazırlar.", order: 5, hafta: 31},
    
    // HAFTA 32 - Konu 250
    {topic_id: 250, desc: "a) Tasarladığı bir ürün için yatırım ve pazarlama projelerini sunar.", order: 1, hafta: 32},
    {topic_id: 250, desc: "b) Tasarladığı ürünün yatırım ve pazarlama alanlarına ilişkin görevleri belirler.", order: 2, hafta: 32},
    {topic_id: 250, desc: "c) Olası riskleri değerlendirerek tasarladığı ürünün yatırım ve pazarlama aşaması için gerekli kaynakları belirler.", order: 3, hafta: 32},
    {topic_id: 250, desc: "ç) Tasarladığı ürünün yatırım ve pazarlama aşaması için gerekli kaynakları tahsis eder.", order: 4, hafta: 32},
    {topic_id: 250, desc: "d) Tasarladığı ürün için yatırım ve pazarlama proje öneri raporu hazırlar.", order: 5, hafta: 32},
    
    // HAFTA 33 - Konu 251
    {topic_id: 251, desc: "a) Ulaşım ve iletişim teknolojilerindeki gelişmelerin kültürel etkileşime yönelik nedensel ilişkileri ortaya koyar.", order: 1, hafta: 33},
    {topic_id: 251, desc: "b) Ulaşım ve iletişim teknolojilerindeki gelişmelerin kültürel etkileşime yönelik sonuçlarını açıklar.", order: 2, hafta: 33},
    
    // HAFTA 35 - Konu 252
    {topic_id: 252, desc: "a) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili bilgi toplayacağı kaynakları belirler.", order: 1, hafta: 35},
    {topic_id: 252, desc: "b) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili bilgileri belirlediği kaynaklardan toplar.", order: 2, hafta: 35},
    {topic_id: 252, desc: "c) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili topladığı bilgileri doğrular.", order: 3, hafta: 35},
    {topic_id: 252, desc: "ç) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili doğruladığı bilgileri kaydeder.", order: 4, hafta: 35},
    
    // HAFTA 36 - Konu 252
    {topic_id: 252, desc: "a) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili bilgi toplayacağı kaynakları belirler.", order: 1, hafta: 36},
    {topic_id: 252, desc: "b) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili bilgileri belirlediği kaynaklardan toplar.", order: 2, hafta: 36},
    {topic_id: 252, desc: "c) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili topladığı bilgileri doğrular.", order: 3, hafta: 36},
    {topic_id: 252, desc: "ç) Bir ürün veya fikrin telif ve patent süreçleriyle ilgili doğruladığı bilgileri kaydeder.", order: 4, hafta: 36}
  ];
  
  console.log('Toplam kazanım: ' + kazanimlar.length);
  console.log('Ekleniyor...\n');
  
  let basarili = 0;
  let hatali = 0;
  const eklenenler = [];
  
  for (const k of kazanimlar) {
    const { data, error } = await supabase.from('outcomes').insert([{
      topic_id: k.topic_id,
      description: k.desc,
      order_index: k.order
    }]).select();
    
    if (error) {
      console.log('❌ Hata: ' + error.message);
      hatali++;
    } else {
      basarili++;
      eklenenler.push({
        outcome_id: data[0].id,
        hafta: k.hafta,
        topic_id: k.topic_id
      });
    }
  }
  
  console.log('\n✅ outcomes: ' + basarili + ' kazanım eklendi');
  console.log('❌ Hatalı: ' + hatali);
  
  // Şimdi outcome_weeks tablosuna hafta bilgilerini ekle
  console.log('\n📅 outcome_weeks ekleniyor...\n');
  
  let owBasarili = 0;
  let owHatali = 0;
  
  for (const item of eklenenler) {
    const { error } = await supabase.from('outcome_weeks').insert([{
      outcome_id: item.outcome_id,
      week: item.hafta,
      lesson_id: 4
    }]);
    
    if (error) {
      console.log('❌ Hafta ' + item.hafta + ' hata: ' + error.message);
      owHatali++;
    } else {
      owBasarili++;
    }
  }
  
  console.log('\n✅ outcome_weeks: ' + owBasarili + ' kayıt eklendi');
  console.log('❌ Hatalı: ' + owHatali);
  console.log('\n🎉 TOPLAM: ' + basarili + ' KAZANIM ve ' + owBasarili + ' HAFTA BAĞLANTISI EKLENDİ!');
}

ekle();
