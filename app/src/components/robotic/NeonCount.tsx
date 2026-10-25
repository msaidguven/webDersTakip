// Kartlardaki sayı göstergesi (2026-10-25): çerçeveli küçük neon kutuda başlık yazı tipiyle sayı, yanında
// birim ("[25] soru"). Yedi segmentli dijital yazı tipi (DSEG7) denendi; sayfanın yazı tipleri arasında
// sırıttığı için kaldırıldı — gösterge hissini kutu veriyor.
import r from './robotic.module.css';

export function NeonCount({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={r.readout}>{value}</span>
      <span className="text-xs text-muted-foreground">{unit}</span>
    </span>
  );
}
