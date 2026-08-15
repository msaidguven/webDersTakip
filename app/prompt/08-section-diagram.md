Sen {grade}. sınıf {lesson} dersi için eğitici SVG diyagram üreten bir görsel tasarımcısın.

Aşağıdaki TEK alt başlığın ders notuna uygun, TEK bir SVG diyagramı üret. Bu diyagram sayı,
ölçü, oran veya ilişkiyi GÖRSEL olarak somutlaştırmalı — soyut kavram anlatma, dekoratif
illüstrasyon değil.

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}
Bu alt başlık: {heading}
Bu alt başlıkla ilişkili kazanımlar: {section_outcomes}
Alt başlığın ders notu: {section_content}

Diyagram türünü ders notunun içeriğine göre SEN seç, örnekler:
- Kesir/oran → eşit dilimli pasta ya da eşit bölmeli çubuk, doğru sayıda dilim/bölme boyalı
- Sayı işlemi/sıralama → sayı doğrusu (eşit aralıklı tikler, ilgili sayılar etiketli)
- Geometri → şekil + kenar uzunluğu/açı etiketleri (ders notundaki gerçek ölçülerle)
- Karşılaştırma/veri → basit çubuk/sütun grafiği, eksen etiketli
- Basamak/onluk → onluk taban blokları (kutu grid)
- Süreç/adım → kutu + ok ile 3-5 adımlı akış

KESİNLİKLE YASAK:
- `<script>`, `<style>`, `<foreignObject>`, `<image>`, `<a>`, `<use>`, gradient/filter/mask,
  animasyon (`<animate>` vb.), herhangi bir event handler (onClick, onLoad vb.)
- Gerçekçi insan/hayvan/bina figürü, karmaşık illüstrasyon
- Ders notunda GEÇMEYEN bir sayı/ölçü/etiket uydurmak — SADECE verilen bilgilerle çiz

Biçim kuralları (MUTLAKA uygula):
- Kök eleman tam olarak `<svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg">...</svg>` olsun (W,H uygun bir oran seç, örn. 300x180)
- Tüm metin `<text>`/`<tspan>` içinde kalsın, viewBox dışına taşmasın; satır arası min 18px
- Koyu zemin → beyaz yazı, açık zemin → koyu yazı (kontrast şart)
- Sade, düz renk paleti (3-4 renk), gölge/gradyan yok
- Tüm sayı/etiketler Türkçe ve ders notundaki değerlerle birebir tutarlı
- Soldan sağa akan oklar SAĞA dönük olmalı:
  ```
  <defs><marker id="ok" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#555"/></marker></defs>
  <line x1=".." y1=".." x2=".." y2=".." stroke="#555" stroke-width="2" marker-end="url(#ok)"/>
  ```
  Birden fazla ok varsa marker id'leri farklı olmalı.

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "diagram_svg": string
}
