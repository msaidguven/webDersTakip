// app/src/context/AuthContext.tsx

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  supabase: SupabaseClient;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  const clearSession = async () => {
    // Local storage'daki token'ları temizle
    if (typeof window !== 'undefined') {
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('supabase.auth.refreshToken');
    }
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      // Refresh token hatası kontrolü
      if (error) {
        console.error('Session hatası:', error);

        // Refresh token hatası varsa oturumu temizle
        if (error.message?.includes('Refresh Token') ||
          error.message?.includes('Invalid Refresh Token')) {
          await clearSession();
          setLoading(false);
          return;
        }
      }

      setUser(session?.user || null);
    } catch (error) {
      console.error('Refresh user hatası:', error);
      // Beklenmeyen hata durumunda da temizle
      await clearSession();
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      await clearSession();
    } catch (error) {
      console.error('Sign out hatası:', error);
      // Hata olsa bile localStorage'ı temizle
      await clearSession();
    }
  };

  useEffect(() => {
    // İlk yüklemede session kontrolü
    refreshUser();

    // Auth state değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);

        // Token yenileme başarısız olduysa
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token başarıyla yenilendi');
          setUser(session?.user || null);
          setLoading(false);
          return;
        }

        // Oturum sonlandıysa veya refresh token hatası varsa
        if (event === 'SIGNED_OUT') {
          await clearSession();
          setLoading(false);
          return;
        }

        // Kullanıcı silinirse (manuel kontrol)
        if (session?.user === null && event !== 'INITIAL_SESSION') {
          await clearSession();
          setLoading(false);
          return;
        }

        // Normal durumlar
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        supabase,
        signOut,
        refreshUser,
        clearSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}