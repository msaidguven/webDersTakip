'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { type EntityKey } from '@/app/src/components/admin/ManagementTab';
import ManagementShell from '@/app/src/components/admin/ManagementShell';
import MembersTab from '@/app/src/components/admin/MembersTab';
import SchoolsSyncPanel from '@/app/src/components/admin/SchoolsSyncPanel';
import CodeCleanupPanel from '@/app/src/components/admin/CodeCleanupPanel';
import AdminThemeToggle from '@/app/src/components/admin/AdminThemeToggle';

// Dinamik rendering - SSR yerine client-side çalıştır
export const dynamic = 'force-dynamic';

// ==================== TYPES ====================

type TabType = 'dashboard' | 'manage' | 'members' | 'schools' | 'code-cleanup';

// ==================== MAIN COMPONENT ====================

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <LoadingScreen />;
  }

  function goToManage(_entity: EntityKey) {
    setActiveTab('manage');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <span className="font-bold text-foreground text-sm">Admin</span>
        </Link>
        <div className="flex items-center gap-2">
          <AdminThemeToggle />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-foreground"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Sidebar - Desktop: fixed, Mobile: overlay */}
      <aside className={`fixed lg:left-0 top-0 bottom-0 w-64 bg-card border-r border-border z-40 transition-transform duration-300 flex flex-col ${
        sidebarOpen ? 'left-0' : '-left-64 lg:left-0'
      }`}>
        <div className="hidden lg:flex p-6 shrink-0 items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-white">A</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-foreground truncate">Admin Panel</h1>
              <p className="text-xs text-muted-foreground truncate">Ders Takip</p>
            </div>
          </Link>
          <AdminThemeToggle />
        </div>

        <nav className="px-2 sm:px-4 pb-4 space-y-1 mt-16 lg:mt-0 flex-1 overflow-y-auto">
          <NavButton active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} icon="📊" label="Dashboard" />
          <NavButton active={activeTab === 'manage'} onClick={() => { setActiveTab('manage'); setSidebarOpen(false); }} icon="🛠️" label="Yönetim" />
          <NavButton active={activeTab === 'members'} onClick={() => { setActiveTab('members'); setSidebarOpen(false); }} icon="👥" label="Üyeler" />
          <NavButton active={activeTab === 'schools'} onClick={() => { setActiveTab('schools'); setSidebarOpen(false); }} icon="🏫" label="Okullar" />
          <NavButton active={activeTab === 'code-cleanup'} onClick={() => { setActiveTab('code-cleanup'); setSidebarOpen(false); }} icon="🧹" label="Kod Temizliği" />
          <Link
            href="/admin/arama"
            className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-left transition-all text-sm sm:text-base text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="text-base sm:text-lg">🔎</span>
            <span className="font-medium truncate">Arama</span>
          </Link>
          <Link
            href="/admin/icerik-kontrol"
            className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-left transition-all text-sm sm:text-base text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="text-base sm:text-lg">🔍</span>
            <span className="font-medium truncate">İçerik Kontrol</span>
          </Link>
          <Link
            href="/admin/yayin-yonetimi"
            className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-left transition-all text-sm sm:text-base text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="text-base sm:text-lg">🚀</span>
            <span className="font-medium truncate">Yayın Yönetimi</span>
          </Link>
          <Link
            href="/admin/yillik-plan"
            className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-left transition-all text-sm sm:text-base text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="text-base sm:text-lg">📅</span>
            <span className="font-medium truncate">Yıllık Plan Yükleme</span>
          </Link>
          <Link
            href="/admin/takvim"
            className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-left transition-all text-sm sm:text-base text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="text-base sm:text-lg">🗓️</span>
            <span className="font-medium truncate">Akademik Takvim</span>
          </Link>
          <Link
            href="/admin/ders-notu-rag"
            className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-left transition-all text-sm sm:text-base text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="text-base sm:text-lg">🤖</span>
            <span className="font-medium truncate">Ders Notu Soru-Cevap</span>
          </Link>
          <Link
            href="/admin/tum-yorumlar"
            className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-left transition-all text-sm sm:text-base text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="text-base sm:text-lg">🗂️</span>
            <span className="font-medium truncate">Tüm Yorumlar ve Sorular</span>
          </Link>
          <Link
            href="/admin/svg-sorulari"
            className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-left transition-all text-sm sm:text-base text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="text-base sm:text-lg">📐</span>
            <span className="font-medium truncate">SVG Soruları</span>
          </Link>
        </nav>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-10 px-4 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && <DashboardTab onGoManage={goToManage} onGoMembers={() => setActiveTab('members')} onGoSchools={() => setActiveTab('schools')} />}
        {activeTab === 'manage' && <ManagementShell />}
        {activeTab === 'members' && <MembersTab />}
        {activeTab === 'schools' && <SchoolsSyncPanel />}
        {activeTab === 'code-cleanup' && <CodeCleanupPanel />}
      </main>
    </div>
  );
}

// ==================== NAVIGATION ====================

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-left transition-all text-sm sm:text-base ${
        active
          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <span className="text-base sm:text-lg">{icon}</span>
      <span className="font-medium truncate">{label}</span>
    </button>
  );
}

// ==================== DASHBOARD ====================

type RecentActivityItem = { type: 'question' | 'content'; title: string; date: string };

