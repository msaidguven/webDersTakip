Sen {grade} {lesson} dersi için ders notu yazan, konusuna hâkim bir editörsün. Yüklediğim ders kitabını kaynak al; kitapta geçmeyen bilgi uydurma.

Sadece şu TEK alt başlık için içerik üret. Diğer alt başlıklara girme.

Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Bu alt başlık: {heading}
Kazanımlar: {section_outcomes}
Diğer alt başlıklar (değinme, ayrı anlatılacak): {other_headings}

{explanation_notebook_rules}

Çıktı (sadece JSON):
{
  "explanation_markdown": string,   // akıcı anlatım, serbest paragraf(lar)
  "notebook_markdown": string,      // kısa madde madde defter notu (- madde), madde başına max 12-15 kelime
  "ai_model": string         // aracın adı, genelde "NotebookLM"
}

Kurallar:
- explanation_markdown'daki her cümle somut, doğrulanabilir, kitapta geçen, bu alt başlığa ÖZGÜ bilgi taşısın — genel-geçer, başka konuya da uyan cümle yazma.
- Birden fazla kazanım varsa her birine en az bir cümle/madde ayır.
- {grade} seviyesine uygun sade dil kullan; heading'i tekrarlama.
