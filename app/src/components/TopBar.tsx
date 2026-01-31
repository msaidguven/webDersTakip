'use client';

import React from 'react';
import { Icon } from './icons';

interface TopBarProps {
  notificationCount: number;
  streak: number;
  onNotificationClick: () => void;
}

export function TopBar({ notificationCount, streak, onNotificationClick }: TopBarProps) {
  return (
    <header 
      className="h-[72px] flex items-center justify-between px-8 sticky top-0 z-40"
      style={{ 
        backgroundColor: 'rgba(15, 15, 17, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}
    >
      {/* Left - Breadcrumb/Title */}
      <div>
        <h2 className="text-lg font-semibold text-white">Dashboard</h2>
        <p className="text-sm text-zinc-500">Hoş geldin, Ali! Bugün harika bir gün öğrenmek için.</p>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Ara..."
            className="w-64 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none transition-all"
            style={{ 
              backgroundColor: 'rgba(24, 24, 27, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Streak Badge */}
        <div 
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ 
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(245, 158, 11, 0.1))',
            border: '1px solid rgba(249, 115, 22, 0.2)'
          }}
        >
          <span className="text-xl">🔥</span>
          <div>
            <span style={{ color: '#fb923c' }} className="font-bold">{streak}</span>
            <span className="text-zinc-500 text-sm ml-1">gün</span>
          </div>
        </div>

        {/* Notifications */}
        <button 
          onClick={onNotificationClick}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all"
          style={{ 
            backgroundColor: 'rgba(24, 24, 27, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.8)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(24, 24, 27, 0.8)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <Icon name="bell" className="text-zinc-400" size={20} />
          {notificationCount > 0 && (
            <span 
              className="absolute -top-1 -right-1 w-5 h-5 text-white text-xs font-bold rounded-full flex items-center justify-center"
              style={{ 
                backgroundColor: '#ef4444',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}
            >
              {notificationCount}
            </span>
          )}
        </button>

        {/* Quick Action Button */}
        <button 
          className="flex items-center gap-2 px-5 py-2.5 text-white font-medium rounded-xl transition-all hover:-translate-y-0.5"
          style={{ 
            background: 'linear-gradient(135deg, #6366f1, #9333ea)',
            boxShadow: '0 10px 30px -10px rgba(99, 102, 241, 0.5)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 15px 35px -10px rgba(99, 102, 241, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(99, 102, 241, 0.5)';
          }}
        >
          <Icon name="play" size={18} />
          <span>Çalışmaya Başla</span>
        </button>
      </div>
    </header>
  );
}
