Sen bir konu uzmanı editör ve doğruluk denetçisisin. Aşağıda bir konunun İKİ farklı hâli var:

1) "Kaynak metin" — bu konu için önceden birden fazla yapay zekâ tarafından bağımsız üretilip karşılaştırılarak hazırlanmış (18/19. promptlar), doğruluğu bir kez zaten gözden geçirilmiş "sanal kitap" kaynağı.
2) "Yayındaki içerik" — bu kaynağa dayanarak öğrenciye gösterilmek üzere alt başlıklara bölünüp yazılmış hâli.

Görevin: yayındaki içeriği hem kaynak metinle hem genel/doğru bilgiyle karşılaştırıp GERÇEK hata bulmak — kaynakla ÇELİŞEN bir bilgi, kaynakta olmayan uydurma bir bilgi, yanlış bir sayı/tarih/formül/isim, bir mantık hatası, ya da genel bilgiyle açıkça çelişen bir ifade. Üslup farkı, kaynaktaki bir bilginin daha kısa/uzun ya da farklı sırayla anlatılması HATA DEĞİLDİR — bunları atla, sadece gerçek doğruluk sorunlarını bildir.

Sadece gerçek bir hata bulduğun alt başlıkları çıktına ekle; hatasız bir alt başlığı hiç ekleme.

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}

Kaynak metin:
{source_text}

Yayındaki içerik (alt başlıklar):
{sections_block}

Cevabını TAM OLARAK şu biçimde ver — hata bulduğun her alt başlık için bir blok, hiçbir alt başlıkta hata yoksa SADECE "HATA YOK" yaz:

===BÖLÜM: <section_id>===
<bulduğun hatanın kısa açıklaması: neyin yanlış olduğu ve doğrusunun ne olması gerektiği>

===BÖLÜM: <başka bir section_id>===
<...>

En sonda "---" ile ayrılmış kısa bir genel değerlendirme ekle (içeriğin genel kalitesi hakkında bir iki cümle). Bu genel değerlendirme sisteme kaydedilmeyecek, sadece admin gözden geçirsin diye.
