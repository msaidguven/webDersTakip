'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { RegisterData, AuthState } from '../models/authTypes';

export interface RegisterGradeOption {
  id: number;
  name: string;
  orderNo: number;
}

interface UseRegisterViewModelReturn {
  state: AuthState;
  grades: RegisterGradeOption[];
  isLoadingGrades: boolean;
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
  const [grades, setGrades] = useState<RegisterGradeOption[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);

  // Kayıt formundaki "Kaçıncı sınıftasın?" seçimi için aktif sınıflar — ana sayfadaki
  // (useHomeViewModel) sınıf seçimiyle aynı kaynak: web_get_active_grades RPC'si.
  useEffect(() => {
    async function fetchGrades() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc('web_get_active_grades');
        if (error) throw error;

        const options: RegisterGradeOption[] = (data || [])
          .map((item: { id: number; name: string; order_no: number }) => ({
            id: item.id,
            name: item.name,
            orderNo: item.order_no,
          }))
          .sort((a: RegisterGradeOption, b: RegisterGradeOption) => a.orderNo - b.orderNo);

        setGrades(options);
      } finally {
        setIsLoadingGrades(false);
      }
    }

    fetchGrades();
  }, []);

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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Kayit yapilamadi');

      // Kayıt sırasında oluşturulan oturum çerezi bu fetch ile geldi ama tarayıcıdaki
      // Supabase client'ı bunu kendiliğinden bilmez — getSession() çerezleri yeniden
      // okuyup onAuthStateChange üzerinden AuthContext'i (dolayısıyla useAuth) günceller.
      await createClient().auth.getSession();

      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
      }));

      router.push('/login?registered=true');
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Kayit yapilamadi',
      }));
    }
  }, [router]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    grades,
    isLoadingGrades,
    register,
    clearError,
  };
}
