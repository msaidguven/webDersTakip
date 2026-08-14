'use client';

import { useState } from 'react';

export type ComboboxOption = { id: number; label: string; sublabel?: string };

interface SearchComboboxProps {
  query: string;
  onQueryChange: (query: string) => void;
  options: ComboboxOption[];
  onSelect: (option: ComboboxOption) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
}

// Hem yazarak arama hem de açılır liste gibi davranan ortak seçici. İl/İlçe için
// zaten yüklenmiş listeyi filtrelemek amacıyla, Okul için ise sunucudan arama
// sonuçları göstermek amacıyla kullanılır (options her iki durumda da parent
// tarafından zaten filtrelenmiş halde verilir).
export default function SearchCombobox({ query, onQueryChange, options, onSelect, placeholder, disabled, emptyText }: SearchComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { onQueryChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-xl bg-surface border border-default text-default text-sm disabled:opacity-50"
      />
      {open && !disabled && (options.length > 0 || emptyText) && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-default bg-surface-elevated shadow-lg">
          {options.length > 0 ? (
            options.map((o) => (
              <button
                key={o.id}
                type="button"
                onMouseDown={() => { onSelect(o); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface flex items-center justify-between gap-2"
              >
                <span className="text-default truncate">{o.label}</span>
                {o.sublabel && <span className="text-xs text-muted-foreground whitespace-nowrap">{o.sublabel}</span>}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</p>
          )}
        </div>
      )}
    </div>
  );
}
