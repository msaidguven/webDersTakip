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

export interface RegisterLessonOption {
  id: number;
  name: string;
}

interface UseRegisterViewModelReturn {
  state: AuthState;
  grades: RegisterGradeOption[];
  isLoadingGrades: boolean;
  lessons: RegisterLessonOption[];
  isLoadingLessons: boolean;
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
  const [lessons, setLessons] = useState<RegisterLessonOption[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(true);

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

  // Öğretmen seçilirse "hangi branş(lar)da ders veriyorsun" çoklu-seçimi için — eski
  // /ogretmen/kayit sayfasıyla AYNI kaynak (lessons tablosu, aktif olanlar).
  useEffect(() => {
    async function fetchLessons() {
      try {
        const supabase = createClient();
        const { data } = await supabase.from('lessons').select('id, name').eq('is_active', true).order('name', { ascending: true });
        setLessons((data as RegisterLessonOption[] | null) || []);
      } finally {
        setIsLoadingLessons(false);
      }
    }

    fetchLessons();
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

      // bkz. useLoginViewModel — getSession() değil setSession() gerekiyor, aksi halde
      // sayfa yenilenene kadar "giriş yapılmamış" görünüyor. E-posta onayı gerekiyorsa
      // sunucu session döndürmez (result.session null), o zaman burada bekleyen bir şey
      // yok — kullanıcı /login'e yönlendirilip normal şekilde giriş yapar.
      if (result.session) {
        await createClient().auth.setSession(result.session);
      }

      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
      }));

      // Öğretmen kaydı onay bekler (is_verified:false) — öğrenciden farklı bir mesaj
      // gösterilsin diye (eski /ogretmen/kayit sayfasındaki AYNI "registered=teacher" bilgisi).
      router.push(result.role === 'teacher' ? '/login?registered=teacher' : '/login?registered=true');
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
    lessons,
    isLoadingLessons,
    register,
    clearError,
  };
}
