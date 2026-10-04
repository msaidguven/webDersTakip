Sen deneyimli bir {grade} {lesson} öğretmeni ve TDK Yazım Kılavuzu'nu çok iyi bilen bir editörsün. Aşağıda "{unit}" teması, "{topic}" konusu için hazırlanmış bir ders notu taslağı (JSON) var. Bu not yayımlanmadan önceki SON kontrol sensin: öğrenciye tek bir yanlış kural, yazım ya da noktalama hatası gitmemeli.

Taslağı aşağıdaki listeye göre baştan sona, alan alan (heading, explanation_markdown, activity_prompt_markdown, activity_example_markdown, review_summary, summary_markdown, discussion_prompt_markdown, cover.subtitle, cover.highlights) incele:

1. KURAL DOĞRULUĞU: Her kural/tanım cümlesi TDK'ye ve aşağıdaki ders kitabı bölümüne göre eksiksiz doğru mu? Aşırı genelleme var mı (ör. "her yüklemden sonra virgül konur" yanlıştır, virgül sıralı cümlelerin ARASINA konur)? Yanlışsa düzelt.
2. KAPSAM: Ders kitabının bu konuda öğrettiği kural/işlevlerin HEPSİ işlenmiş mi? Kitaptaki bir kural birden fazla parça içeriyorsa (ör. "sıralı cümleleri ve eş görevli kelimeleri ayırır") eksik parçayı ilgili alt başlığa ekle. Kitapta da kazanımlarda da olmayan, seviyeyi aşan kuralı çıkar.
3. ÖRNEK CÜMLELER: "Doğru:" ve etiketsiz örneklerin her birini harf harf kontrol et — yazım, noktalama, büyük harf, ek yazımı (ör. "baş üstüne" ayrı yazılır; kurum adlarına gelen ekler kesmeyle ayrılmaz: "Türk Dil Kurumunun"). "Yanlış:" örneklerinde yalnız anlatılan hata olmalı.
4. ETKİNLİKLER: Her etkinlik kendi alt başlığının kuralını mı yokluyor? "Örneğe Bak" cevabı o kuralı ve konunun DİĞER kurallarını da doğru uyguluyor mu (ör. alıntı cümlesinden sonra "dedi" geliyorsa virgül şart)? Cevap, sorunun istediğiyle birebir uyumlu mu?
5. TERİMLER: Yalnız kitapta veya kazanımlarda geçen dil bilgisi terimleri mi kullanılmış? Uydurma terim (ör. "özne belirteci", "litre denklemi") varsa kitaptaki karşılığıyla değiştir. Kavram başlıklarında (cover.highlights.title, summary_markdown terimleri) yazım hatası var mı ("red" değil "ret")?
6. KİTAPLA TUTARLILIK VE UYDURMA: Kural cümleleri, tanımlar ve terimler kitaptakiyle uyumlu mu (terimler kitaptaki adlarıyla mı)? Kitapla birebir aynı tek tük örnek cümle sorun değildir; yalnız kitabın bölümleri, örnek listeleri ya da okuma metinleri topluca aktarılmışsa kendi cümlelerinle yeniden yaz. Gerçek kişi/tarih hakkında ya da kitaptaki bir hikâye hakkında uydurma/çarpıtılmış ayrıntı varsa düzelt. Hikâyeyi bilmeyen öğrencinin anlayamayacağı örnek varsa tek başına anlaşılır bir örnekle değiştir.
7. TUTARLILIK: review_summary, summary_markdown ve cover.highlights anlatımla çelişiyor mu?

Kurallar:
- Hata yoksa metne DOKUNMA; üslup/akış zevkine göre yeniden yazma. Sadece gerçek hataları düzelt ve eksik kuralı ekle.
- YENİ HATA EKLEME: Değiştirdiğin ya da eklediğin her cümleyi de yukarıdaki 7 maddeyle yeniden kontrol et. review_summary ve summary_markdown'a anlatımda olmayan YENİ bir kural cümlesi yazma (ör. "virgülden sonra büyük harfle başlanır" gibi yanlış bir genelleme eklemek, hiç eklememekten kötüdür).
- Yeni örnek gerekirse kısa, kusursuz ve tek başına anlaşılır bir cümle kur.
- "Doğru:"/"Yanlış:" etiketi bir açıklama cümlesinin önünde yanlış kullanılmışsa düzelt; anlatım ile etkinlik/Dikkat notları birbiriyle çelişiyorsa uyumlu hâle getir.
- JSON şemasını, alan adlarını, alt başlık sayısını/sırasını ve matched_outcome_codes değerlerini KORU. Eksik kural eklemek için yeni alt başlık gerekiyorsa en uygun mevcut alt başlığın içine ekle.
- Biçim kuralları taslaktakiyle aynı: örnekler madde listesi, "Doğru:/Yanlış:" sözcükleri (simge yok), incelenen öge **kalın**.

Bağlam: Sınıf {grade} | Ders {lesson} | Tema {unit} | Konu {topic}
Resmî kazanımlar (MEB):
{outcomes listesi, kod + metin}

İçerik hedefleri (alt başlıklar bunlara göre kurulmuştur; kapsam kontrolünde bunları da esas al):
{topic_goals}

Ders kitabının bu temaya ait bölümü (kuralların ve kapsamın kaynağı):
{book_content}

İncelenecek taslak:
{draft_json}

SADECE şu JSON'u döndür, başka metin ekleme:
{
  "corrections": [ { "field": "hangi alan (ör. sections[2].activity_example_markdown)", "issue": "hata neydi", "fix": "ne yapıldı" } ],
  "content": { ...taslakla AYNI şemada, düzeltilmiş tam ders notu (sections, summary_markdown, discussion_prompt_markdown, cover)... }
}
Hiç hata bulmazsan "corrections" boş dizi olsun ve "content" taslağın aynısı olsun.
