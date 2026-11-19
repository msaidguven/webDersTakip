'use client';

// Kavram tamamlanınca açılan bilgi kartı: kavram adı, tanımı ve varsa kısa ek açıklama.
import { useEffect, useRef } from 'react';
import { ArrowRight, CircleCheck } from 'lucide-react';
import type { Kavram } from '@/app/src/lib/kavramAvi';
import r from '../robotic/robotic.module.css';
import s from './kavramAvi.module.css';

type Props = {
  kavram: Kavram;
  sonrakiVar: boolean;
  onSonraki: () => void;
};

export function BilgiKarti({ kavram, sonrakiVar, onSonraki }: Props) {
  const dugme = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    dugme.current?.focus({ preventScroll: false });
  }, []);

  return (
    <section className={`${s.bilgiKarti} ${r.item}`} aria-label="Bilgi kartı">
      <span className={`inline-flex items-center gap-2 ${r.label}`}>
        <CircleCheck size={16} aria-hidden="true" /> Kavramı buldun!
      </span>
      <h3 className={s.bilgiBaslik}>{kavram.kavram}</h3>
      <p className={s.bilgiMetin}>{kavram.tanim}</p>
      {kavram.ek ? (
        <p className={s.bilgiEk}>
          <strong>Biliyor muydun? </strong>
          {kavram.ek}
        </p>
      ) : null}
      <button
        ref={dugme}
        type="button"
        className={`${s.dugme} ${r.btnNeon} ${r.btnText}`}
        onClick={onSonraki}
        aria-label={sonrakiVar ? 'Sonraki kavrama geç' : 'Kavram listesine dön'}
      >
        {sonrakiVar ? 'Sonraki Kavram' : 'Kavram Listesine Dön'} <ArrowRight size={18} aria-hidden="true" />
      </button>
    </section>
  );
}
