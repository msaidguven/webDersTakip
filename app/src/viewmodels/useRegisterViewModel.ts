'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { RegisterData, AuthState } from '../models/authTypes';

const SUPABASE_URL = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

interface UseRegisterViewModelReturn {
  state: AuthState;
  register: (data: RegisterData) => Promise<void>;
  clearError: () => void;
}

export function useRegisterViewModel(): UseRegisterViewModelReturn {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    error: null,
  });

  const register = useCallback(async (data: RegisterData) => {
    // Validasyon
    if (data.password !== data.confirmPassword) {
      setState(prev => ({
        ...prev,
        error: 'Sifreler eslesmiyor',
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      
      // 1. Kullanıcı oluştur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) throw authError;

      // 2. Profil oluştur
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            full_name: data.fullName,
            role: 'student',
          });

        if (profileError) throw profileError;
      }

      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
      }));

      router.push('/login?registered=true');
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Kayit yapilamadi',
      }));
    }
  }, [router]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    register,
    clearError,
  };
}
