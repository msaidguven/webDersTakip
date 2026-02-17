const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pwzbjhgrhkcdyowknmhe.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function duzelt() {
  // 1. Mevcut içerikleri sil
  console.log('Mevcut içerikler siliniyor...');
  await supabase.from('topic_content_weeks').delete().in('topic_content_id', [290, 291]);
  await supabase.from('topic_contents').delete().in('id', [290, 291]);
  console.log('✅ Eski içerikler silindi');
  
  // 2. 19. Hafta İçeriği (Sadece Birinci Bölüm)
  const icerik19 = `<![CDATA[
<title>Anadolu'nun Türk Yurdu Olması - Birinci Bölüm: Malazgirt ve Sonrası</title>

<section>
  <p><strong>Birinci Bölüm: 1071-1176 Dönemi</strong></p>
  <hr/>
  
  <h2>1. Malazgirt Zaferi ve Sonuçları (1071)</h2>
  <p>
    <strong>1071 yılında</strong> Malazgirt Ovası'nda gerçekleşen savaş, Anadolu tarihinin dönüm noktasıdır. <strong>Sultan Alp Arslan</strong> komutasındaki Selçuklu ordusu, Bizans İmparatoru <strong>Romanos Diogenes</strong>'yi esir almıştır.
  </p>
  
  <h3>Zaferin Nedenleri</h3>
  <ul>
    <li>Selçuklu ordusunun üstün taktik ve disiplini.</li>
    <li>Alp Arslan'ın liderlik ve komuta becerisi.</li>
    <li>Bizans ordusunun içindeki ikilikler ve isyanlar.</li>
    <li>Coğrafi koşulların Türk ordusuna avantaj sağlaması.</li>
  </ul>
  
  <h3>Zaferin Sonuçları</h3>
  <ul>
    <li>Anadolu'nun kapıları Türklere açıldı.</li>
    <li>Türkmen aşiretleri güvenli şekilde Anadolu'ya göç etti.</li>
    <li>Bizans İmparatorluğu Anadolu'daki üstünlüğünü kaybetti.</li>
    <li>İslamiyet'in Anadolu'ya yayılması hızlandı.</li>
  </ul>
  
  <hr/>
  
  <h2>2. Anadolu Selçuklu Devleti'nin Kuruluşu (1077)</h2>  
  <p>
    Malazgirt Zaferi'nin ardından <strong>Kutalmışoğlu Süleyman Şah</strong>, İznik'i başkent yaparak <strong>Anadolu Selçuklu Devleti</strong>'ni kurdu. Bu devlet, Anadolu'da kurulan ilk organize Türk devletidir.
  </p>
  
  <h3>Devletin Özellikleri</h3>
  <ul>
    <li>Başkent: İznik (sonradan Konya)</li>
    <li>Hükümranlık alanı: Batı ve Orta Anadolu</li>
    <li>Ordu yapısı: Türkmen atlıları ve ghulam askerler</li>
    <li>İdari sistem: Melikler (beyler) sistemi</li>
  </ul>
  
  <hr/>
  
  <h2>3. Haçlı Seferleri ve Anadolu (1096-1099)</h2>  
  <p>
    Avrupa'dan gelen Haçlı orduları, <strong>Birinci Haçlı Seferi</strong> (1096-1099) sırasında Anadolu'dan geçti. Türkler, İznik ve Konya çevresinde şiddetli direniş gösterdi.
  </p>
  
  <h3>Türk Direnişinin Nedenleri</h3>
  <ul>
    <li>Vatan müdafaası duygusu.</li>
    <li>Başarılı garnizon savunmaları.</li>
    <li>Çevik Türkmen atlı taktikleri.</li>
    <li>Kılıç Arslan I'ın liderliği.</li>
  </ul>
  
  <hr/>
  
  <h2>4. Değerlendirme Soruları</h2>  
  <ol>
    <li>Malazgirt Zaferi hangi yılda ve hangi hükümdar döneminde kazanılmıştır?</li>
    <li>Anadolu Selçuklu Devleti'nin kurucusu kimdir ve başkent neresi olmuştur?</li>
    <li>Malazgirt Zaferi'nin Anadolu tarihi açısından iki önemli sonucunu yazınız.</li>
    <li>Birinci Haçlı Seferi sırasında Türkler neden direniş göstermiştir?</li>
    <li>Alp Arslan'ın liderlik özelliklerinden bahsediniz.</li>
  </ol>
  
  <hr/>
  
  <h2>5. Cevap Anahtarı</h2>  
  <ol>
    <li>1071 yılında, Sultan Alp Arslan döneminde kazanılmıştır.</li>
    <li>Kutalmışoğlu Süleyman Şah, İznik.</li>
    <li>Anadolu'nun kapılarının Türklere açılması ve Türkmen göçünün başlaması.</li>
    <li>Yeni vatanlarını savunmak için vatan müdafaası duygusuyla.</li>
    <li>Cesaret, askeri deha, diplomasi becerisi, adalet anlayışı.</li>
  </ol>
</section>
]]>`;

  // 3. 20. Hafta İçeriği (Sadece İkinci Bölüm)
  const icerik20 = `<![CDATA[
<title>Anadolu'nun Türk Yurdu Olması - İkinci Bölüm: Miryokefalon ve Beylikler</title>

<section>
  <p><strong>İkinci Bölüm: 1176-1300 Dönemi</strong></p>
  <hr/>
  
  <h2>1. Miryokefalon Zaferi (1176)</h2>  
  <p>
    <strong>Kılıç Arslan II</strong>, Bizans İmparatoru <strong>Manuel Komnenos</strong>'u Denizli yakınlarındaki Miryokefalon'da ağır bir yenilgiye uğrattı. Bu zafer, <strong>Anadolu'nun Türk yurdu olduğunun dünyaya ilanıdır</strong>.
  </p>
  
  <h3>Zaferin Anlamı</h3>
  <ul>
    <li>Bizans'ın Anadolu'yu geri alma ümitleri tamamen son buldu.</li>
    <li>Anadolu'daki Türk hakimiyeti kesinleşti.</li>
    <li>Türk-İslam medeniyetinin Anadolu'da gelişmesinin önü açıldı.</li>
  </ul>
  
  <hr/>
  
  <h2>2. Anadolu Beylikleri Dönemi (1243-1300)</h2>  
  <p>
    <strong>Kösedağ Savaşı</strong> (1243) sonrası Moğol baskısıyla Anadolu Selçuklu Devleti zayıfladı. Yerine güçlü <strong>Anadolu Beylikleri</strong> ortaya çıktı.
  </p>
  
  <h3>Önemli Beylikler</h3>
  <table border="1" cellpadding="6" cellspacing="0">
    <tr>
      <th>Beylik</th>
      <th>Merkez</th>
      <th>Önemi</th>
    </tr>
    <tr>
      <td>Osmanlı Beyliği</td>
      <td>Söğüt/Bursa</td>
      <td>Osmanlı İmparatorluğu'nu kurdu</td>
    </tr>
    <tr>
      <td>Karamanoğulları</td>
      <td>Konya/Larende</td>
      <td>Güney Anadolu'da hakim güç</td>
    </tr>
    <tr>
      <td>Aydınoğulları</td>
      <td>Birgi/İzmir</td>
      <td>Ege ticaretini kontrol etti</td>
    </tr>
    <tr>
      <td>Germiyanoğulları</td>
      <td>Kütahya</td>
      <td>Batı Anadolu'da etkili</td>
    </tr>
  </table>
  
  <hr/>
  
  <h2>3. Askerî Mücadelelerin Etkileri</h2>  
  
  <h3>Siyasi Etkiler</h3>
  <ul>
    <li>Türk hakimiyeti kalıcı hale geldi.</li>
    <li>Bağımsız Türk devletleri kuruldu.</li>
  </ul>
  
  <h3>Demografik Etkiler</h3>
  <ul>
    <li>Milyonlarca Türkmen Anadolu'ya yerleşti.</li>
    <li>Yörükler ve Türkmenler yaylalara yayıldı.</li>
  </ul>
  
  <h3>Kültürel Etkiler</h3>
  <ul>
    <li>Türk dili ve edebiyatı gelişti.</li>
    <li>İslam medeniyeti Anadolu'ya yerleşti.</li>
    <li>Ahilik teşkilatı kuruldu.</li>
  </ul>
  
  <hr/>
  
  <h2>4. Kazanımlarımızı Tekrarlayalım</h2>  
  <ul>
    <li>✅ <strong>Türkleşme:</strong> Anadolu Türk yurdu oldu</li>
    <li>✅ <strong>İslamlaşma:</strong> İslamiyet yayıldı</li>
    <li>✅ <strong>Medeniyet:</strong> Türk-İslam kültürü gelişti</li>
  </ul>
  
  <hr/>
  
  <h2>5. Değerlendirme Soruları</h2>  
  <ol>
    <li>Miryokefalon Zaferi hangi hükümdar döneminde kazanılmıştır ve anlamı nedir?</li>
    <li>Anadolu Beylikleri neden ortaya çıkmıştır? İki önemli beylik yazınız.</li>
    <li>Askerî mücadelelerin Anadolu'nun Türkleşmesine iki etkisini belirtiniz.</li>
    <li>Kılıç Arslan II'nin liderlik özelliklerinden bahsediniz.</li>
  </ol>
  
  <hr/>
  
  <h2>6. Cevap Anahtarı</h2>  
  <ol>
    <li>Kılıç Arslan II döneminde; Anadolu'nun Türk yurdu olduğunun ilanıdır.</li>
    <li>Moğol baskısı sonrası Anadolu Selçuklu Devleti'nin zayıflaması; Osmanlı ve Karamanoğulları.</li>
    <li>Türkmen göçü ve yerleşimi; Türk-İslam medeniyetinin gelişmesi.</li>
    <li>Stratejik deha, sabır, diplomatik beceri, ordu disiplini.</li>
  </ol>
</section>
]]>`;

  // 4. 19. Haftayı ekle
  const { data: data19, error: error19 } = await supabase.from('topic_contents').insert([{
    topic_id: 244,
    title: "Anadolu'nun Türk Yurdu Olması - Birinci Bölüm: Malazgirt ve Sonrası (1071-1176)",
    content: icerik19
  }]).select();
  
  if (error19) {
    console.log('❌ 19. hafta hatası: ' + error19.message);
    return;
  }
  
  await supabase.from('topic_content_weeks').insert([
    { topic_content_id: data19[0].id, curriculum_week: 19 }
  ]);
  console.log('✅ 19. Hafta eklendi! ID: ' + data19[0].id);
  
  // 5. 20. Haftayı ekle
  const { data: data20, error: error20 } = await supabase.from('topic_contents').insert([{
    topic_id: 244,
    title: "Anadolu'nun Türk Yurdu Olması - İkinci Bölüm: Miryokefalon ve Beylikler (1176-1300)",
    content: icerik20
  }]).select();
  
  if (error20) {
    console.log('❌ 20. hafta hatası: ' + error20.message);
    return;
  }
  
  await supabase.from('topic_content_weeks').insert([
    { topic_content_id: data20[0].id, curriculum_week: 20 }
  ]);
  console.log('✅ 20. Hafta eklendi! ID: ' + data20[0].id);
  
  console.log('\n🎉 HER HAFTA İÇİN AYRI İÇERİK EKLENDİ!');
}

duzelt();
