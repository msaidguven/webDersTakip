'use client';

import React from 'react';
import Link from 'next/link';
import { NavItem } from '../models/types';
import { Icon } from './icons';

interface SidebarProps {
  items: NavItem[];
  activeItem: string;
}

export function Sidebar({ items, activeItem }: SidebarProps) {
  return (
    <aside 
      className="fixed left-0 top-0 h-screen w-[280px] z-50 flex flex-col"
      style={{ 
        backgroundColor: 'rgba(15, 15, 17, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)'
      }}
    >
      {/* Logo Area */}
      <div className="p-6" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <Link href="/" className="flex items-center gap-3 group">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-shadow"
            style={{ 
              background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
              boxShadow: '0 10px 30px -10px rgba(99, 102, 241, 0.5)'
            }}
          >
            <span className="text-xl font-bold text-white">E</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">EduSmart</h1>
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
                  ? 'text-indigo-400' 
                  : 'text-zinc-400 hover:text-white'
                }
              `}
              style={{
                backgroundColor: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                border: isActive ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent'
              }}
            >
              <Icon 
                name={item.icon} 
                size={20} 
                className={`transition-colors ${isActive ? 'text-indigo-400' : 'group-hover:text-white'}`}
              />
              <span className="font-medium">{item.label}</span>
              {isActive && (
                <div 
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ 
                    backgroundColor: '#818cf8',
                    boxShadow: '0 0 8px rgba(99, 102, 241, 0.6)'
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Back to Home */}
      <div className="px-4 py-2">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:text-white transition-all"
        >
          <Icon name="home" size={20} />
          <span className="font-medium">Ana Sayfa</span>
        </Link>
      </div>

      {/* User Profile */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <button 
          className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors group"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
            style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
          >
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
