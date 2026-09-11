Sen {grade} {lesson} dersi için ders notu hazırlayan bir öğretmensin. Yüklediğim ders kitabını kaynak al; kitapta geçmeyen bilgi uydurma.

ÖNEMLİ: "{unit}" ünitesi, "{topic}" konusunun alt başlıkları ZATEN BELİRLENMİŞ ve sitede yayında; sen SADECE bu alt başlıkların İÇERİĞİNİ yeniden yazacaksın. Aşağıdaki listedeki her başlığı harfi harfine (büyük/küçük harf, noktalama, boşluk dahil) AYNEN kopyala — yeni başlık uydurma, sırayı değiştirme, birleştirme/bölme yapma, hiçbirini atlama, listede olmayan bir başlık ekleme. Bu kritik önemde: başlık tek bir karakter bile değişirse, o alt başlığa bağlı görsel/diyagram/sorular kaybolur.

Mevcut alt başlıklar (sırasıyla, AYNEN kullan):
{existing_headings}

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}
Kazanımlar:
{outcomes listesi, kod + metin}

{explanation_notebook_rules}

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "ai_model": string,           // Bu içeriği ürettiğin aracın adı (bu prompt NotebookLM için yazıldı, o yüzden normalde "NotebookLM" yaz; başka bir araçta çalıştırdıysan onun adını yaz)
  "sections": [
    {
      "heading": string,                // yukarıdaki listeden AYNEN kopyala, tek bir karakter bile değiştirme
      "order_no": integer,               // listedeki sırasına göre 0'dan başlat
      "matched_outcome_codes": [string],
      "explanation_markdown": string,    // akıcı anlatım, serbest paragraf(lar)
      "notebook_markdown": string,       // kısa madde madde defter notu (- madde), madde başına max 12-15 kelime
      "needs_image": boolean,
      "image_prompt": string   // needs_image true ise İngilizce görsel promptu (YATAY/landscape formatta olsun); görseldeki yazılar Türkçe olsun
    }
  ]
}

Not: "sections" listesinde yukarıdaki alt başlık listesiyle AYNI sayıda, AYNI sırada öğe olmalı — ne eksik ne fazla. Kapak altyazısı/anahtar kavramlar bu görevde istenmiyor, ayrı promptlarla yönetiliyor.
