HAP BİLGİ KARTI (recap_card) — her alt başlık için öğretmenin tahtaya yazacağı türden kısa, yoğun ve doğru maddeler.

KAPSAM KURALI: Kart, alt başlığın sayfadaki ANA içeriğidir — uzun anlatım ancak istenirse açılır. Bu yüzden alt başlıkta ve kitabın ilgili kısmında geçen, sınavda sorulabilecek HER bilgi (tanım, özellik, örnek, isim, tarih, neden-sonuç) kartta bir maddede yer almalı; madde sayısında üst sınır yok. Kısa ol ama bilgi atlama.

KAYNAK KURALI:
- Bilgiyi ders kitabından al; kitapla çelişen bilgi yazma.
- Tarih, sayı, kişi/kurum adı, ilke/kavram eşleştirmesi YALNIZ kaynakta açıkça geçiyorsa yazılır. Emin olmadığını yazma; uydurma.
- Alt başlığın kapsamı dışına çıkma; başka alt başlığın bilgisini bu karta koyma.

KART YAPISI:
- **intro** (isteğe bağlı): Konunun "neden"ini veren 1-2 kısa cümle bağlam. Maddeler kendi başına anlaşılıyorsa null.
- **groups**: 1-4 madde grubu; bilgi kadar madde.
  - **label** (isteğe bağlı): grubun ara başlığı; neden-sonuç ya da karşılaştırma varsa kullan ve ";" ile bitir. Örnek kalıplar: "X kaldırılarak;", "X ile;", "X'in sonuçları;", "Benzer yönleri;". Gerekmiyorsa null.
  - **items**: her madde TEK bilgi, tek cümle, en fazla 20 kelime. "Kim/ne → ne yaptı/ne oldu → sonucu" kalıbını tercih et. Sınavda sorulabilecek en kritik terimi **kalın** yaz (madde başına en fazla 1-2 kalın; kalın kısım renkli gösterilir).
- **note** (isteğe bağlı): maddelerde OLMAYAN, bilinmesi faydalı TEK ek bilgi (1 cümle). Maddelerdeki bir bilgiyi tekrar edecekse null — çoğu kartta null olması normaldir.
- **warnings**: yalnız GERÇEK bir karışıklık/tuzak varsa (0-2, her biri 1 cümle): iki kavramı AYIRT ETTİREN farkı söyle (ör. "Gelenekte yaptırım gücü vardır, görenekte yoktur."). Maddelerdeki tanımları yeniden sıralama, kartın özetini yazma; böyle bir nokta yoksa boş dizi.
- **tags**: kaynakta bu alt başlıkla AÇIKÇA ilişkilendirilen ilke/kavram/değer adları (0-3 adet, ör. "Laiklik", "Dayanışma"). Kaynakta açık bir ilişki yoksa boş dizi — tahminle etiket ekleme.
{lesson_kind_rules}

KART YASAKLARI:
- Aynı bilgi konunun kartlarının tamamında YALNIZ BİR KEZ geçer (başka kartta ya da aynı kartta tekrar yok).
- "sen/senin" hitabı, retorik soru, "Unutma!", ünlem, kaynak/dipnot referansı.
- Anlatım metnindeki cümleleri olduğu gibi kopyalama; kısalt ve hap bilgiye çevir.
- Yazım TDK'ye uygun ve tutarlı olsun; şapkalı yazılışı (Millî, Vekâlet vb.) kaynaktaki gibi koru ve her yerde aynı yaz.

recap_card nesnesinin biçimi:
{
  "intro": string | null,
  "groups": [ { "label": string | null, "items": [string] } ],
  "tags": [string],
  "note": string | null,
  "warnings": [string],
  "example": { "question": string, "solution": string, "figure_prompt": string | null } | null
}
