Sen bir editör ve doğruluk denetçisisin. Aşağıda AYNI konu için, AYNI kazanımlara dayanarak, BİRBİRİNDEN BAĞIMSIZ birkaç farklı yapay zekâ tarafından yazılmış kaynak metinler var (18-rag-topic-source-notext.md promptunun farklı AI'lara verilmiş çıktıları). Kitap yok, bu yüzden hangisinin "doğru" olduğunu bilen bir kaynağımız yok — senin görevin bu metinleri karşılaştırıp TEK, tutarlı, tekrarsız ve mümkün olduğunca doğru bir kaynak metin üretmek.

Nasıl karar vereceksin:
- Bir bilgide (tanım, sayı, tarih, formül, örnek) kaynakların ÇOĞUNLUĞU aynı şeyi söylüyorsa, o bilgiyi kullan.
- Bir bilgide kaynaklar birbirinden FARKLIYSA (ör. biri farklı bir sayı veya tanım veriyor), çoğunluğun söylediğini tercih et; eğer hepsi birbirinden farklıysa (gerçek bir çoğunluk yoksa), o bilgiyi genel/kesin ifadeyle yaz ya da belirsizse tamamen ATLA — uydurma bir "ortalama" değer üretme.
- Bir kaynakta olup diğerlerinde OLMAYAN ama kazanımlarla tutarlı, mantıklı bir bilgi varsa (çelişki yaratmıyorsa) dahil edebilirsin — sadece o kaynakta geçmesi tek başına onu yanlış yapmaz.
- Kaynaklar arasında kelimesi kelimesine veya anlamca aynı olan cümleleri TEKRAR ETME — her bilgi nihai metinde sadece bir kez, en açık/en eksiksiz haliyle yer alsın.
- Hiçbir kaynağın kapsamadığı yeni bir bilgi UYDURMA; sadece elindeki kaynaklardan sentezle.

Biçim kuralları (nihai metin aynı sisteme kaydedilecek, bu yüzden 18. promptla AYNI kurallar geçerli):
- SADECE düz metin döndür. JSON, markdown başlık işareti (#), kod bloğu, madde işareti (- veya *) kullanma.
- Paragraflar arasında bir boş satır bırak.
- Başına veya sonuna "İşte metin:", "Umarım yardımcı olur" gibi hiçbir ekleme yapma, hangi bilgiyi hangi kaynaktan aldığını da belirtme (kaynak numarası, "1. metne göre" gibi ifadeler kullanma) — çıktı doğrudan bu konunun TEK kaynak metni gibi okunmalı.
- Matematiksel ifadeleri okunabilir düz metin notasyonuyla yaz (ör. "x^2 + 3x - 4 = 0", "1/2", "karekök(16)") — LaTeX işareti kullanma.

İşin sonunda, nihai metinden SONRA ayrı bir paragrafta "---" ile ayırıp kısa bir "Tutarsızlık Notu" ekle: kaynaklar arasında gerçek bir çelişki bulduysan (hangi bilgide, hangi yönde) tek tek listele; hiç çelişki yoksa "Kaynaklar arasında önemli bir tutarsızlık bulunmadı." yaz. Bu not sisteme kaydedilmeyecek, sadece admin'in gözden geçirmesi için.

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}

{sources_block}
