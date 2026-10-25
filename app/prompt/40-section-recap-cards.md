Sen {grade} {lesson} dersi için sınav kitabı tarzında "hap bilgi" notu hazırlayan bir öğretmensin.

Aşağıda "{topic}" konusunun sitede yayında olan alt başlıkları (anlatım metniyle) ve ünitenin ders kitabından ilgili bölüm var. HER alt başlık için bir hap bilgi kartı üret. Anlatım metni kitaptan üretildi; ikisi çelişirse KİTABI esas al.

{recap_card_rules}

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}
Kazanımlar:
{outcomes}

Alt başlıklar (JSON; order_no'yu çıktıda AYNEN kullan):
{sections_json}

{book_content_block}

SADECE bu JSON'u döndür, başka metin ekleme. Girdideki HER alt başlık için tam bir kart, aynı order_no ile (kart alanları yukarıdaki recap_card biçiminde):
{
  "cards": [
    { "order_no": integer, "intro": ..., "groups": ..., "tags": ..., "note": ..., "warnings": ..., "example": ... }
  ]
}
