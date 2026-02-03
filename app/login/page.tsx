'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLoginViewModel } from '../src/viewmodels/useLoginViewModel';
import { useAuth } from '../src/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/';
  
  const { isAuthenticated, loading } = useAuth();
  const { state, login, clearError } = useLoginViewModel();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Giriş yapmış kullanıcıyı yönlendir
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, loading, router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ email, password });
  };

  // Yükleniyor veya giriş yapmışsa formu gösterme
  if (loading || isAuthenticated) {
    return (
      <div className="min-h-screen bg-default flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted">Yonlendiriliyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-default flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25">
              <span className="text-3xl">🎓</span>
            </div>
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="text-2xl font-black bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Ders Takip
              </span>
              <span className="text-sm font-bold text-indigo-400/80">.net</span>
            </div>
          </Link>
          <p className="text-muted mt-2">Öğrenmeye devam et</p>
        </div>

        {/* Form */}
        <div className="rounded-2xl bg-surface-elevated border border-default p-8">
          <h2 className="text-xl font-semibold text-default mb-6">Giris Yap</h2>

          {state.error && (
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {state.error}
              <button 
                onClick={clearError}
                className="ml-2 text-red-500 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-2">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-default text-default placeholder-muted focus:outline-none focus:border-indigo-500"
                placeholder="ornek@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Sifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-default text-default placeholder-muted focus:outline-none focus:border-indigo-500"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={state.isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
            >
              {state.isLoading ? 'Giris yapiliyor...' : 'Giris Yap'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted text-sm">
              Hesabin yok mu?{' '}
              <Link href="/register" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
                Kayit Ol
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-muted hover:text-default text-sm">
            ← Ana Sayfaya Don
          </Link>
        </div>
      </div>
    </div>
  );
}
