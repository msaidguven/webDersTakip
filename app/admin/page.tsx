'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient as createClient } from '../src/lib/supabaseClient';

// Dinamik rendering - SSR yerine client-side çalıştır
export const dynamic = 'force-dynamic';

// ==================== TYPES ====================

type TabType = 'dashboard' | 'content' | 'questions' | 'ai-rules' | 'bulk-ops';

interface Grade { id: number; name: string; order_no: number; is_active: boolean; }
interface Lesson { id: number; name: string; slug: string; icon?: string; is_active: boolean; }
interface Unit { id: number; lesson_id: number; title: string; slug: string; order_no: number; is_active: boolean; }
interface Topic { id: number; unit_id: number; title: string; slug: string; order_no: number; is_active: boolean; }

interface ContentHierarchy {
  grades: (Grade & { lessons: (Lesson & { units: (Unit & { topics: Topic[] })[] })[] })[];
}

interface AiRule {
  id: string;
  name: string;
  description: string;
  contentType: 'question' | 'topic_content' | 'unit_description' | 'lesson_intro';
  promptTemplate: string;
  variables: string[];
  isActive: boolean;
}

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

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Demo Banner - Mobil uyumlu */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-black px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-center">
        ⚠️ DEMO MOD
      </div>
      
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-7 left-0 right-0 z-40 bg-[#111114] border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <span className="font-bold text-white text-sm">Admin</span>
        </Link>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {sidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* Sidebar - Desktop: fixed, Mobile: overlay */}
      <aside className={`fixed lg:left-0 top-0 bottom-0 w-64 bg-[#111114] border-r border-white/5 z-40 transition-transform duration-300 ${
        sidebarOpen ? 'left-0' : '-left-64 lg:left-0'
      }`}>
        <div className="hidden lg:block p-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-lg font-bold text-white">A</span>
            </div>
            <div>
              <h1 className="font-bold text-white">Admin Panel</h1>
              <p className="text-xs text-gray-400">Ders Takip</p>
            </div>
          </Link>
        </div>

        <nav className="px-2 sm:px-4 pb-4 space-y-1 mt-16 lg:mt-0">
          <NavButton active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} icon="📊" label="Dashboard" />
          <NavButton active={activeTab === 'content'} onClick={() => { setActiveTab('content'); setSidebarOpen(false); }} icon="🗂️" label="İçerik" />
          <NavButton active={activeTab === 'questions'} onClick={() => { setActiveTab('questions'); setSidebarOpen(false); }} icon="❓" label="Sorular" />
          <NavButton active={activeTab === 'ai-rules'} onClick={() => { setActiveTab('ai-rules'); setSidebarOpen(false); }} icon="🤖" label="AI Kuralları" />
          <NavButton active={activeTab === 'bulk-ops'} onClick={() => { setActiveTab('bulk-ops'); setSidebarOpen(false); }} icon="⚡" label="Toplu İşlemler" />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <span>←</span> Siteye Dön
          </Link>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-20 lg:pt-10 px-4 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'content' && <ContentManagementTab />}
        {activeTab === 'questions' && <QuestionsTab />}
        {activeTab === 'ai-rules' && <AiRulesTab />}
        {activeTab === 'bulk-ops' && <BulkOperationsTab />}
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
          : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className="text-base sm:text-lg">{icon}</span>
      <span className="font-medium truncate">{label}</span>
    </button>
  );
}

// ==================== DASHBOARD ====================

