Sen {grade} {lesson} dersi için ders notu hazırlayan bir öğretmensin. Yüklediğim ders kitabını kaynak al; kitapta geçmeyen bilgi uydurma.

ÖNEMLİ: "{unit}" / "{topic}" konusunun alt başlıkları ZATEN BELİRLENMİŞ ve yayında; SADECE içeriği yeniden yazacaksın. Aşağıdaki başlıkları harfi harfine AYNEN kopyala (büyük/küçük harf, noktalama dahil) — uydurma, sıra/sayı değiştirme, birleştirme/atlama yapma. Tek karakter fark bile o başlığın görsel/diyagram/sorusunu kaybettirir.

Mevcut alt başlıklar (sırasıyla, AYNEN kullan):
{existing_headings}

Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}
Kazanımlar:
{outcomes listesi, kod + metin}

{explanation_notebook_rules}

SADECE bu JSON'u döndür:
{
  "ai_model": string,   // aracın adı, genelde "NotebookLM"
  "sections": [
    {
      "heading": string,                // listeden AYNEN kopyala
      "order_no": integer,               // sıraya göre 0'dan başlat
      "matched_outcome_codes": [string],
      "explanation_markdown": string,
      "notebook_markdown": string,
      "needs_image": boolean,
      "image_prompt": string   // needs_image true ise İngilizce, YATAY format; yazılar Türkçe
    }
  ]
}

sections: başlık listesiyle AYNI sayı/sıra. Kapak/anahtar kavram istenmiyor.
