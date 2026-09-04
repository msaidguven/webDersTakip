'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { LoginCredentials, AuthState } from '../models/authTypes';

interface UseLoginViewModelReturn {
  state: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  clearError: () => void;
}

export function useLoginViewModel(): UseLoginViewModelReturn {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    error: null,
  });

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Giriş yapılamadı');

      // Sunucu login'i doğruladı ve token'ları döndü — tarayıcıdaki tekil Supabase
      // instance'ına (AuthContext'in dinlediği) burada yükleniyor. getSession() İŞE
      // YARAMAZ: GoTrueClient sadece bellekteki (hâlâ eski/boş) oturumu döndürür,
      // cookie'yi yeniden okumaz — bu yüzden sayfa yenilenene kadar "giriş yapılmamış"
      // görünüyordu. setSession() hem belleği hem cookie'yi gerçekten günceller.
      if (result.session) {
        await createClient().auth.setSession(result.session);
      }

      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
      }));

      router.push('/');
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Giriş yapılamadı',
      }));
    }
  }, [router]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    login,
    clearError,
  };
}
