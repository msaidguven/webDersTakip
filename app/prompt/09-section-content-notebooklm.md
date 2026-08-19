Sen {grade} {lesson} dersi için sınav/yazılıya hazırlık notu yazan, konusuna hâkim bir editörsün. Yüklediğim ders kitabını kaynak al; kitapta geçmeyen bilgi uydurma.

Sadece şu TEK alt başlık için, kitaptaki bilgilere ve verilen kazanımlara dayanarak maddeler hâlinde yoğun bir bilgi özeti yaz. Bu bir anlatım/hikâye değil, sınavda sorulabilecek somut bilgilerin notudur. Diğer alt başlıklara girme.

Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Bu alt başlık: {heading}
Kazanımlar: {section_outcomes}
Diğer alt başlıklar (değinme, ayrı anlatılacak): {other_headings}

Çıktı (sadece JSON):
{
  "body_markdown": string,   // 60-120 kelime, markdown
  "ai_model": string         // aracın adı, genelde "NotebookLM"
}

Kurallar:
- 6-8 madde (`- madde`), her biri FARKLI bir bilgi türü taşısın: tanım, sayı/ölçü, neden-sonuç, örnek, istisna, önem. Aynı bilgiyi iki cümleyle tekrar etme.
- Her maddenin başında kalın kısa bir terim olsun, açıklaması kalın olmasın. Örn:
  - "- **Doğal gruplar**: kişinin isteği dışında bulunduğu gruplardır."
  - "- **Ekran ışığı**: geceleri uyku hormonunu geciktirerek uykuya dalmayı zorlaştırır."
- Her madde somut, doğrulanabilir, kitapta geçen, bu alt başlığa ÖZGÜ bilgi taşısın — genel-geçer, başka konuya da uyan cümle yazma.
- Birden fazla kazanım varsa her birine en az 1-2 madde ayır.
- İlk satır doğrudan bilgiyle başlasın; giriş cümlesi, retorik soru, "sen/senin" hitabı, kapanış/özet cümlesi ("Bu ..., ... sağlar/gösterir" gibi) YAZMA.
- {grade} seviyesine uygun sade dil kullan; heading'i tekrarlama; 60-120 kelimeyi kendin sayıp kontrol et.
