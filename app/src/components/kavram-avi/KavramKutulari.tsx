// Kavramın kutucukları: kelime kelime gruplanır, kelimeler arasında boşluk kalır.
// Bulunan kelimeler dolu, aranan kelimede açılan ipucu harfleri soluk görünür.
import s from './kavramAvi.module.css';

type Props = {
  kelimeler: string[];
  aktif: number;
  ipucu: number;
};

export function KavramKutulari({ kelimeler, aktif, ipucu }: Props) {
  const enUzun = Math.max(1, ...kelimeler.map((k) => Array.from(k).length));
  return (
    <div className={s.kutularKap}>
      <div className={s.kutular} style={{ '--n': enUzun } as React.CSSProperties}>
        {kelimeler.map((kelime, ki) => {
          const bulundu = ki < aktif;
          const harfler = Array.from(kelime);
          const durum = bulundu
            ? `bulundu: ${kelime}`
            : ki === aktif
              ? `aranıyor${ipucu > 0 ? `, ilk ${ipucu} harfi: ${harfler.slice(0, ipucu).join(' ')}` : ''}`
              : 'henüz bulunmadı';
          return (
            <div
              key={ki}
              className={s.kelimeGrubu}
              role="img"
              aria-label={`${ki + 1}. kelime, ${harfler.length} harf, ${durum}`}
            >
              {harfler.map((harf, hi) => {
                const ipucuHarfi = ki === aktif && hi < ipucu;
                const sinif = bulundu ? s.kutuDolu : ipucuHarfi ? s.kutuIpucu : ki === aktif ? `${s.kutu} ${s.aktifKutu}` : s.kutu;
                return (
                  <span key={hi} className={sinif} aria-hidden="true">
                    {bulundu || ipucuHarfi ? harf : ''}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
