'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated, user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#0f0f11]">
      {/* Sabit Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-[60px] sm:h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-3 sm:px-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <span className="text-lg sm:text-xl">📚</span>
              </div>
              <span className="text-lg sm:text-xl font-bold text-white hidden sm:block">Ders Takip</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-6">
            {isAuthenticated ? (
              <>
                <span className="text-zinc-400 text-sm hidden sm:block">
                  👋 {user?.email?.split('@')[0]}
                </span>
                <Link href="/profil" className="text-zinc-400 hover:text-white transition-colors text-sm">
                  Profil
                </Link>
                <button 
                  onClick={signOut}
                  className="text-zinc-400 hover:text-red-400 transition-colors text-sm"
                >
                  Çıkış
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="text-zinc-400 hover:text-white transition-colors hidden sm:block text-sm"
                >
                  Giriş Yap
                </Link>
                <Link 
                  href="/register"
                  className="px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all text-xs sm:text-sm"
                >
                  Kayıt Ol
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Ana İçerik */}
      <main className="pt-[60px] sm:pt-[72px]">
        {children}
      </main>
    </div>
  );
}
