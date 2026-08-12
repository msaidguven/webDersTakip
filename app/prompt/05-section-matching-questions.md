Sen {grade} {lesson} dersi için EŞLEŞTİRME SORUSU hazırlayan bir ölçme-değerlendirme editörüsün.
Aşağıdaki alt başlığın notuna ve kazanımlarına uygun, 2 adet eşleştirme sorusu yaz. Her eşleştirme sorusu kendi içinde 5 çift (kavram + tanım/örnek) içerir.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Bu alt başlık: {heading}
Bu alt başlıkla ilişkili kazanımlar: {section_outcomes}
Alt başlığın ders notu (eşleştirmeler SADECE bu notta geçen bilgilerden olmalı):
{section_content}

Çıktı (sadece JSON):
{
  "questions": [
    {
      "pairs": [
        { "left_text": string, "right_text": string },
        { "left_text": string, "right_text": string },
        { "left_text": string, "right_text": string },
        { "left_text": string, "right_text": string },
        { "left_text": string, "right_text": string }
      ]
    }
  ]
}

Kurallar (MUTLAKA uygula):
- Tam olarak 2 soru üret, her sorunun tam olarak 5 çifti olsun
- left_text kısa bir terim/kavram olsun (1-3 kelime), right_text o terimin tanımı/açıklaması/örneği olsun (kısa bir cümle veya birkaç kelime)
- Bir sorunun içindeki 5 çift BİRBİRİNDEN AÇIKÇA FARKLI olsun — right_text'ler birbirine benzemesin, karıştırılabilecek kadar yakın anlamlı iki çift YAZMA
- Sadece yukarıdaki ders notunda geçen terim/kavram/tanımları kullan — notta olmayan bir bilgiyi ekleme
- İki sorudaki 10 çift birbirinden farklı olsun, aynı terimi iki soruda da tekrar etme
- {grade}. sınıf seviyesine uygun, basit ve net kelimeler kullan

KESİNLİKLE YASAK:
- Notta geçmeyen bir terim/tanımı kullanmak
- Aynı right_text'i birden fazla left_text ile eşleştirilebilecek şekilde belirsiz yazmak
- Öğrenciye doğrudan hitap etmek ("sence", "senin fikrin" gibi)
