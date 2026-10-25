// Soru SVG'sini Word'e gömülebilir PNG'ye çevirir (resvg). Kullanan route'lar next.config.ts'te
// RESVG_LINUX_X64_TRACE_INCLUDES'a eklenmeli (resvg binary'si + aşağıdaki yazı tipleri).
//
// 2026-10-23: (1) Yazı tipi projeden verilir — sunucuda (Vercel) sistem yazı tipi yok, SVG'deki "Arial"
// bulunamayınca yazılar düşüyor/yerelde eşit aralıklı yedek yazıya dönüyordu. (2) Boyut PDF kağıdıyla aynı
// kural: en fazla sayfa genişliği ve 55 mm yükseklik (eskiden hepsi 420 px genişliğe zorlanıyordu; kare
// görseller dev, geniş sayı doğruları okunmaz kalıyordu). (3) Bitmap 3 kat yoğunlukta, baskıda net.
import 'server-only';
import path from 'node:path';
import { ImageRun } from 'docx';
import { Resvg, type ResvgRenderOptions } from '@resvg/resvg-js';

const FONT_DIR = path.join(process.cwd(), 'public/fonts');
const FONT: ResvgRenderOptions['font'] = {
  fontFiles: [path.join(FONT_DIR, 'NotoSans-Regular.ttf'), path.join(FONT_DIR, 'NotoSans-Bold.ttf')],
  loadSystemFonts: false,
  defaultFontFamily: 'Noto Sans',
  sansSerifFamily: 'Noto Sans',
  serifFamily: 'Noto Sans',
  monospaceFamily: 'Noto Sans',
};

// Word px'i 96 dpi: 620 px ≈ 16,4 cm (kenar boşluklu A4 içi), 208 px ≈ 55 mm.
const MAX_WIDTH = 620;
const MAX_HEIGHT = 208;
const DENSITY = 3;

// docx kütüphanesi (9.7) her resmin <wp:docPr id> sayacını sıfırdan başlatıyor → belgedeki tüm resimler id="1".
// LibreOffice aynı kimlikli resimleri sayfada çizemiyor (yer tutucu kalıyor, 2026-10-23). Süreç boyunca artan
// sayaç her belgede benzersiz kimlik verir.
let nextDocPrId = 1000;
const takeDocPrId = () => (nextDocPrId = nextDocPrId >= 2_000_000_000 ? 1000 : nextDocPrId + 1);

export function svgToImageRun(
  svg: string,
  box: { maxWidth: number; maxHeight: number } = { maxWidth: MAX_WIDTH, maxHeight: MAX_HEIGHT },
  label = 'Soru görseli'
): ImageRun | null {
  try {
    const probe = new Resvg(svg, { font: FONT });
    const scale = Math.min(box.maxWidth / probe.width, box.maxHeight / probe.height);
    const width = Math.max(1, Math.round(probe.width * scale));
    const height = Math.max(1, Math.round(probe.height * scale));
    const rendered = new Resvg(svg, { font: FONT, fitTo: { mode: 'width', value: width * DENSITY } }).render();
    return new ImageRun({
      type: 'png',
      data: rendered.asPng(),
      transformation: { width, height },
      altText: { id: String(takeDocPrId()), name: label, description: label, title: label },
    });
  } catch {
    // Bozuk/desteklenmeyen bir SVG dokümanı bloke etmesin — o sorunun görseli
    // atlanır, metni yine de Word'e girer.
    return null;
  }
}
