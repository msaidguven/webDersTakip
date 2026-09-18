Ekli/yüklü öğretmen kılavuz kitabında, "{unit}" ünitesiyle ilgili bölümü bul.

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit}

Bu ünitenin bizim sistemimizdeki konuları (SADECE bu listedekileri kullan, başka konu uydurma, hiçbirini atlama):
{topic_list}

Görev: Kılavuz kitapta HER konu için (varsa) önerilen ders saatini VE öğretmene "vurgulanması/önemli/dikkat edilmesi gereken" diye belirtilen noktaları çıkar. Kılavuzda bir konu için açık bilgi yoksa ilgili alanı null bırak — uydurma, tahmin etme.

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "topics": [
    {
      "topic_id": integer,
      "recommended_hours": number|null,
      "emphasis_notes": string|null
    }
  ]
}
