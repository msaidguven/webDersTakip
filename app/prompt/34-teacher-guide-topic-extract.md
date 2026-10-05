Aşağıda {grade} {lesson} dersinin MEB ÖĞRETMEN KILAVUZ KİTABINDAN, "{topic}" konusuna ait ders planı bölümünün ham metni var (kılavuz sayfaları: {pages}). Bu bölüm başka konularla ortak bir ders planıysa, SADECE "{topic}" konusuna ve aşağıdaki kazanımlara ait kısmı kullan.

Konunun resmî kazanımları:
{outcomes}

Amaç: Bu konu için ders kitabı yok. Başka AI'lar, senin çıkardığın bilgilerle konunun ÖĞRENCİYE yönelik kaynak metnini yazacak. Bu yüzden kılavuzdan, öğrencinin öğrenmesi gereken BİLGİYİ ve öğretmenin konuyu hangi kapsamda/derinlikte, hangi örneklerle işlediğini çıkar.

ALMA: sınıf yönetimi ve lojistik (grup kurma, kâğıt/kalem dağıtma, süre verme, karekod okutma, form doldurma, "tahtaya yazınız" gibi talimatlar), etkinliklerin adım adım uygulanışı, puanlama anahtarları. Bunlar öğrenci metnine girmez.

AL: kılavuzun öğrenciye kazandırmayı hedeflediği kavramlar, tanımlar, sınıflandırmalar, olgular, karşılaştırmalar, işlem adımları; kullandığı somut örnekler, araçlar, programlar, senaryolar; vurguladığı noktalar ve sınırlar.

Kurallar:
- Yalnız kılavuz metninde (ve aşağıdaki sözlükte) gerçekten yazanı al. Kılavuzda olmayan bilgi ekleme, tahmin etme, kendi bilginle tamamlama.
- Bir alan için kılavuzda bilgi yoksa null döndür.
- Kılavuzun kendi terimlerini ve ifadelerini koru. Sözlükte tanımı olan bir terim için tanımı sözlükten BİREBİR kopyala.
- Liste alanlarında her maddeyi kısa, kendi başına anlaşılır tek bir cümle olarak yaz.

Kılavuz sözlüğü (yalnız bu konuda geçen terimler için kullan):
{glossary}

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "content_points": ["öğrencinin öğrenmesi gereken bilgi/kavram/olgu maddeleri, kılavuzun işleyiş sırasıyla"],
  "key_terms": [{ "term": "terim", "definition": "kılavuzdaki veya sözlükteki tanımı" }],
  "examples": ["kılavuzun kullandığı somut örnek, araç, program veya senaryo"],
  "scope_notes": "konunun bu sınıf düzeyinde hangi kapsam ve derinlikte işlendiği, nereye kadar gidildiği (kılavuzdan çıkarılabildiği kadarıyla) | null",
  "emphasis_notes": "kılavuzun özellikle vurguladığı, önemli dediği noktalar | null",
  "misconceptions": ["kılavuzun dikkat çektiği yaygın hata, karışıklık veya dikkat edilecek nokta"],
  "prerequisites": "kılavuzun ön bilgi olarak hatırlattığı/dayandığı konular | null",
  "assessment_notes": "öğrenciden konu sonunda ne yapabilmesinin beklendiği (ara değerlendirme ve ölçme bölümlerinden) | null"
}

Kılavuz metni:
{source_text}
