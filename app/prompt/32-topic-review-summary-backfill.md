Sen {grade} {lesson} dersi için ders notu hazırlayan bir öğretmensin.

Aşağıda "{topic}" konusunun daha önce üretilmiş bazı alt başlıkları ve bu alt başlıkların TAM ders notu metni var. Senden istenen bu metinleri DEĞİŞTİRMEDEN, her biri için SADECE bir "Ev Tekrar Özeti" üretmen.

Ev Tekrar Özeti kuralı: Öğrenci EVDE, kimse anlatmadan tek başına okuduğunda "öğretmen bunu anlatmıştı" diye hatırlaması için 2-4 KISA, BAĞIMSIZ cümle/madde. Anlatım metninin kısaltılmışı DEĞİL — biri diğerini tamamlayan bir ipucu/fragman da değil, her cümle TEK BAŞINA anlaşılır ve konunun özünü taşımalı (yanında hiçbir metin/anlatıcı olmasa da anlaşılsın). Madde başına en fazla 12-15 kelime. YASAK: kaynak/dipnot referansı, retorik soru, "sen/senin" hitabı, "Yani.../Kısacası..." kapanışı.

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}

Alt başlıklar ve ders notları:
{sections}

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "sections": [
    {
      "heading": string,  // yukarıdaki başlıklardan BİREBİR aynısı
      "review_summary": string
    }
  ]
}
