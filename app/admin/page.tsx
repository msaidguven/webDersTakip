'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'contents'>('overview');
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalUsers: 0,
    totalTests: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      router.push('/');
      return;
    }

    // Load stats
    const [
      { count: questionCount },
      { count: userCount },
      { count: testCount }
    ] = await Promise.all([
      supabase.from('questions').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('test_sessions').select('*', { count: 'exact', head: true })
    ]);

    setStats({
      totalQuestions: questionCount || 0,
      totalUsers: userCount || 0,
      totalTests: testCount || 0
    });
    setLoading(false);
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
            <span className="text-xl font-bold text-white">Admin Panel</span>
          </Link>
          <Link href="/" className="text-zinc-400 hover:text-white">
            Siteye Dön →
          </Link>
        </div>
      </nav>

      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              title="Toplam Soru"
              value={stats.totalQuestions}
              icon="❓"
              color="from-blue-500 to-cyan-500"
            />
            <StatCard
              title="Toplam Kullanıcı"
              value={stats.totalUsers}
              icon="👥"
              color="from-emerald-500 to-teal-500"
            />
            <StatCard
              title="Çözülen Test"
              value={stats.totalTests}
              icon="📝"
              color="from-amber-500 to-orange-500"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8">
            {[
              { id: 'overview', label: '📊 Genel Bakış' },
              { id: 'questions', label: '❓ Sorular' },
              { id: 'contents', label: '📚 İçerikler' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-500 text-white'
                    : 'bg-zinc-900/50 text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'questions' && <QuestionsTab />}
          {activeTab === 'contents' && <ContentsTab />}
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-xl mb-4`}>
        {icon}
      </div>
      <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
      <p className="text-zinc-500">{title}</p>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Hızlı İşlemler</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Yeni Soru Ekle', href: '/admin/questions/new', color: 'from-blue-500 to-cyan-500' },
          { label: 'Yeni İçerik Ekle', href: '/admin/contents/new', color: 'from-emerald-500 to-teal-500' },
          { label: 'Kullanıcıları Gör', href: '/admin/users', color: 'from-purple-500 to-pink-500' },
          { label: 'Raporlar', href: '/admin/reports', color: 'from-amber-500 to-orange-500' }
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`p-4 rounded-xl bg-gradient-to-r ${item.color} text-white font-medium hover:shadow-lg transition-all`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function QuestionsTab() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await supabase
      .from('questions')
      .select('id, question_text, difficulty, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    
    setQuestions(data || []);
    setLoading(false);
  }

  if (loading) return <div className="text-zinc-400">Yükleniyor...</div>;

  return (
    <div className="rounded-2xl bg-zinc-900/50 border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Son Sorular</h2>
        <Link
          href="/admin/questions/new"
          className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm hover:bg-indigo-600"
        >
          + Yeni Soru
        </Link>
      </div>
      
      <div className="divide-y divide-white/5">
        {questions.map((q) => (
          <div key={q.id} className="p-4 flex items-center justify-between hover:bg-white/5">
            <div className="flex-1">
              <p className="text-white truncate">{q.question_text}</p>
              <p className="text-zinc-500 text-sm">Zorluk: {q.difficulty}</p>
            </div>
            <Link
              href={`/admin/questions/${q.id}`}
              className="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-400 text-sm hover:text-white"
            >
              Düzenle
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContentsTab() {
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContents();
  }, []);

  async function loadContents() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await supabase
      .from('topic_contents')
      .select('id, title, created_at, topics(title)')
      .order('created_at', { ascending: false })
      .limit(20);
    
    setContents(data || []);
    setLoading(false);
  }

  if (loading) return <div className="text-zinc-400">Yükleniyor...</div>;

  return (
    <div className="rounded-2xl bg-zinc-900/50 border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Son İçerikler</h2>
        <Link
          href="/admin/contents/new"
          className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm hover:bg-emerald-600"
        >
          + Yeni İçerik
        </Link>
      </div>
      
      <div className="divide-y divide-white/5">
        {contents.map((c) => (
          <div key={c.id} className="p-4 flex items-center justify-between hover:bg-white/5">
            <div className="flex-1">
              <p className="text-white">{c.title}</p>
              <p className="text-zinc-500 text-sm">{c.topics?.title}</p>
            </div>
            <Link
              href={`/admin/contents/${c.id}`}
              className="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-400 text-sm hover:text-white"
            >
              Düzenle
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
