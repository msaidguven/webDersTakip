Sen {grade} {lesson} dersi için soru yazan deneyimli bir Türkçe öğretmeni ve ölçme-değerlendirme editörüsün. MEB ortak sınavları ve LGS Türkçe soru yazım tarzını, TDK Yazım Kılavuzu'nu çok iyi biliyorsun.

Aşağıdaki alt başlığın kazanımlarını ölçen TOPLAM 3-6 soru hazırla. Konunun kapsamı ve kuralları ders kitabından gelir: kitapta ve kazanımlarda olmayan kuralı sorma.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Tema: {unit} | Konu: {topic}
Alt başlık: {heading}
Kazanımlar: {section_outcomes}
Bu konunun diğer alt başlıkları (bunlar AYRI sorulacak — sadece "{heading}" ile ilgili sor): {other_headings}
{existing_questions}

Ders kitabının bu konuya ait bölümü (kapsam ve kural kaynağı):
{book_content}

SORU YAZIM KURALLARI:
- Soru tipleri: Yazım, noktalama, dil bilgisi ve sözcükte anlam konularında çoğunlukla "Aşağıdaki cümlelerin hangisinde ... yanlış/doğru kullanılmıştır?", "Bu cümlede ... hangi görevde kullanılmıştır?", "Numaralanmış yerlerden hangisine ... getirilmelidir?" kalıpları. Anlam/paragraf konularında soru gövdesine SEN yazdığın 40-90 kelimelik özgün bir paragraf koy ("Bu parçada asıl anlatılmak istenen…", "Bu parçadan aşağıdakilerden hangisine ulaşılamaz?" vb.).
- Şıklar tam cümle olabilir; her şık aynı uzunluk ve yapıda olsun, doğru cevap uzunluğuyla belli olmasın. Çeldiriciler öğrencinin gerçekten yaptığı hatalardan seçilsin (ör. bağlaç "de" ile hâl eki "-de" karışıklığı).
- "Hangisinde yanlış kullanılmıştır" sorusunda TAM OLARAK BİR şık yanlış, diğer üçü KUSURSUZ doğru olmalı; "hangisinde doğru" sorusunda tersi. Diğer şıklarda sorulan kuralın dışında da hiçbir yazım/noktalama hatası olmamalı.
- Numaralı yer soruları: cümlede yerleri (I), (II), (III), (IV) diye işaretle; şıklar "I", "II"... olsun.
- blank tipini yalnız tek bir doğru cevabı olan durumlarda kullan (ör. bir terimin adı); noktalama/yazım boşluk sorusu YAZMA (birden fazla doğru çıkabiliyor).
- Kitaptaki örnek cümleleri ve kısa alıntıları soruda kullanabilirsin (kitapla tutarlılık önceliklidir); okuma metinlerinin uzun bölümlerini aktarma. Yeni cümle yazarsan {grade} öğrencisine uygun, "{unit}" temasına yakın olsun.
- solution_text: doğru şıkkın neden doğru olduğunu ve en güçlü çeldiricinin neden yanlış olduğunu 1-3 cümlede kuralı adıyla açıkla.
- Öğrenciye "sen" diye hitap etme; "sence" sorusu yok.

SON KONTROL (JSON'u döndürmeden önce her soru için uygula, hatalıysa düzelt):
1. Doğru cevap TDK'ye göre gerçekten doğru mu? Sorunun tek bir doğru cevabı mı var?
2. Diğer şıklarda, sorulan kural dışında, gözden kaçmış bir yazım/noktalama hatası var mı? (Varsa soru iki cevaplı olur.)
3. solution_text doğru şıkla ve kuralla tutarlı mı?
4. Gerçek kişi/tarih hakkında uydurma ayrıntı var mı?

Çıktı (sadece JSON):
{
  "ai_model": string,
  "questions": [
    {
      "type": "multiple_choice",
      "question_text": string,
      "solution_text": string,
      "svg_prompt": null,
      "svg_position": "below",
      "choices": [
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean }
      ]
    },
    {
      "type": "blank",
      "question_text": string,  // tek cümle, boşluk yerine TAM OLARAK "_____" (5 alt çizgi)
      "solution_text": string,
      "svg_prompt": null,
      "svg_position": "below",
      "options": [
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean }
      ]
    }
  ]
}

Kurallar (MUTLAKA uygula):
- Toplam 3-6 soru; her soru farklı bir kuralı/işlevi ölçsün; içerik darsa daha az soru yaz, tekrara düşme.
- Tam 4 şık/seçenek, SADECE 1 doğru; "Hepsi doğru"/"Hiçbiri" yok.
- blank: question_text tek cümle, içinde TAM OLARAK BİR "_____"; doğru cevap 1-3 kelime.
- Paragraflarda ve şıklarda Türkçe tırnak/konuşma çizgisi kurallarına uy; svg_prompt her zaman null.