function DashboardTab() {
  const [stats, setStats] = useState({
    grades: 0, lessons: 0, units: 0, topics: 0,
    questions: 0, users: 0, tests: 0, contents: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadRecentActivity();
  }, []);

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

    const activity = [
      ...(questions?.map(q => ({ type: 'question', title: q.question_text.substring(0, 50) + '...', date: q.created_at })) || []),
      ...(contents?.map(c => ({ type: 'content', title: c.title, date: c.created_at })) || []),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
    
    setRecentActivity(activity);
  }

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-sm sm:text-base text-gray-400">Platform genel durumu</p>
      </header>

      {/* Stats Grid - Mobil: 2 kolon, Desktop: 4 kolon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard title="Sınıflar" value={stats.grades} icon="🎓" color="from-blue-500 to-cyan-500" />
        <StatCard title="Dersler" value={stats.lessons} icon="📚" color="from-emerald-500 to-teal-500" />
        <StatCard title="Üniteler" value={stats.units} icon="📁" color="from-purple-500 to-pink-500" />
        <StatCard title="Konular" value={stats.topics} icon="📄" color="from-amber-500 to-orange-500" />
        <StatCard title="Sorular" value={stats.questions} icon="❓" color="from-red-500 to-rose-500" />
        <StatCard title="Kullanıcılar" value={stats.users} icon="👥" color="from-indigo-500 to-violet-500" />
        <StatCard title="Testler" value={stats.tests} icon="📝" color="from-cyan-500 to-sky-500" />
        <StatCard title="İçerikler" value={stats.contents} icon="📝" color="from-green-500 to-lime-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Activity */}
        <div className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/5 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Son Aktiviteler</h3>
          <div className="space-y-2 sm:space-y-3">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white/5">
                <span className="text-lg sm:text-xl">{item.type === 'question' ? '❓' : '📝'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs sm:text-sm truncate">{item.title}</p>
                  <p className="text-gray-500 text-xs">{new Date(item.date).toLocaleDateString('tr-TR')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/5 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Hızlı İşlemler</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <QuickActionButton icon="➕" label="Sınıf Ekle" onClick={() => {}} />
            <QuickActionButton icon="➕" label="Ders Ekle" onClick={() => {}} />
            <QuickActionButton icon="➕" label="Ünite Ekle" onClick={() => {}} />
            <QuickActionButton icon="➕" label="Konu Ekle" onClick={() => {}} />
            <QuickActionButton icon="❓" label="Soru Ekle" onClick={() => {}} />
            <QuickActionButton icon="🤖" label="AI Üret" onClick={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/5 p-3 sm:p-5 hover:border-white/10 transition-all">
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-base sm:text-lg mb-2 sm:mb-3`}>
        {icon}
      </div>
      <p className="text-xl sm:text-2xl font-bold text-white">{value.toLocaleString()}</p>
      <p className="text-gray-400 text-xs sm:text-sm">{title}</p>
    </div>
  );
}

function QuickActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left"
    >
      <span className="text-sm">{icon}</span>
      <span className="text-white text-xs sm:text-sm font-medium truncate">{label}</span>
    </button>
  );
}

// ==================== CONTENT MANAGEMENT ====================

function ContentManagementTab() {
  const [hierarchy, setHierarchy] = useState<ContentHierarchy>({ grades: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<{ type: string; id: number; data: any } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  useEffect(() => {
    loadHierarchy();
  }, []);

  async function loadHierarchy() {
    const supabase = createClient();
    
    const { data: grades } = await supabase
      .from('grades')
      .select('*')
      .eq('is_active', true)
      .order('order_no');

    const hierarchyData: ContentHierarchy['grades'] = [];

    for (const grade of grades || []) {
      const { data: lessonGrades } = await supabase
        .from('lesson_grades')
        .select('lesson_id')
        .eq('grade_id', grade.id)
        .eq('is_active', true);

      const lessonIds = lessonGrades?.map(lg => lg.lesson_id) || [];
      
      const { data: lessons } = lessonIds.length 
        ? await supabase.from('lessons').select('*').in('id', lessonIds).eq('is_active', true).order('order_no')
        : { data: [] };

      const lessonsWithUnits = [];
      for (const lesson of lessons || []) {
        const { data: units } = await supabase
          .from('units')
          .select('*')
          .eq('lesson_id', lesson.id)
          .eq('is_active', true)
          .order('order_no');

        const unitsWithTopics = [];
        for (const unit of units || []) {
          const { data: topics } = await supabase
            .from('topics')
            .select('*')
            .eq('unit_id', unit.id)
            .eq('is_active', true)
            .order('order_no');
          
          unitsWithTopics.push({ ...unit, topics: topics || [] });
        }
        
        lessonsWithUnits.push({ ...lesson, units: unitsWithTopics });
      }

      hierarchyData.push({ ...grade, lessons: lessonsWithUnits });
    }

    setHierarchy({ grades: hierarchyData });
    setLoading(false);
  }

  function toggleExpand(key: string) {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(key)) newExpanded.delete(key);
    else newExpanded.add(key);
    setExpanded(newExpanded);
  }

  function openCreateModal(type: string, parentId?: number) {
    setModalMode('create');
    setSelectedItem({ type, id: 0, data: { parentId } });
    setShowModal(true);
  }

  function openEditModal(type: string, item: any) {
    setModalMode('edit');
    setSelectedItem({ type, id: item.id, data: item });
    setShowModal(true);
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">İçerik Yönetimi</h2>
          <p className="text-sm sm:text-base text-gray-400">Sınıf → Ders → Ünite → Konu</p>
        </div>
        <button 
          onClick={() => openCreateModal('grade')}
          className="w-full sm:w-auto px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-all text-sm"
        >
          + Yeni Sınıf
        </button>
      </header>

      <div className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/5 p-3 sm:p-6 overflow-x-auto">
        <div className="space-y-1 sm:space-y-2 min-w-[300px]">
          {hierarchy.grades.map(grade => (
            <div key={grade.id}>
              <TreeItem 
                type="grade" 
                item={grade} 
                expanded={expanded.has(`grade-${grade.id}`)}
                onToggle={() => toggleExpand(`grade-${grade.id}`)}
                onEdit={() => openEditModal('grade', grade)}
                onAddChild={() => openCreateModal('lesson', grade.id)}
              />
              
              {expanded.has(`grade-${grade.id}`) && (
                <div className="ml-4 sm:ml-8 mt-1 sm:mt-2 space-y-1 sm:space-y-2">
                  {grade.lessons.map(lesson => (
                    <div key={lesson.id}>
                      <TreeItem 
                        type="lesson" 
                        item={lesson} 
                        expanded={expanded.has(`lesson-${lesson.id}`)}
                        onToggle={() => toggleExpand(`lesson-${lesson.id}`)}
                        onEdit={() => openEditModal('lesson', lesson)}
                        onAddChild={() => openCreateModal('unit', lesson.id)}
                      />
                      
                      {expanded.has(`lesson-${lesson.id}`) && (
                        <div className="ml-4 sm:ml-8 mt-1 sm:mt-2 space-y-1 sm:space-y-2">
                          {lesson.units.map(unit => (
                            <div key={unit.id}>
                              <TreeItem 
                                type="unit" 
                                item={unit} 
                                expanded={expanded.has(`unit-${unit.id}`)}
                                onToggle={() => toggleExpand(`unit-${unit.id}`)}
                                onEdit={() => openEditModal('unit', unit)}
                                onAddChild={() => openCreateModal('topic', unit.id)}
                              />
                              
                              {expanded.has(`unit-${unit.id}`) && (
                                <div className="ml-4 sm:ml-8 mt-1 sm:mt-2 space-y-1">
                                  {unit.topics.map(topic => (
                                    <TreeItem 
                                      key={topic.id}
                                      type="topic" 
                                      item={topic} 
                                      expanded={false}
                                      onToggle={() => {}}
                                      onEdit={() => openEditModal('topic', topic)}
                                    />
                                  ))}
                                  {unit.topics.length === 0 && (
                                    <EmptyState onAdd={() => openCreateModal('topic', unit.id)} />
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {lesson.units.length === 0 && (
                            <EmptyState onAdd={() => openCreateModal('unit', lesson.id)} />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {grade.lessons.length === 0 && (
                    <EmptyState onAdd={() => openCreateModal('lesson', grade.id)} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showModal && selectedItem && (
        <ContentModal 
          mode={modalMode}
          type={selectedItem.type}
          data={selectedItem.data}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); loadHierarchy(); }}
        />
      )}
    </div>
  );
}

function TreeItem({ type, item, expanded, onToggle, onEdit, onAddChild }: any) {
  const icons = { grade: '🎓', lesson: '📚', unit: '📁', topic: '📄' };
  const colors = { grade: 'bg-blue-500/20 text-blue-300', lesson: 'bg-emerald-500/20 text-emerald-300', unit: 'bg-purple-500/20 text-purple-300', topic: 'bg-gray-500/20 text-gray-300' };
  
  return (
    <div className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl ${colors[type as keyof typeof colors]} hover:bg-opacity-30 transition-all group text-sm sm:text-base`}>
      <button onClick={onToggle} className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
        {type !== 'topic' && (expanded ? '▼' : '▶')}
      </button>
      <span className="text-base sm:text-lg">{icons[type as keyof typeof icons]}</span>
      <span className="font-medium flex-1 truncate">{item.name || item.title}</span>
      <span className="text-xs opacity-60 hidden sm:inline">#{item.order_no}</span>
      <div className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 sm:gap-2">
        {onAddChild && type !== 'topic' && (
          <button onClick={onAddChild} className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs bg-white/20 rounded hover:bg-white/30">+ Ekle</button>
        )}
        <button onClick={onEdit} className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs bg-white/20 rounded hover:bg-white/30">Düzenle</button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="ml-4 sm:ml-8 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-dashed border-white/10 text-center">
      <p className="text-gray-500 text-xs sm:text-sm mb-1 sm:mb-2">Henüz içerik yok</p>
      <button onClick={onAdd} className="text-indigo-400 text-xs sm:text-sm hover:text-indigo-300">+ Yeni Ekle</button>
    </div>
  );
}

function ContentModal({ mode, type, data, onClose, onSave }: any) {
  const [formData, setFormData] = useState(data);
  const [saving, setSaving] = useState(false);

  const titles: Record<string, string> = {
    grade: 'Sınıf', lesson: 'Ders', unit: 'Ünite', topic: 'Konu'
  };

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    
    const tableMap: Record<string, string> = {
      grade: 'grades', lesson: 'lessons', unit: 'units', topic: 'topics'
    };
    
    const table = tableMap[type];
    
    if (mode === 'create') {
      await supabase.from(table).insert([formData]);
    } else {
      await supabase.from(table).update(formData).eq('id', data.id);
    }
    
    setSaving(false);
    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/10 w-full max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">
          {mode === 'create' ? 'Yeni' : 'Düzenle'} {titles[type]}
        </h3>
        
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-gray-400 text-xs sm:text-sm mb-1">İsim / Başlık</label>
            <input 
              type="text" 
              value={formData.name || formData.title || ''}
              onChange={e => setFormData({ ...formData, [type === 'grade' ? 'name' : 'title']: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-gray-400 text-xs sm:text-sm mb-1">Sıra No</label>
            <input 
              type="number" 
              value={formData.order_no || 0}
              onChange={e => setFormData({ ...formData, order_no: parseInt(e.target.value) })}
              className="w-full bg-black/50 border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          
          {type === 'lesson' && (
            <div>
              <label className="block text-gray-400 text-xs sm:text-sm mb-1">Icon (emoji)</label>
              <input 
                type="text" 
                value={formData.icon || ''}
                onChange={e => setFormData({ ...formData, icon: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-white text-sm focus:border-indigo-500 outline-none"
              />
            </div>
          )}
        </div>
        
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
          <button onClick={onClose} className="flex-1 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all text-sm">
            İptal
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex-1 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-all disabled:opacity-50 text-sm"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== QUESTIONS TAB (MOBILE CARDS) ====================

function QuestionsTab() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', difficulty: '' });

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    const supabase = createClient();
    const { data } = await supabase
      .from('questions')
      .select('*, question_types(code)')
      .order('created_at', { ascending: false })
      .limit(50);
    
    setQuestions(data || []);
    setLoading(false);
  }

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Soru Bankası</h2>
        <p className="text-sm sm:text-base text-gray-400">Tüm soruları görüntüle ve yönet</p>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6">
        <select 
          value={filter.type} 
          onChange={e => setFilter({ ...filter, type: e.target.value })}
          className="bg-[#111114] border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-white text-sm"
        >
          <option value="">Tüm Tipler</option>
          <option value="multiple_choice">Çoktan Seçmeli</option>
          <option value="true_false">Doğru/Yanlış</option>
          <option value="fill_blank">Boşluk Doldurma</option>
          <option value="matching">Eşleştirme</option>
          <option value="classical">Klasik</option>
        </select>
        
        <select 
          value={filter.difficulty} 
          onChange={e => setFilter({ ...filter, difficulty: e.target.value })}
          className="bg-[#111114] border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-white text-sm"
        >
          <option value="">Tüm Zorluklar</option>
          {[1,2,3,4,5].map(d => (
            <option key={d} value={d}>Zorluk {d}</option>
          ))}
        </select>

        <button className="w-full sm:w-auto sm:ml-auto px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg sm:rounded-xl font-medium text-sm">
          + Yeni Soru
        </button>
      </div>

      {/* Mobile Cards / Desktop Table */}
      <div className="space-y-3 sm:bg-[#111114] sm:rounded-xl sm:border sm:border-white/5 sm:overflow-hidden">
        {/* Desktop Table Header */}
        <div className="hidden sm:grid sm:grid-cols-5 sm:bg-white/5 sm:px-4 sm:py-3">
          <div className="text-gray-400 text-sm col-span-2">Soru</div>
          <div className="text-gray-400 text-sm">Tip</div>
          <div className="text-gray-400 text-sm">Zorluk</div>
          <div className="text-gray-400 text-sm">İşlem</div>
        </div>
        
        {/* Mobile Cards / Desktop Rows */}
        {questions.map(q => (
          <div key={q.id} className="sm:hidden bg-[#111114] rounded-xl border border-white/5 p-4">
            <p className="text-white text-sm mb-2 line-clamp-2">{q.question_text}</p>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs">{q.question_types?.code}</span>
              <DifficultyBadge level={q.difficulty} />
            </div>
          </div>
        ))}
        
        {/* Desktop Table Rows */}
        <div className="hidden sm:block divide-y divide-white/5">
          {questions.map(q => (
            <div key={q.id} className="grid grid-cols-5 px-4 py-3 hover:bg-white/5 items-center">
              <div className="text-white text-sm col-span-2 truncate">{q.question_text}</div>
              <div className="text-gray-400 text-sm">{q.question_types?.code}</div>
              <div><DifficultyBadge level={q.difficulty} /></div>
              <button className="text-indigo-400 hover:text-indigo-300 text-sm">Düzenle</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DifficultyBadge({ level }: { level: number }) {
  const colors = ['bg-green-500/20 text-green-300', 'bg-emerald-500/20 text-emerald-300', 'bg-yellow-500/20 text-yellow-300', 'bg-orange-500/20 text-orange-300', 'bg-red-500/20 text-red-300'];
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${colors[level - 1]}`}>
      {level}
    </span>
  );
}

// ==================== AI RULES TAB (MOBILE) ====================

function AiRulesTab() {
  const [rules] = useState<AiRule[]>([
    {
      id: '1',
      name: 'Çoktan Seçmeli Soru',
      description: 'Konuya uygun 4 seçenekli sorular üretir',
      contentType: 'question',
      promptTemplate: `Konu: {{topicTitle}}\nÜnite: {{unitTitle}}\n\n{{count}} adet çoktan seçmeli soru üret.`,
      variables: ['topicTitle', 'unitTitle', 'count'],
      isActive: true
    },
    {
      id: '2',
      name: 'Konu Anlatımı',
      description: 'Konu için detaylı anlatım metni oluşturur',
      contentType: 'topic_content',
      promptTemplate: `Konu: {{topicTitle}}\n\nÖğrencilerin anlayacağı şekilde anlatım yaz.`,
      variables: ['topicTitle'],
      isActive: true
    },
  ]);

  const [selectedRule, setSelectedRule] = useState<AiRule | null>(null);

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">AI Kuralları</h2>
          <p className="text-sm sm:text-base text-gray-400">Prompt şablonları</p>
        </div>
        <button className="w-full sm:w-auto px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg sm:rounded-xl font-medium text-sm">
          + Yeni Kural
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Rules List */}
        <div className="space-y-2 sm:space-y-3">
          {rules.map(rule => (
            <button
              key={rule.id}
              onClick={() => setSelectedRule(rule)}
              className={`w-full text-left p-3 sm:p-4 rounded-xl border transition-all ${
                selectedRule?.id === rule.id 
                  ? 'bg-indigo-500/20 border-indigo-500/50' 
                  : 'bg-[#111114] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="font-medium text-white text-sm sm:text-base truncate">{rule.name}</span>
              </div>
              <p className="text-gray-400 text-xs sm:text-sm truncate">{rule.description}</p>
            </button>
          ))}
        </div>

        {/* Rule Editor */}
        <div className="lg:col-span-2">
          {selectedRule ? (
            <div className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/5 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-white">{selectedRule.name}</h3>
                <label className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs sm:text-sm">Aktif</span>
                  <input type="checkbox" checked={selectedRule.isActive} className="w-4 h-4" />
                </label>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">Prompt Şablonu</label>
                  <textarea 
                    value={selectedRule.promptTemplate}
                    rows={8}
                    className="w-full bg-black/50 border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white text-xs sm:text-sm font-mono resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  {selectedRule.variables.map(v => (
                    <code key={v} className="px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs">
                      {'{{'}{v}{'}}'}
                    </code>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button className="flex-1 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-white/5 text-white hover:bg-white/10 text-sm">
                  Kopyala
                </button>
                <button className="flex-1 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 text-sm">
                  Kaydet
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/5 p-8 sm:p-12 text-center">
              <p className="text-gray-400 text-sm">Detayları görmek için bir kural seçin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== BULK OPERATIONS (MOBILE) ====================

function BulkOperationsTab() {
  const [operations] = useState([
    { id: 'generate-questions', name: 'Soru Üret', description: 'Toplu soru üretimi', icon: '❓', color: 'from-blue-500 to-cyan-500' },
    { id: 'generate-content', name: 'İçerik Üret', description: 'Anlatım metinleri üret', icon: '📝', color: 'from-emerald-500 to-teal-500' },
    { id: 'validate-links', name: 'Link Kontrolü', description: 'Linkleri kontrol et', icon: '🔗', color: 'from-purple-500 to-pink-500' },
    { id: 'sync-counts', name: 'Senkronize Et', description: 'Soru sayılarını yeniden hesapla', icon: '🔄', color: 'from-amber-500 to-orange-500' },
    { id: 'export-data', name: 'Dışa Aktar', description: 'JSON olarak dışa aktar', icon: '⬇️', color: 'from-indigo-500 to-violet-500' },
    { id: 'import-data', name: 'İçe Aktar', description: 'JSON dosyasından aktar', icon: '⬆️', color: 'from-green-500 to-lime-500' },
  ]);

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Toplu İşlemler</h2>
        <p className="text-sm sm:text-base text-gray-400">AI destekli toplu operasyonlar</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {operations.map(op => (
          <button
            key={op.id}
            className="text-left p-4 sm:p-6 rounded-xl bg-[#111114] border border-white/5 hover:border-white/10 transition-all group"
          >
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${op.color} flex items-center justify-center text-xl sm:text-2xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
              {op.icon}
            </div>
            <h3 className="font-semibold text-white text-sm sm:text-base mb-1">{op.name}</h3>
            <p className="text-gray-400 text-xs sm:text-sm">{op.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== LOADING ====================

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 text-sm">Yükleniyor...</span>
      </div>
    </div>
  );
}
