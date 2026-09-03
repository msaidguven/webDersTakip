SVG prompt kuralları (yalnızca bir soru GERÇEKTEN görsel/şekil gerektiriyorsa uygula):
- Çoğu soru için "svg_prompt" alanı null kalmalı; sadece sayı doğrusu, geometrik şekil, kesir/oran, basit çubuk/sütun grafiği, onluk taban bloğu gibi bir görsel soruyu somutlaştıracaksa doldur — dekoratif görsel isteme
- Doldurursan svg_prompt, BAŞKA bir yapay zekaya doğrudan verilecek, kendi başına anlaşılır bir çizim talimatı olsun; sorunun hangi somut sayı/ölçü/etiketi göstermesi gerektiğini (yukarıdaki kaynaktaki gerçek değerlerle) net yaz — çizecek AI uydurma yapmasın
- svg_prompt'un İÇİNE şu teknik kuralları BİREBİR ekle (çizecek AI bunlara uymalı):
  * Kök eleman tam olarak `<svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg">...</svg>` olsun (uygun bir W,H seç, örn. 300x180)
  * `<script>`, `<style>`, `<foreignObject>`, `<image>`, `<a>`, `<use>`, gradient/filter/mask, animasyon (`<animate>` vb.), event handler (onClick vb.) YASAK
  * Tüm metin `<text>`/`<tspan>` içinde kalsın, viewBox dışına taşmasın; sade 3-4 renk, gölge/gradyan yok; koyu zemine beyaz yazı, açık zemine koyu yazı (kontrast şart)
  * Çıktı olarak SADECE SVG kodunu döndürsün, başka açıklama eklemesin
- "svg_position": svg_prompt doldurulduysa, soru metni "yukarıdaki şekle/grafiğe göre" gibi görsele referans veriyorsa "above", görsel soruyu tamamlayan/örnekleyen bir ek unsursa "below" seç; svg_prompt null ise bu alanı yine de "above" yaz (kullanılmayacak)
