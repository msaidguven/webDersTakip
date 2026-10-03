'use client';

import { useState, type ReactNode } from 'react';
import { MIN_PASSWORD_LENGTH, generateStrongPassword, passwordStrength } from '@/app/src/lib/password';
import s from './Auth.module.css';

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  // current-password: giriş · new-password: kayıt/yenileme (tarayıcı şifre önerisi ve kaydı için)
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  showStrength?: boolean;
  // Verilirse "Güçlü şifre öner" düğmesi çıkar; üretilen şifre bu fonksiyona gider (ör. tekrar alanını da doldurmak için).
  onGenerate?: (password: string) => void;
  labelAside?: ReactNode;
  invalid?: boolean;
};

export function PasswordField({ id, label, value, onChange, autoComplete, placeholder, showStrength, onGenerate, labelAside, invalid }: Props) {
  const [visible, setVisible] = useState(false);
  const strength = passwordStrength(value);
  const hintId = `${id}-hint`;

  const generate = () => {
    const pwd = generateStrongPassword();
    onGenerate?.(pwd);
    // Öğrenci üretilen şifreyi görebilsin/not alabilsin diye açık gösterilir.
    setVisible(true);
  };

  return (
    <div className={s.field}>
      <div className={s.labelRow}>
        <label htmlFor={id} className={s.label}>{label}</label>
        {labelAside}
        {onGenerate && !labelAside && (
          <button type="button" className={s.link} onClick={generate}>Güçlü şifre öner</button>
        )}
      </div>
      <div className={s.inputWrap}>
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          className={`${s.input} ${s.withAction}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={autoComplete === 'new-password' ? MIN_PASSWORD_LENGTH : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={showStrength ? hintId : undefined}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <button type="button" className={s.inlineBtn} onClick={() => setVisible((v) => !v)} aria-controls={id} aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}>
          {visible ? 'Gizle' : 'Göster'}
        </button>
      </div>
      {showStrength && (
        <>
          <div className={s.meter} aria-hidden="true">
            {[1, 2, 3, 4].map((n) => <span key={n} data-on={strength.score >= n} />)}
          </div>
          <span id={hintId} className={s.hint} aria-live="polite">{strength.label}</span>
        </>
      )}
    </div>
  );
}
