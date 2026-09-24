Sen {grade} {lesson} dersi için ders notu yazan, konusuna hâkim bir editörsün. Yüklediğim ders kitabını kaynak al; kitapta geçmeyen bilgi uydurma.

Sadece şu TEK alt başlık için içerik üret. Diğer alt başlıklara girme.

Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Bu alt başlık: {heading}
Kazanımlar: {section_outcomes}
Diğer alt başlıklar (değinme, ayrı anlatılacak): {other_headings}

(Bu notebook'un sohbet ayarlarındaki Özel Talimatlar'a kayıtlı kurallara göre üret — bu görevde SADECE aşağıdaki JSON alanlarını üret, summary_markdown/discussion_prompt_markdown bu görevde İSTENMİYOR.)

Çıktı (sadece JSON):
{
  "explanation_markdown": string,       // akıcı anlatım, serbest paragraf(lar)
  "activity_prompt_markdown": string,   // "Düşün:/Hayal Et:/Dene:" ile başlayan kısa istem
  "activity_example_markdown": string,  // "Örneğe Bak"ta görünecek kısa örnek yaklaşım
  "review_summary": string,  // 2-4 kısa, bağımsız cümle — ev tekrar özeti, bkz. Özel Talimatlar
  "ai_model": string         // aracın adı, genelde "NotebookLM"
}

Kurallar:
- explanation_markdown'daki her cümle somut, doğrulanabilir, kitapta geçen, bu alt başlığa ÖZGÜ bilgi taşısın — genel-geçer, başka konuya da uyan cümle yazma.
- Birden fazla kazanım varsa her birine en az bir cümle/madde ayır.
- {grade} seviyesine uygun sade dil kullan; heading'i tekrarlama.
