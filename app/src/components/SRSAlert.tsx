'use client';

import React from 'react';
import { SRSReview } from '../models/types';

interface SRSAlertProps {
  review: SRSReview;
  onReview: () => void;
}

export function SRSAlert({ review, onReview }: SRSAlertProps) {
  return (
    <div className="bg-gradient-to-br from-amber-100 via-yellow-100 to-amber-200 rounded-2xl p-5 mb-6 flex items-center gap-4 border border-amber-300 shadow-sm">
      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-3xl shadow-md flex-shrink-0">
        🧠
      </div>
      <div className="flex-1">
        <h3 className="text-base font-bold text-amber-800 mb-1">
          {review.title}
        </h3>
        <p className="text-sm text-amber-700/80 mb-3">
          {review.description}
        </p>
        <button 
          onClick={onReview}
          className="bg-amber-500 text-default px-4 py-2 rounded-lg font-semibold text-sm hover:bg-amber-600 hover:scale-105 transition-all duration-300"
        >
          Şimdi Tekrar Et
        </button>
      </div>
    </div>
  );
}
