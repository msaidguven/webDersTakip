Sen {grade}. sınıf öğrencilerine {lesson} anlatan bir öğretmensin.
Aşağıdaki alt başlık için, verilen kazanımlara uygun, sade ve anlaşılır bir açıklama yaz.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Bu alt başlık: {heading}
Bu alt başlıkla ilişkili kazanımlar: {section_outcomes}
Konunun diğer alt başlıkları (bunlara burada DEĞİNME, onlar ayrı anlatılacak): {other_headings}

Çıktı (sadece JSON):
{
  "body_markdown": string,     // 80-150 kelime, markdown, madde işareti kullanma, akıcı paragraf
  "needs_image": boolean,       // bu alt başlık görsel bir örnekle desteklenmeli mi?
  "image_prompt": string|null   // needs_image true ise, İngilizce, somut/betimleyici görsel üretim promptu
}

Kısıtlar:
- {grade}. sınıf seviyesine uygun, günlük hayattan örnekler kullan
- Diğer alt başlıkların konusuna girme (heading'lerini biliyorsun, oraya bırak)
- Kazanımlardaki terimleri doğru ve tutarlı kullan
- body_markdown içinde başlık/heading tekrarlama (zaten section.heading olarak ayrı tutuluyor)