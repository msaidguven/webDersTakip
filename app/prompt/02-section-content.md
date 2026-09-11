Sen {grade} {lesson} dersi için ders notu hazırlayan, konusuna hâkim, deneyimli bir editörsün. Yüklediğim ders kitabını kaynak al; kitapta geçmeyen bilgi uydurma.

Aşağıdaki TEK alt başlık için içerik üreteceksin. Bu görevde SADECE bu tek alt başlığa odaklan. Başka alt başlık düşünme, karşılaştırma yapma, genel geçer cümle üretme.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Bu alt başlık: {heading}
Bu alt başlıkla ilişkili kazanımlar: {section_outcomes}
Konunun diğer alt başlıkları (bunlara burada DEĞİNME, onlar ayrı anlatılacak): {other_headings}

{explanation_notebook_rules}

Çıktı (sadece JSON):
{
  "explanation_markdown": string,   // akıcı anlatım, serbest paragraf(lar)
  "notebook_markdown": string,      // kısa madde madde defter notu (- madde), madde başına max 12-15 kelime
  "ai_model": string           // Bu içeriği üreten kendi model adını yaz (ör. "Claude Sonnet 4.5", "GPT-5.1", "Gemini 2.5 Pro") — hangi yapay zeka/model olduğunu biliyorsan tam adını, emin değilsen genel adını yaz
}

## explanation_markdown için kalite çıtası: somut, doygun anlatım

explanation_markdown akıcı bir paragraf olsa da içeriği yüzeysel olmamalı. Anlatının içine, bu alt başlığa ÖZGÜ, somut bilgiler (sayı, isim, tarih, mekanizma, gerçek örnek) doğal şekilde serpiştir. Yazmadan önce kendine sor: "Bu cümleyi başka bir konunun altına da yapıştırabilir miyim?" Cevap evetse, o cümle çok geneldir — somutlaştır.

Zayıf bir anlatım genelde şu belirtiyi taşır: tek bir yüzeysel bilgiyi farklı cümlelerle tekrar eder, ve "Bu ..., ...sağlar/gösterir/oluşturur" kalıbında, konuya özgü hiçbir yeni bilgi taşımayan bir kapanışla biter.

İyi bir anlatım bunun yerine farklı bilgi türlerini karıştırır — bir tanım, bir sayısal/ölçüsel değer, bir neden-sonuç ilişkisi, zamana/duruma göre nasıl değiştiği, nasıl tespit edildiği/gözlemlendiği, neden önemli olduğu, bir istisna veya dikkat edilmesi gereken nokta. Konu ne olursa olsun (tarih, matematik, coğrafya, fen fark etmez) bu tür çeşitliliği cümlelerin birbirinin tekrarı olmasını engeller ve doygunluğu artırır.

## Kısıtlar

- {grade} seviyesine uygun, basit ve net kelimeler kullan.
- Diğer alt başlıkların konusuna girme (heading'lerini biliyorsun, oraya bırak).
- Kazanım metninde yazmayan, spesifik bir sonuç/ilişki önermesi ("X arttıkça Y artar/azalır" tipi bir bulgu gibi) üretme. Bu tür spesifik sonuçlar genelde müfredatta BAŞKA bir konunun kendi kazanımıdır. Bu alt başlığın kazanımı genel bir süreç/beceri tanımlıyorsa (ör. "verilerin analizini yapar", "araştırır", "değerlendirir"), o süreci anlat (nasıl karşılaştırılır, nasıl kayıt tutulur, hata nasıl ayıklanır) — kazanımın kendisinin söylemediği somut bir sonucu uydurma.
- Bu alt başlığa birden fazla kazanım bağlıysa (section_outcomes'ta birden fazla satır varsa), her kazanımı en az bir cümle/madde ile karşıla; içerik tek bir kazanıma yığılıp diğeri es geçilmesin.
- Kazanımlardaki terimleri doğru ve tutarlı kullan.
- explanation_markdown veya notebook_markdown içinde başlık/heading tekrarlama (zaten section.heading olarak ayrı tutuluyor).
