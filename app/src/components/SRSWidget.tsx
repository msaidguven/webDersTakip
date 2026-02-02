'use client';

import React from 'react';
import { SRSReview } from '../models/types';

interface SRSWidgetProps {
  review: SRSReview;
  onReview: () => void;
}

export function SRSWidget({ review, onReview }: SRSWidgetProps) {
  return (
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 p-4 sm:p-6">
      {/* Decorative Elements */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute right-10 bottom-0 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl" />

      <div className="relative flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
        {/* Icon */}
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-amber-500/30 flex-shrink-0">
          🧠
        </div>

        {/* Content */}
        <div className="flex-1 w-full">
          <h3 className="text-lg sm:text-xl font-semibold text-default mb-1.5 sm:mb-2">
            {review.title}
          </h3>
          <p className="text-muted text-sm sm:text-base mb-3 sm:mb-4 leading-relaxed">
            {review.description}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 sm:gap-6 mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-2xl font-bold text-amber-400">{review.questionCount}</span>
              <span className="text-xs sm:text-sm text-muted">Soru</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-2xl font-bold text-orange-400">~{Math.round(review.questionCount * 1.5)}</span>
              <span className="text-xs sm:text-sm text-muted">Dakika</span>
            </div>
          </div>

          {/* Action Button */}
          <button 
            onClick={onReview}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-default font-semibold rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all hover:-translate-y-0.5 text-sm sm:text-base"
          >
            <span>Şimdi Tekrar Et</span>
            <span>→</span>
          </button>
        </div>

        {/* Urgency Indicator */}
        <div className="absolute top-0 right-0 flex items-center gap-1.5 sm:gap-2">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-[10px] sm:text-xs text-amber-500 font-medium">Şimdi</span>
        </div>
      </div>
    </div>
  );
}
