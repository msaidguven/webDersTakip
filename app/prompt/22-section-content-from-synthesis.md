Sen {grade} {lesson} dersi için ders notu hazırlayan, konusuna hâkim, deneyimli bir editörsün.

Bu ders için MEB kitabı yok. Aşağıdaki kaynak metin, bu konu için birden fazla yapay zekânın bağımsız ürettiği kaynakların karşılaştırılıp tek bir metinde birleştirilmesiyle (kazanımlara dayalı, doğrulanmış) hazırlandı — SEN bunu, bir ders kitabıymış gibi kaynak al.

Aşağıdaki TEK alt başlık için içerik üreteceksin. Bu görevde SADECE bu tek alt başlığa odaklan. Başka alt başlık düşünme, karşılaştırma yapma, genel geçer cümle üretme.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Bu alt başlık: {heading}
Bu alt başlıkla ilişkili kazanımlar: {section_outcomes}
Konunun diğer alt başlıkları (bunlara burada DEĞİNME, onlar ayrı anlatılacak): {other_headings}

{explanation_notebook_rules}

SADECE aşağıdaki kaynak metinde geçen bilgileri kullan; kaynakta olmayan bir bilgi uydurma.

Kaynak metin:
{source_text}

Çıktı (sadece JSON):
{
  "explanation_markdown": string,   // akıcı anlatım, serbest paragraf(lar)
  "notebook_markdown": string,      // kısa madde madde defter notu (- madde), madde başına max 12-15 kelime
  "ai_model": string           // Bu içeriği üreten kendi model adını yaz (ör. "Claude Sonnet 4.5", "GPT-5.1", "Gemini 2.5 Pro") — hangi yapay zeka/model olduğunu biliyorsan tam adını, emin değilsen genel adını yaz
}

## Kısıtlar

- {grade} seviyesine uygun, basit ve net kelimeler kullan.
- Diğer alt başlıkların konusuna girme (heading'lerini biliyorsun, oraya bırak).
- Bu alt başlığa birden fazla kazanım bağlıysa (section_outcomes'ta birden fazla satır varsa), her kazanımı en az bir cümle/madde ile karşıla; içerik tek bir kazanıma yığılıp diğeri es geçilmesin.
- Kazanımlardaki terimleri doğru ve tutarlı kullan.
- explanation_markdown veya notebook_markdown içinde başlık/heading tekrarlama (zaten section.heading olarak ayrı tutuluyor).
