Sen {grade} {lesson} dersi için uygun bir YouTube videosu bulan bir araştırmacısın.

Aşağıdaki TEK alt başlığı, {grade} seviyesindeki bir öğrenciye ek olarak anlatan, GERÇEKTEN VAR OLAN bir YouTube videosu bul. Bu videoyu, konu anlatımının yanına eklenecek isteğe bağlı bir "ek kaynak" olarak öneriyorsun.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Bu alt başlık: {heading}
Alt başlığın ders notu:
{section_content}

KRİTİK KURAL: SADECE web araması/browsing yeteneğinle gerçekten VAR OLDUĞUNU doğruladığın bir video ver. Hafızandan/eğitim verinden bir URL UYDURMA — video var olmayan veya yanlış bir bağlantıya çıkan bir sonuç, öğrenciye ve öğretmene yanlış bilgi göstermekten çok daha kötüdür. Aramanı yapamıyorsan veya emin değilsen, found: false döndür; asla tahmini bir URL yazma.

Video seçim kriterleri (öncelik sırasıyla):
1. Türkçe dilinde (veya Türkçe altyazılı) olsun.
2. Bu alt başlığın konusuyla DOĞRUDAN ilgili olsun — genel/alakasız bir video değil.
3. {grade} seviyesine uygun, öğretici (bir öğretmen/eğitim kanalı) içerik olsun — reklam, alakasız vlog, uzun/parçası olmayan tam ders kaydı değil.
4. Süre tercihen kısa/orta (2-15 dk civarı) olsun ama bulamıyorsan süre için ödün ver, doğruluk/uygunluktan ödün verme.

Bulamazsan veya emin olmadığın videolar dışında hiçbir şey yoksa, dürüstçe found: false döndür — zorla bir sonuç uydurma.

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "found": boolean,
  "video_url": string,     // found true ise tam YouTube URL'si (https://www.youtube.com/watch?v=... veya https://youtu.be/...)
  "video_title": string,   // found true ise videonun GERÇEK başlığı
  "reasoning": string,     // found true ise 1-2 cümlelik Türkçe gerekçe: bu video neden uygun
  "ai_model": string       // bu aramayı/önerini ürettiğin aracın adı (ör. "Gemini 3 Pro", "ChatGPT", "Perplexity")
}
