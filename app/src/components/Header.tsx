'use client';

import React from 'react';
import Image from 'next/image';
import { User } from '../models/types';
import { Icon } from './icons';

interface HeaderProps {
  user: User;
  notificationCount: number;
  onNotificationClick: () => void;
  onProfileClick: () => void;
}

export function Header({ user, notificationCount, onNotificationClick, onProfileClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="max-w-xl mx-auto px-5 py-5 flex justify-between items-center">
        <div className="user-info">
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-transparent mb-1">
            Tekrar Hoşgeldin! 👋
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Bugün {user.streak}. Hafta konularına devam edelim
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={onNotificationClick}
            className="w-11 h-11 rounded-full bg-slate-50 flex items-center justify-center text-slate-700 hover:bg-indigo-500 hover:text-default transition-all duration-300 hover:-translate-y-0.5 relative"
          >
            <Icon name="bell" size={20} />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-default text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center border-2 border-default">
                {notificationCount}
              </span>
            )}
          </button>
          <button 
            onClick={onProfileClick}
            className="w-11 h-11 rounded-full overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all"
          >
            <Image
              src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff`}
              alt={user.name}
              width={44}
              height={44}
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
