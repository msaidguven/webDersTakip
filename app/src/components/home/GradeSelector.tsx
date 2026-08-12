'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, ListChecks, Target } from 'lucide-react';
import { Grade } from '../../models/homeTypes';

interface GradeSelectorProps {
  grades: Grade[];
  isLoading: boolean;
  error?: string | null;
  onSelect: (grade: Grade) => void;
}

const FEATURE_CHIPS = [
  { icon: Calendar, label: 'Haftalık Müfredat' },
  { icon: ListChecks, label: 'İnteraktif Testler' },
  { icon: Target, label: 'Kazanım Takibi' },
];

function Hero() {
  return (
    <div className="text-center mb-8 sm:mb-14">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-default bg-surface-elevated px-3 py-1.5 text-[11px] sm:text-xs font-bold text-muted-foreground mb-4 sm:mb-5">
        🎓 MEB Müfredatına Uygun
      </span>
      <h1 className="text-3xl sm:text-5xl font-black text-default mb-3 sm:mb-4 tracking-tight">
        Sınıfını Seç, <span className="gradient-text">Derse Başla</span>
      </h1>
      <p className="text-muted-foreground text-sm sm:text-lg max-w-xl mx-auto mb-5 sm:mb-8">
        Haftalık müfredata uygun konu anlatımları ve interaktif testlerle çalış, ilerlemeni takip et.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {FEATURE_CHIPS.map(({ icon: FeatureIcon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated border border-default px-3 py-1.5 text-[11px] sm:text-xs font-bold text-muted-foreground"
          >
            <FeatureIcon className="h-3.5 w-3.5 text-indigo-500" /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function GradeSelector({ grades, isLoading, error, onSelect }: GradeSelectorProps) {
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <Hero />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rounded-2xl border border-default bg-surface-elevated p-4 sm:p-6 animate-pulse">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-surface mb-3 sm:mb-4" />
              <div className="h-4 sm:h-5 w-20 rounded bg-surface mb-2" />
              <div className="h-3 w-28 rounded bg-surface" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 sm:p-6">
          <p className="font-bold text-red-500 mb-1">Sınıflar yüklenirken bir hata oluştu</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (grades.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-2xl border border-default bg-surface-elevated p-6 text-center text-muted-foreground text-sm font-bold">
          Henüz sınıf bulunmamaktadır.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Hero />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
        {grades.map((grade) => (
          <Link
            key={grade.id}
            href={`/${grade.slug || grade.id}`}
            onClick={() => onSelect(grade)}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-default bg-surface-elevated p-4 sm:p-6 card-hover"
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${grade.color} opacity-0 group-hover:opacity-[0.07] transition-opacity`}
            />
            <div className="relative flex-1">
              <div
                className={`h-12 w-12 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${grade.color} flex items-center justify-center text-2xl sm:text-3xl shadow-lg mb-3 sm:mb-4 transition-transform group-hover:scale-105`}
              >
                {grade.icon}
              </div>
              <h2 className="text-base sm:text-lg font-black text-default mb-1">{grade.name}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{grade.description}</p>
            </div>

            <div className="relative mt-3 sm:mt-4 flex items-center gap-1 text-xs sm:text-sm font-bold text-indigo-500">
              İncele
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
