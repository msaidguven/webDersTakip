// Boş ay çizelgesi önizlemesi. Dersler şimdilik boş bırakılıyor; öğrenci adları kendisi yazar.
// PDF'in kendisi lib/cizelgePdf.ts'te üretilir; bu bileşen yalnızca ekrandaki önizlemeyi çizer.
import { Fragment } from 'react';
import { SUBJECT_SLOTS } from '@/app/src/lib/cizelgePdf';

export function PrintableSheet({ title, days }: { title: string; days: number }) {
  const cell = 'border border-neutral-400 text-center';
  return (
    <div className="bg-white p-4 text-neutral-900">
      <h3 className="mb-3 text-center text-lg font-black">{title}</h3>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th rowSpan={2} className={`${cell} w-14 font-bold`}>
              Tarih
            </th>
            {Array.from({ length: SUBJECT_SLOTS }, (_, i) => (
              <th key={i} colSpan={2} className={`${cell} h-7 font-bold`} />
            ))}
            <th rowSpan={2} className={`${cell} w-16 font-bold`}>
              Toplam
            </th>
          </tr>
          <tr>
            {Array.from({ length: SUBJECT_SLOTS }, (_, i) => (
              <Fragment key={i}>
                <th className={`${cell} font-normal`}>Doğru</th>
                <th className={`${cell} font-normal`}>Yanlış</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: days }, (_, i) => (
            <tr key={i}>
              <td className={`${cell} font-bold`}>{i + 1}</td>
              {Array.from({ length: SUBJECT_SLOTS * 2 + 1 }, (_, j) => (
                <td key={j} className={`${cell} h-6`} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
