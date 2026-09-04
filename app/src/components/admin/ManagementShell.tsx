'use client';

import React, { useState } from 'react';
import BulkDeletePanel from '@/app/src/components/admin/BulkDeletePanel';

type ManageSection = 'bulk-delete' | 'single-delete';

const SECTIONS: { key: ManageSection; label: string }[] = [
  { key: 'bulk-delete', label: 'Toplu Sil' },
  { key: 'single-delete', label: 'Tek Tek Sil' },
];

export default function ManagementShell() {
  const [section, setSection] = useState<ManageSection>('bulk-delete');

  return (
    <div className="py-4 sm:py-8">
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              section === s.key ? 'bg-indigo-500 text-white' : 'bg-surface text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'bulk-delete' && <BulkDeletePanel />}
      {section === 'single-delete' && (
        <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center">
          <p className="text-muted-foreground text-sm">Yakında</p>
        </div>
      )}
    </div>
  );
}
