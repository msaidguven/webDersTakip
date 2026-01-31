'use client';

import React from 'react';
import { Unit } from '../models/types';
import { Icon } from './icons';

interface UnitCardProps {
  unit: Unit;
  onClick: () => void;
}

export function UnitCard({ unit, onClick }: UnitCardProps) {
  const getBorderColor = () => {
    switch (unit.status) {
      case 'completed':
        return 'border-l-green-500';
      case 'locked':
        return 'border-l-slate-400';
      case 'in_progress':
      default:
        return 'border-l-indigo-500';
    }
  };

  const getBadgeColor = () => {
    switch (unit.status) {
      case 'completed':
        return 'bg-green-500';
      case 'locked':
        return 'bg-slate-400';
      case 'in_progress':
      default:
        return 'bg-indigo-500';
    }
  };

  const getBadgeText = () => {
    switch (unit.status) {
      case 'completed':
        return (
          <>
            <Icon name="check" size={12} className="inline mr-1" /> Bitti
          </>
        );
      case 'locked':
        return (
          <>
            <Icon name="lock" size={12} className="inline mr-1" /> Kilitli
          </>
        );
      case 'in_progress':
      default:
        return 'Devam Ediyor';
    }
  };

  const getProgressColor = () => {
    if (unit.status === 'completed') {
      return 'bg-green-500';
    }
    return 'bg-gradient-to-r from-indigo-500 to-pink-500';
  };

  return (
    <div 
      onClick={onClick}
      className={`
        bg-white rounded-2xl p-5 mb-4 shadow-sm border-l-4 ${getBorderColor()}
        transition-all duration-300 cursor-pointer
        ${unit.status === 'locked' ? 'opacity-60 cursor-not-allowed' : 'hover:translate-x-1 hover:shadow-md'}
      `}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">{unit.title}</h3>
          <p className="text-sm text-slate-500">{unit.subtitle}</p>
        </div>
        <span className={`${getBadgeColor()} text-white px-3 py-1 rounded-full text-xs font-bold`}>
          {getBadgeText()}
        </span>
      </div>
      
      {/* Progress */}
      <div className="mt-4">
        <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
          <span>{unit.status === 'completed' ? 'Başarı Oranı' : 'İlerleme'}</span>
          <span className={unit.status === 'completed' ? 'text-green-500' : ''}>
            {unit.status === 'completed' ? `%${unit.successRate}` : `%${unit.progress}`}
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${getProgressColor()}`}
            style={{ width: `${unit.status === 'completed' ? 100 : unit.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
