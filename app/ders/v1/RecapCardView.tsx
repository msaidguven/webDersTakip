// Hap bilgi kartı (2026-10-24 pilot): bölümün ana içeriği — sınav kitabı tarzı kısa maddeler. Renkler
// anlam taşır, bölüme göre değişmez: ara başlık lacivert, anahtar kavram mor-pembe, Not turuncu,
// Dikkat kırmızı, Örnek yeşil; renk tek başına anlam taşımasın diye kutularda yazılı etiket de var.
// "İlişkili" etiketleri sitede gösterilmiyor (2026-10-24, kullanıcı); PDF'te duruyor.
// HTML sunucuda üretilir (recapCardToHtml: metin kaçışlı, yalnız <strong> ve KaTeX çıktısı).
import dynamic from 'next/dynamic';
import type { RecapCardHtml } from '@/app/src/lib/recapCards';
import s from './DersClientV1.module.css';

const RecapFigure = dynamic(() => import('./RecapFigure'), { ssr: false });

export default function RecapCardView({ card }: { card: RecapCardHtml }) {
  return (
    <div className={s.recap}>
      {card.introHtml && <p className={s.recapIntro} dangerouslySetInnerHTML={{ __html: card.introHtml }} />}
      {card.groups.map((g, i) => (
        <div key={i}>
          {g.labelHtml && <p className={s.recapLabel} dangerouslySetInnerHTML={{ __html: g.labelHtml }} />}
          <ul className={s.recapList}>
            {g.itemsHtml.map((html, j) => (
              <li key={j} dangerouslySetInnerHTML={{ __html: html }} />
            ))}
          </ul>
        </div>
      ))}
      {card.noteHtml && (
        <p className={s.recapNote}>
          <b>Not</b>{' '}
          <span dangerouslySetInnerHTML={{ __html: card.noteHtml }} />
        </p>
      )}
      {card.warningsHtml.map((html, i) => (
        <p key={i} className={s.recapWarn}>
          <b>Dikkat</b>{' '}
          <span dangerouslySetInnerHTML={{ __html: html }} />
        </p>
      ))}
      {card.example && (
        <div className={s.recapExample}>
          <b>Örnek</b>{' '}
          {card.example.figureSvg && <RecapFigure svg={card.example.figureSvg} label="Örnek sorunun şekli" />}
          <p className={s.recapExQ} dangerouslySetInnerHTML={{ __html: card.example.questionHtml }} />
          <ol className={s.recapSteps}>
            {card.example.stepsHtml.map((html, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: html }} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
