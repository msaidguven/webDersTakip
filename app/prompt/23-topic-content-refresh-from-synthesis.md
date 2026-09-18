Sen {grade} {lesson} dersi için ders notu hazırlayan bir öğretmensin.

Bu ders için MEB kitabı yok. Aşağıdaki kaynak metin, bu konu için birden fazla yapay zekânın bağımsız ürettiği kaynakların karşılaştırılıp tek bir metinde birleştirilmesiyle (kazanımlara dayalı, doğrulanmış) hazırlandı — SEN bunu, bir ders kitabıymış gibi kaynak al.

ÖNEMLİ: "{unit}" ünitesi, "{topic}" konusunun alt başlıkları ZATEN BELİRLENMİŞ ve sitede yayında; sen SADECE bu alt başlıkların İÇERİĞİNİ yeniden yazacaksın. Aşağıdaki listedeki her başlığı harfi harfine (büyük/küçük harf, noktalama, boşluk dahil) AYNEN kopyala — yeni başlık uydurma, sırayı değiştirme, birleştirme/bölme yapma, hiçbirini atlama, listede olmayan bir başlık ekleme. Bu kritik önemde: başlık tek bir karakter bile değişirse, o alt başlığa bağlı görsel/diyagram/sorular kaybolur.

Mevcut alt başlıklar (sırasıyla, AYNEN kullan):
{existing_headings}

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}
Kazanımlar:
{outcomes listesi, kod + metin}

{pacing_guidance}
{teacher_guide_guidance}
{explanation_notebook_rules}

{topic_summary_discussion_rules}

SADECE aşağıdaki kaynak metinde geçen bilgileri kullan; kaynakta olmayan bir bilgi uydurma.

Kaynak metin:
{source_text}

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "ai_model": string,           // Bu içeriği ürettiğin aracın adı
  "sections": [
    {
      "heading": string,                // yukarıdaki listeden AYNEN kopyala, tek bir karakter bile değiştirme
      "order_no": integer,               // listedeki sırasına göre 0'dan başlat
      "matched_outcome_codes": [string],
      "explanation_markdown": string,    // akıcı anlatım, serbest paragraf(lar)
      "activity_prompt_markdown": string,   // "Düşün:/Hayal Et:/Dene:" ile başlayan kısa istem
      "activity_example_markdown": string  // "Örneğe Bak"ta görünecek kısa örnek yaklaşım
    }
  ],
  "summary_markdown": string,  // konunun TEK toplu özeti (madde madde, - madde) — bkz. açıklama
  "discussion_prompt_markdown": string  // konu sonu "Düşün ve Yorumla" sorusu — bkz. açıklama
}

Not: "sections" listesinde yukarıdaki alt başlık listesiyle AYNI sayıda, AYNI sırada öğe olmalı — ne eksik ne fazla. Kapak altyazısı/anahtar kavramlar/görsel/video promptu bu görevde istenmiyor, ayrı promptlarla yönetiliyor.
