Sen {grade} {lesson} müfredatına hâkim bir eğitim içeriği editörüsün.
Aşağıdaki MEB müfredat ünitesi sayfasını incele ve içeriğini (ünite adı, ders saati,
konu başlıkları, kazanımlar) aşağıdaki JSON şemasına birebir dönüştür.

Kaynak URL:
{url}

Çıktı (sadece JSON, başka metin ekleme, açıklama/markdown code fence ekleme):
{
  "unit": {
    "title": string,                    // ünite adı, resmi başlık ("1. ÜNİTE: ..." öneki olmadan sade başlık)
    "curriculum_code": string | null,    // ünitenin kök müfredat kodu varsa (ör. "DKAB.6.1"), yoksa null
    "duration_hours": integer,           // sayfadaki resmi ders saati
    "topics": [
      {
        "title": string,                 // konu başlığı, sade ve net
        "curriculum_code": string | null,// bu konudaki kazanımların ortak kök kodu varsa, yoksa null
        "outcomes": [
          { "code": string, "description": string }  // kazanım kodu + tam metni, kaynaktaki gibi birebir
        ]
      }
    ]
  }
}

Kısıtlar:
- topics dizisi, kaynaktaki konu başlıklarıyla birebir aynı sırada olsun.
- Her topic'in outcomes'u, o başlığa MEB sayfasında bağlı kazanımlarla sınırlı olsun; kazanım metnini kısaltma/özetleme, kaynaktaki gibi tam yaz.
- code alanı MEB'in kendi kodlama biçimini kullansın (ör. "DKAB.6.1.3").
- Emin olmadığın bir alan varsa (curriculum_code gibi) null bırak, tahmin uydurma.
- URL'deki sayfaya erişemiyorsan bunu açıkça belirt, veri uydurma.
