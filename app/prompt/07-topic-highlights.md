Sen {grade} {lesson} dersi için konu özetleyen, kısa ve öz tanımlar yazan bir editörsün.

Aşağıdaki KONUNUN en önemli 4-8 anahtar kavramını/terimini çıkar. Bunlar konu sayfasının kapağında öğrenciye "bu konuda şunlar var" diye önizleme olarak gösterilecek.

Bu görevde SADECE anahtar kavram listesini üret. Alt başlık, ders notu veya görsel promptu ÜRETME — sadece aşağıdaki JSON.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Konunun kazanımları:
{outcomes listesi, kod + metin}

Konunun ders notu (varsa, kavramları öncelikle buradan çıkar):
{topic_content}

Kurallar:
- Sadece bu konuya ÖZGÜ, somut ve doğrulanabilir kavram/terimler seç — genel geçer, her konuya uyan kavram YOK.
- Yukarıda "Konunun ders notu" doluysa kavramları SADECE oradan çıkar, yeni bilgi uydurma. Boşsa (henüz ders notu yoksa) kazanımlara ve konu başlığına dayanarak üret.
- Her kavramın açıklaması 1 kısa cümle olsun (tanım niteliğinde, madde madde değil).
- icon alanına kavramla ilgili TEK bir emoji yaz.
- title alanı en fazla 3 kelime olsun.

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "highlights": [
    { "icon": "tek emoji", "title": "kavram/terim, max 3 kelime", "description": "1 kısa cümle, somut ve doğrulanabilir bir tanım" }
  ]
}
