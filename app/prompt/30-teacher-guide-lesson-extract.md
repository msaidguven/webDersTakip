Ekli/yüklü öğretmen kılavuz kitabında, aşağıdaki konuların HER BİRİ için bilgi çıkar.

Bağlam: Sınıf {grade} | Ders {lesson}

Konular (SADECE bu listedekileri kullan, başka konu uydurma, hiçbirini atlama):
{unit_topic_list}

Amaç: Bu dersin ders kitabı yok. Başka AI'lar, senin çıkardığın bilgilerle her konunun ÖĞRENCİYE yönelik kaynak metnini yazacak. Kılavuzun ilgili konu bölümünü (Ders Süreci, Dikkat Çekme, etkinlik açıklamaları dahil) baştan sona oku ve içindeki BİLGİYİ eksiksiz çıkar — özetleme, kısaltma.

Alanlar:
- content_points: Öğrencinin öğrenmesi gereken bilgiler; her madde bilgi cümlesi olsun ("Bilişim teknolojileri süreçleri hızlandırır ve maliyetleri azaltır."), etkinlik/kazanım cümlesi DEĞİL ("... gruplandırma", "... belirler" YAZMA). Kılavuzda geçen tüm kavram, sınıflandırma, özellik, karşılaştırma ve işlem adımlarını al.
- key_terms: Konu bölümünde geçen her terim; kılavuzun SÖZLÜK kısmında tanımı varsa BİREBİR kopyala, yoksa kılavuz metnindeki tanımı al.
- examples: Kılavuzun kullandığı somut örnekler, cihazlar, programlar, senaryolar.
- scope_notes: Konunun bu sınıfta hangi kapsam ve derinlikte işlendiği, nereye kadar gidildiği.
- emphasis_notes: Kılavuzun KONU İÇERİĞİ olarak vurguladığı noktalar (sınıf davranışı, saygı, söz sırası gibi notlar DEĞİL).
- misconceptions: Kılavuzun dikkat çektiği kavram karışıklıkları veya hatalar.
- prerequisites: Konunun dayandığı ön bilgi.
- assessment_notes: Konu sonunda öğrencinin neyi bilip yapabilmesi gerektiği (etkinlik adı, form, puanlama anahtarı YAZMA).

ALMA: grup kurma, materyal hazırlama/dağıtma, süre verme, karekod, form ve puanlama anahtarı, sınıf yönetimi.
Kılavuzda olmayan bilgiyi ekleme; bilgi yoksa null.

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "topics": [
    {
      "topic_id": integer,
      "recommended_hours": number|null,
      "content_points": [string],
      "key_terms": [{ "term": string, "definition": string }],
      "examples": [string],
      "scope_notes": string|null,
      "emphasis_notes": string|null,
      "misconceptions": [string],
      "prerequisites": string|null,
      "assessment_notes": string|null
    }
  ]
}
