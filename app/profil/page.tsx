'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  grade_id: number | null;
  school_name: string | null;
  city_id: number | null;
}

interface Grade {
  id: number;
  name: string;
}

interface City {
  id: number;
  name: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [cityId, setCityId] = useState('');

  useEffect(() => {
    loadProfile();
    loadGrades();
    loadCities();
  }, []);

  async function loadProfile() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile(data);
      setFullName(data.full_name || '');
      setUsername(data.username || '');
      setSchoolName(data.school_name || '');
      setGradeId(data.grade_id?.toString() || '');
      setCityId(data.city_id?.toString() || '');
    }
    setLoading(false);
  }

  async function loadGrades() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await supabase
      .from('grades')
      .select('id, name')
      .eq('is_active', true)
      .order('order_no');
    setGrades(data || []);
  }

  async function loadCities() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await supabase
      .from('cities')
      .select('id, name')
      .order('name');
    setCities(data || []);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Oturum bulunamadı');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          username: username || null,
          school_name: schoolName || null,
          grade_id: gradeId ? parseInt(gradeId) : null,
          city_id: cityId ? parseInt(cityId) : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      setMessage('Profil güncellendi!');
    } catch (err: any) {
      setMessage('Hata: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f11]">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-xl font-bold text-white">E</span>
            </div>
            <span className="text-xl font-bold text-white">Ders Takip</span>
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      </nav>

      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6 sm:p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-3xl">
                {fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{fullName}</h1>
                <p className="text-zinc-500">@{username || 'kullanıcı'}</p>
              </div>
            </div>

            {message && (
              <div className={`mb-6 p-4 rounded-xl ${message.includes('Hata') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {message}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Ad Soyad</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Kullanıcı Adı</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="@kullaniciadi"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Sınıf</label>
                <select
                  value={gradeId}
                  onChange={(e) => setGradeId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sınıf Seç</option>
                  {grades.map((grade) => (
                    <option key={grade.id} value={grade.id}>{grade.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Okul</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Okul adı"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Şehir</label>
                <select
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Şehir Seç</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <Link
                  href="/"
                  className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-medium text-center hover:bg-zinc-700 transition-colors"
                >
                  İptal
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
