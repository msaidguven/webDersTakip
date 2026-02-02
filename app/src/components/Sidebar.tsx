'use client';

import React from 'react';
import Link from 'next/link';
import { NavItem } from '../models/types';
import { Icon } from './icons';

interface SidebarProps {
  items: NavItem[];
  activeItem: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ items, activeItem, isOpen, onClose }: SidebarProps) {
  return (
    <aside className={`
      fixed left-0 top-0 h-screen w-[280px] bg-surface/95 backdrop-blur-xl border-r border-white/5 z-50 flex flex-col
      transition-transform duration-300 ease-in-out
      lg:translate-x-0
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Close Button for Mobile */}
      <button
        onClick={onClose}
        className="lg:hidden absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/20 transition-colors z-50"
      >
        ✕
      </button>

      {/* Logo Area */}
      <div className="p-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 group" onClick={onClose}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow">
            <span className="text-xl font-bold text-white">📚</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Ders Takip</h1>
            <p className="text-xs text-zinc-500">Öğrenme Yolculuğu</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {items.map((item) => {
          const isActive = activeItem === item.id;
          
          if (item.isAction) return null;
          
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-primary/10 text-indigo-400 border border-primary/20' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <Icon 
                name={item.icon} 
                size={20} 
                className={`transition-colors ${isActive ? 'text-indigo-400' : 'group-hover:text-white'}`}
              />
              <span className="font-medium">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Back to Home */}
      <div className="px-4 py-2">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <Icon name="home" size={20} />
          <span className="font-medium">Ana Sayfa</span>
        </Link>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-white/5">
        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
            AY
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">
              Ali Yılmaz
            </p>
            <p className="text-xs text-zinc-500">Öğrenci</p>
          </div>
          <Icon name="chevron-right" size={16} className="text-zinc-600 group-hover:text-zinc-400" />
        </button>
      </div>
    </aside>
  );
}