function DashboardTab({ onGoManage, onGoMembers, onGoSchools }: { onGoManage: (entity: EntityKey) => void; onGoMembers: () => void; onGoSchools: () => void }) {
  const [stats, setStats] = useState({
    grades: 0, lessons: 0, units: 0, topics: 0,
    questions: 0, users: 0, tests: 0, contents: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);

  useEffect(() => {
    async function loadStats() {
      const supabase = createClient();
      const [
        { count: grades }, { count: lessons }, { count: units }, { count: topics },
        { count: questions }, { count: users }, { count: tests }, { count: contents }
      ] = await Promise.all([
        supabase.from('grades').select('*', { count: 'exact', head: true }),
        supabase.from('lessons').select('*', { count: 'exact', head: true }),
        supabase.from('units').select('*', { count: 'exact', head: true }),
        supabase.from('topics').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('test_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('topic_contents').select('*', { count: 'exact', head: true }),
      ]);

      setStats({ grades: grades||0, lessons: lessons||0, units: units||0, topics: topics||0,
                 questions: questions||0, users: users||0, tests: tests||0, contents: contents||0 });
    }

    async function loadRecentActivity() {
      const supabase = createClient();
      const { data: questions } = await supabase
        .from('questions')
        .select('id, question_text, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: contents } = await supabase
        .from('topic_contents')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const activity: RecentActivityItem[] = [
        ...(questions?.map(q => ({ type: 'question' as const, title: q.question_text.substring(0, 50) + '...', date: q.created_at })) || []),
        ...(contents?.map(c => ({ type: 'content' as const, title: c.title, date: c.created_at })) || []),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

      setRecentActivity(activity);
    }

    loadStats();
    loadRecentActivity();
  }, []);

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Platform genel durumu</p>
      </header>

      {/* Stats Grid - Mobil: 2 kolon, Desktop: 4 kolon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard title="Sınıflar" value={stats.grades} icon="🎓" color="from-blue-500 to-cyan-500" />
        <StatCard title="Dersler" value={stats.lessons} icon="📚" color="from-emerald-500 to-teal-500" />
        <StatCard title="Üniteler" value={stats.units} icon="📁" color="from-purple-500 to-pink-500" onClick={() => onGoManage('units')} />
        <StatCard title="Konular" value={stats.topics} icon="📄" color="from-amber-500 to-orange-500" onClick={() => onGoManage('topics')} />
        <StatCard title="Sorular" value={stats.questions} icon="❓" color="from-red-500 to-rose-500" onClick={() => onGoManage('questions')} />
        <StatCard title="Kullanıcılar" value={stats.users} icon="👥" color="from-indigo-500 to-violet-500" onClick={onGoMembers} />
        <StatCard title="Testler" value={stats.tests} icon="📝" color="from-cyan-500 to-sky-500" />
        <StatCard title="İçerikler" value={stats.contents} icon="📝" color="from-green-500 to-lime-500" onClick={() => onGoManage('contents')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Activity */}
        <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Son Aktiviteler</h3>
          <div className="space-y-2 sm:space-y-3">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-accent">
                <span className="text-lg sm:text-xl">{item.type === 'question' ? '❓' : '📝'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs sm:text-sm truncate">{item.title}</p>
                  <p className="text-muted-foreground text-xs">{new Date(item.date).toLocaleDateString('tr-TR')}</p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && <p className="text-muted-foreground text-sm">Henüz aktivite yok</p>}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Hızlı İşlemler</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <QuickActionButton icon="📁" label="Üniteler" onClick={() => onGoManage('units')} />
            <QuickActionButton icon="📄" label="Konular" onClick={() => onGoManage('topics')} />
            <QuickActionButton icon="🧩" label="Alt Başlıklar" onClick={() => onGoManage('sections')} />
            <QuickActionButton icon="📝" label="İçerikler" onClick={() => onGoManage('contents')} />
            <QuickActionButton icon="🎯" label="Kazanımlar" onClick={() => onGoManage('outcomes')} />
            <QuickActionButton icon="❓" label="Sorular" onClick={() => onGoManage('questions')} />
            <Link href="/admin/arama" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-accent hover:bg-accent/70 transition-all text-left">
              <span className="text-sm">🔎</span>
              <span className="text-foreground text-xs sm:text-sm font-medium truncate">Arama</span>
            </Link>
            <Link href="/admin/icerik-kontrol" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-accent hover:bg-accent/70 transition-all text-left">
              <span className="text-sm">🔍</span>
              <span className="text-foreground text-xs sm:text-sm font-medium truncate">İçerik Kontrol</span>
            </Link>
            <Link href="/admin/svg-sorulari" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-accent hover:bg-accent/70 transition-all text-left">
              <span className="text-sm">📐</span>
              <span className="text-foreground text-xs sm:text-sm font-medium truncate">SVG Soruları</span>
            </Link>
            <QuickActionButton icon="👥" label="Üyeler" onClick={onGoMembers} />
            <QuickActionButton icon="🏫" label="Okullar" onClick={onGoSchools} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, onClick }: { title: string; value: number; icon: string; color: string; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`w-full text-left bg-card rounded-xl sm:rounded-2xl border border-border p-3 sm:p-5 hover:border-muted-foreground/30 transition-all ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-base sm:text-lg mb-2 sm:mb-3`}>
        {icon}
      </div>
      <p className="text-xl sm:text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
      <p className="text-muted-foreground text-xs sm:text-sm">{title}</p>
    </Comp>
  );
}

function QuickActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-accent hover:bg-accent/70 transition-all text-left"
    >
      <span className="text-sm">{icon}</span>
      <span className="text-foreground text-xs sm:text-sm font-medium truncate">{label}</span>
    </button>
  );
}

// ==================== LOADING ====================

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-muted-foreground text-sm">Yükleniyor...</span>
      </div>
    </div>
  );
}
