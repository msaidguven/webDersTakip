'use client';

import React from 'react';
import { SRSReview } from '../models/types';

interface SRSWidgetProps {
  review: SRSReview;
  onReview: () => void;
}

export function SRSWidget({ review, onReview }: SRSWidgetProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 p-6">
      {/* Decorative Elements */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute right-10 bottom-0 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl" />

      <div className="relative flex items-start gap-5">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/30 flex-shrink-0">
          🧠
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-white mb-2">
            {review.title}
          </h3>
          <p className="text-zinc-400 mb-4 leading-relaxed">
            {review.description}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-amber-400">{review.questionCount}</span>
              <span className="text-sm text-zinc-500">Soru</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-orange-400">~{Math.round(review.questionCount * 1.5)}</span>
              <span className="text-sm text-zinc-500">Dakika</span>
            </div>
          </div>

          {/* Action Button */}
          <button 
            onClick={onReview}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all hover:-translate-y-0.5"
          >
            <span>Şimdi Tekrar Et</span>
            <span>→</span>
          </button>
        </div>

        {/* Urgency Indicator */}
        <div className="absolute top-0 right-0 flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-xs text-amber-500 font-medium">Şimdi</span>
        </div>
      </div>
    </div>
  );
}
