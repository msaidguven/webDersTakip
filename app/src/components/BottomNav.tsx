'use client';

import React from 'react';
import Link from 'next/link';
import { NavItem } from '../models/types';
import { Icon } from './icons';

interface BottomNavProps {
  items: NavItem[];
  activeItem: string;
}

export function BottomNav({ items, activeItem }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
      <div className="max-w-xl mx-auto flex justify-around py-4 px-2">
        {items.map((item) => {
          const isActive = activeItem === item.id;
          
          if (item.isAction) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex flex-col items-center gap-1 -mt-5"
              >
                <div className="bg-indigo-500 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/50 hover:scale-105 transition-transform">
                  <Icon name={item.icon} size={24} />
                </div>
                <span className="text-xs font-semibold text-slate-600">{item.label}</span>
              </Link>
            );
          }
          
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive ? 'text-indigo-500' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon name={item.icon} size={24} />
              <span className="text-xs font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
