const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function ekle() {
  const units = {
    "BİRLİKTE YAŞAMAK": 352,
    "EVİMİZ DÜNYA": 353,
    "ORTAK MİRASIMIZ": 354,
    "YAŞAYAN DEMOKRASİMİZ": 355,
    "HAYATIMIZDAKİ EKONOMİ": 356,
    "TEKNOLOJİ VE SOSYAL BİLİMLER": 357
  };
  
  console.log("📁 ÜNİTE 1: BİRLİKTE YAŞAMAK");
  await supabase.from("topics").insert([{unit_id: units["BİRLİKTE YAŞAMAK"], title: "Zaman İçinde Değişen Gruplar ve Roller", order_no: 1, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["BİRLİKTE YAŞAMAK"], title: "Kültürel Bağlarımızın ve Millî Değerlerimizin Toplumsal Birlikteliğe Etkisi", order_no: 2, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["BİRLİKTE YAŞAMAK"], title: "Toplumsal Sorunlar ve Çözüm Önerileri", order_no: 4, is_active: true}]);
  console.log("  ✅ 3 konu eklendi");
  
  console.log("\n📁 ÜNİTE 2: EVİMİZ DÜNYA");
  await supabase.from("topics").insert([{unit_id: units["EVİMİZ DÜNYA"], title: "Ülkemizin, Kıtaların ve Okyanusların Konum Özellikleri", order_no: 7, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["EVİMİZ DÜNYA"], title: "Doğal ve Beşerî Çevre Özellikleri Arasındaki İlişki", order_no: 9, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["EVİMİZ DÜNYA"], title: "Ülkemizin Türk Dünyasıyla Kültürel İş Birlikleri", order_no: 11, is_active: true}]);
  console.log("  ✅ 3 konu eklendi");
  
  console.log("\n📁 ÜNİTE 3: ORTAK MİRASIMIZ");
  await supabase.from("topics").insert([{unit_id: units["ORTAK MİRASIMIZ"], title: "Türkistan'da Kurulan İlk Türk Devletlerinin Medeniyetimize Katkıları", order_no: 13, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["ORTAK MİRASIMIZ"], title: "VII-XIII. Yüzyıllar Arasında İslam Medeniyetinin İnsanlığın Ortak Mirasına Katkıları", order_no: 15, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["ORTAK MİRASIMIZ"], title: "İslamiyet'in Kabulüyle Türklerin Sosyal ve Kültürel Hayatlarında Meydana Gelen Değişimler", order_no: 17, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["ORTAK MİRASIMIZ"], title: "XI-XIII. Yüzyıllar Arasında Meydana Gelen Askerî Mücadelelerin Anadolu'nun Türkleşmesine Katkıları", order_no: 19, is_active: true}]);
  console.log("  ✅ 4 konu eklendi");
  
  console.log("\n📁 ÜNİTE 4: YAŞAYAN DEMOKRASİMİZ");
  await supabase.from("topics").insert([{unit_id: units["YAŞAYAN DEMOKRASİMİZ"], title: "Yönetimin Karar Alma Sürecini Etkileyen Unsurlar", order_no: 21, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["YAŞAYAN DEMOKRASİMİZ"], title: "Temel Hak ve Sorumlulukların Toplumsal Düzenin Sürdürülmesindeki Önemi", order_no: 23, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["YAŞAYAN DEMOKRASİMİZ"], title: "Dijitalleşme ve Teknolojik Gelişmelerin Vatandaşlık Hak ve Sorumluluklarına Etkileri", order_no: 25, is_active: true}]);
  console.log("  ✅ 3 konu eklendi");
  
  console.log("\n📁 ÜNİTE 5: HAYATIMIZDAKİ EKONOMİ");
  await supabase.from("topics").insert([{unit_id: units["HAYATIMIZDAKİ EKONOMİ"], title: "Ülkemizin Kaynakları ve Ekonomik Faaliyetler", order_no: 27, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["HAYATIMIZDAKİ EKONOMİ"], title: "Ekonomik Faaliyetler ve Meslekler", order_no: 29, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["HAYATIMIZDAKİ EKONOMİ"], title: "Tasarlanan Bir Ürünün Yatırım ve Pazarlama Süreci", order_no: 31, is_active: true}]);
  console.log("  ✅ 3 konu eklendi");
  
  console.log("\n📁 ÜNİTE 6: TEKNOLOJİ VE SOSYAL BİLİMLER");
  await supabase.from("topics").insert([{unit_id: units["TEKNOLOJİ VE SOSYAL BİLİMLER"], title: "Ulaşım ve İletişim Teknolojilerinin Kültürel Etkileşimdeki Rolü", order_no: 33, is_active: true}]);
  await supabase.from("topics").insert([{unit_id: units["TEKNOLOJİ VE SOSYAL BİLİMLER"], title: "Telif ve Patent Süreci", order_no: 35, is_active: true}]);
  console.log("  ✅ 2 konu eklendi");
  
  console.log("\n🎉 TÜM KONULAR EKLENDİ!");
}

ekle();
