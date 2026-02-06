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
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Demo Banner */}
      <div className="fixed top-0 left-64 right-0 z-50 bg-amber-500/90 text-black px-4 py-2 text-sm font-medium text-center">
        ⚠️ DEMO MOD - Giriş yapmadan admin paneli görüntüleniyor
      </div>
      
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#111114] border-r border-white/5 z-40">
        <div className="p-6">
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

        <nav className="px-4 pb-4 space-y-1">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon="📊" label="Dashboard" />
          <NavButton active={activeTab === 'content'} onClick={() => setActiveTab('content')} icon="🗂️" label="İçerik Yönetimi" />
          <NavButton active={activeTab === 'questions'} onClick={() => setActiveTab('questions')} icon="❓" label="Soru Bankası" />
          <NavButton active={activeTab === 'ai-rules'} onClick={() => setActiveTab('ai-rules')} icon="🤖" label="AI Kuralları" />
          <NavButton active={activeTab === 'bulk-ops'} onClick={() => setActiveTab('bulk-ops')} icon="⚡" label="Toplu İşlemler" />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <span>←</span> Siteye Dön
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 min-h-screen pt-10">
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
        active 
          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
          : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="font-medium">{label}</span>
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
    <div className="p-8">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400">Platform genel durumu</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Sınıflar" value={stats.grades} icon="🎓" color="from-blue-500 to-cyan-500" />
        <StatCard title="Dersler" value={stats.lessons} icon="📚" color="from-emerald-500 to-teal-500" />
        <StatCard title="Üniteler" value={stats.units} icon="📁" color="from-purple-500 to-pink-500" />
        <StatCard title="Konular" value={stats.topics} icon="📄" color="from-amber-500 to-orange-500" />
        <StatCard title="Sorular" value={stats.questions} icon="❓" color="from-red-500 to-rose-500" />
        <StatCard title="Kullanıcılar" value={stats.users} icon="👥" color="from-indigo-500 to-violet-500" />
        <StatCard title="Testler" value={stats.tests} icon="📝" color="from-cyan-500 to-sky-500" />
        <StatCard title="İçerikler" value={stats.contents} icon="📝" color="from-green-500 to-lime-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-[#111114] rounded-2xl border border-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Son Aktiviteler</h3>
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <span className="text-xl">{item.type === 'question' ? '❓' : '📝'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{item.title}</p>
                  <p className="text-gray-500 text-xs">{new Date(item.date).toLocaleString('tr-TR')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#111114] rounded-2xl border border-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Hızlı İşlemler</h3>
          <div className="grid grid-cols-2 gap-3">
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
    <div className="bg-[#111114] rounded-2xl border border-white/5 p-5 hover:border-white/10 transition-all">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-lg mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
      <p className="text-gray-400 text-sm">{title}</p>
    </div>
  );
}

function QuickActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left"
    >
      <span>{icon}</span>
      <span className="text-white text-sm font-medium">{label}</span>
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
    
    // Load grades
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
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">İçerik Yönetimi</h2>
          <p className="text-gray-400">Sınıf → Ders → Ünite → Konu hiyerarşisi</p>
        </div>
        <button 
          onClick={() => openCreateModal('grade')}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-all"
        >
          + Yeni Sınıf
        </button>
      </header>

      {/* Hierarchy Tree */}
      <div className="bg-[#111114] rounded-2xl border border-white/5 p-6">
        <div className="space-y-2">
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
                <div className="ml-8 mt-2 space-y-2">
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
                        <div className="ml-8 mt-2 space-y-2">
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
                                <div className="ml-8 mt-2 space-y-2">
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

      {/* Create/Edit Modal */}
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
    <div className={`flex items-center gap-3 p-3 rounded-xl ${colors[type as keyof typeof colors]} hover:bg-opacity-30 transition-all group`}>
      <button onClick={onToggle} className="w-6 h-6 flex items-center justify-center">
        {type !== 'topic' && (expanded ? '▼' : '▶')}
      </button>
      <span className="text-lg">{icons[type as keyof typeof icons]}</span>
      <span className="font-medium flex-1">{item.name || item.title}</span>
      <span className="text-xs opacity-60">#{item.order_no}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        {onAddChild && type !== 'topic' && (
          <button onClick={onAddChild} className="px-2 py-1 text-xs bg-white/20 rounded hover:bg-white/30">+ Ekle</button>
        )}
        <button onClick={onEdit} className="px-2 py-1 text-xs bg-white/20 rounded hover:bg-white/30">Düzenle</button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="ml-8 p-4 rounded-xl border border-dashed border-white/10 text-center">
      <p className="text-gray-500 text-sm mb-2">Henüz içerik yok</p>
      <button onClick={onAdd} className="text-indigo-400 text-sm hover:text-indigo-300">+ Yeni Ekle</button>
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
      <div className="bg-[#111114] rounded-2xl border border-white/10 w-full max-w-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">
          {mode === 'create' ? 'Yeni' : 'Düzenle'} {titles[type]}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">İsim / Başlık</label>
            <input 
              type="text" 
              value={formData.name || formData.title || ''}
              onChange={e => setFormData({ ...formData, [type === 'grade' ? 'name' : 'title']: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-indigo-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-gray-400 text-sm mb-1">Sıra No</label>
            <input 
              type="number" 
              value={formData.order_no || 0}
              onChange={e => setFormData({ ...formData, order_no: parseInt(e.target.value) })}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-indigo-500 outline-none"
            />
          </div>
          
          {type === 'lesson' && (
            <div>
              <label className="block text-gray-400 text-sm mb-1">Icon (emoji)</label>
              <input 
                type="text" 
                value={formData.icon || ''}
                onChange={e => setFormData({ ...formData, icon: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-indigo-500 outline-none"
              />
            </div>
          )}
        </div>
        
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all">
            İptal
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-all disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== QUESTIONS TAB ====================

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
    <div className="p-8">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-white">Soru Bankası</h2>
        <p className="text-gray-400">Tüm soruları görüntüle ve yönet</p>
      </header>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select 
          value={filter.type} 
          onChange={e => setFilter({ ...filter, type: e.target.value })}
          className="bg-[#111114] border border-white/10 rounded-xl px-4 py-2 text-white"
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
          className="bg-[#111114] border border-white/10 rounded-xl px-4 py-2 text-white"
        >
          <option value="">Tüm Zorluklar</option>
          {[1,2,3,4,5].map(d => (
            <option key={d} value={d}>Zorluk {d}</option>
          ))}
        </select>

        <button className="ml-auto px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium">
          + Yeni Soru
        </button>
      </div>

      {/* Questions List */}
      <div className="bg-[#111114] rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left text-gray-400 font-medium p-4">Soru</th>
              <th className="text-left text-gray-400 font-medium p-4">Tip</th>
              <th className="text-left text-gray-400 font-medium p-4">Zorluk</th>
              <th className="text-left text-gray-400 font-medium p-4">Tarih</th>
              <th className="text-left text-gray-400 font-medium p-4">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {questions.map(q => (
              <tr key={q.id} className="hover:bg-white/5">
                <td className="p-4 text-white max-w-md">
                  <p className="truncate">{q.question_text}</p>
                </td>
                <td className="p-4 text-gray-400">{q.question_types?.code}</td>
                <td className="p-4">
                  <DifficultyBadge level={q.difficulty} />
                </td>
                <td className="p-4 text-gray-400 text-sm">{new Date(q.created_at).toLocaleDateString('tr-TR')}</td>
                <td className="p-4">
                  <button className="text-indigo-400 hover:text-indigo-300 text-sm">Düzenle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

// ==================== AI RULES TAB ====================

function AiRulesTab() {
  const [rules, setRules] = useState<AiRule[]>([
    {
      id: '1',
      name: 'Çoktan Seçmeli Soru Üretimi',
      description: 'Konuya uygun 4 seçenekli sorular üretir',
      contentType: 'question',
      promptTemplate: `Konu: {{topicTitle}}
Ünite: {{unitTitle}}
Ders: {{lessonTitle}}
Sınıf: {{gradeName}}

Bu konu için {{count}} adet çoktan seçmeli soru üret. Her soru:
- Net bir soru metni
- 4 seçenek (A, B, C, D)
- Doğru cevap belirtilmiş
- Zorluk seviyesi (1-5 arası)

Sorular MEB müfredatına uygun olsun.`,
      variables: ['topicTitle', 'unitTitle', 'lessonTitle', 'gradeName', 'count'],
      isActive: true
    },
    {
      id: '2',
      name: 'Konu Anlatımı Üretimi',
      description: 'Konu için detaylı anlatım metni oluşturur',
      contentType: 'topic_content',
      promptTemplate: `Konu: {{topicTitle}}
Ünite: {{unitTitle}}
Ders: {{lessonTitle}}

Bu konu için öğrencilerin anlayacağı şekilde:
1. Konunun tanımı ve önemi
2. Temel kavramlar
3. Örnekler (günlük hayattan)
4. Özet

Şeklinde yapılandırılmış bir anlatım yaz.`,
      variables: ['topicTitle', 'unitTitle', 'lessonTitle'],
      isActive: true
    },
    {
      id: '3',
      name: 'Ünite Açıklaması',
      description: 'Ünite için özet açıklama ve hedefler',
      contentType: 'unit_description',
      promptTemplate: `Ünite: {{unitTitle}}
Ders: {{lessonTitle}}
Sınıf: {{gradeName}}

Bu ünite için:
- Ünite genel açıklaması (2-3 cümle)
- Kazanımlar/hedefler (maddeler halinde)
- Tahmini süre
- Ön koşul bilgiler`,
      variables: ['unitTitle', 'lessonTitle', 'gradeName'],
      isActive: false
    }
  ]);

  const [selectedRule, setSelectedRule] = useState<AiRule | null>(null);

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">AI Üretim Kuralları</h2>
          <p className="text-gray-400">Benim kullanacağım prompt şablonları ve kurallar</p>
        </div>
        <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium">
          + Yeni Kural
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rules List */}
        <div className="lg:col-span-1 space-y-3">
          {rules.map(rule => (
            <button
              key={rule.id}
              onClick={() => setSelectedRule(rule)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedRule?.id === rule.id 
                  ? 'bg-indigo-500/20 border-indigo-500/50' 
                  : 'bg-[#111114] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="font-medium text-white">{rule.name}</span>
              </div>
              <p className="text-gray-400 text-sm">{rule.description}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-300">{rule.contentType}</span>
                <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-300">{rule.variables.length} değişken</span>
              </div>
            </button>
          ))}
        </div>

        {/* Rule Editor */}
        <div className="lg:col-span-2">
          {selectedRule ? (
            <div className="bg-[#111114] rounded-2xl border border-white/5 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">{selectedRule.name}</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-gray-400 text-sm">Aktif</span>
                  <input 
                    type="checkbox" 
                    checked={selectedRule.isActive}
                    className="w-5 h-5 rounded bg-white/10 border-white/20 text-indigo-500"
                  />
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Prompt Şablonu</label>
                  <textarea 
                    value={selectedRule.promptTemplate}
                    rows={12}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white font-mono text-sm focus:border-indigo-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Değişkenler</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedRule.variables.map(v => (
                      <code key={v} className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 text-sm">
                        {'{{'} {v} {'}}'}
                      </code>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <p className="text-gray-400 text-sm mb-3">Önizleme:</p>
                  <div className="bg-black/50 rounded-xl p-4 text-gray-300 text-sm font-mono">
                    {selectedRule.promptTemplate
                      .replace(/\{\{topicTitle\}\}/g, 'Kesirlerle İşlemler')
                      .replace(/\{\{unitTitle\}\}/g, 'Kesirler')
                      .replace(/\{\{lessonTitle\}\}/g, 'Matematik')
                      .replace(/\{\{gradeName\}\}/g, '5. Sınıf')
                      .replace(/\{\{count\}\}/g, '5')}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button className="px-4 py-2 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all">
                  Kopyala
                </button>
                <button className="px-4 py-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-all">
                  Kaydet
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#111114] rounded-2xl border border-white/5 p-12 text-center">
              <p className="text-gray-400">Detayları görmek için bir kural seçin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== BULK OPERATIONS ====================

function BulkOperationsTab() {
  const [operations] = useState([
    { id: 'generate-questions', name: 'Toplu Soru Üret', description: 'Seçili konular için toplu soru üretimi', icon: '❓', color: 'from-blue-500 to-cyan-500' },
    { id: 'generate-content', name: 'Toplu İçerik Üret', description: 'Konular için anlatım metinleri üret', icon: '📝', color: 'from-emerald-500 to-teal-500' },
    { id: 'validate-links', name: 'Link Kontrolü', description: 'Tüm içeriklerdeki linkleri kontrol et', icon: '🔗', color: 'from-purple-500 to-pink-500' },
    { id: 'sync-counts', name: 'Sayıları Senkronize Et', description: 'Soru sayılarını yeniden hesapla', icon: '🔄', color: 'from-amber-500 to-orange-500' },
    { id: 'export-data', name: 'Veri Dışa Aktar', description: 'Tüm içerikleri JSON olarak dışa aktar', icon: '⬇️', color: 'from-indigo-500 to-violet-500' },
    { id: 'import-data', name: 'Veri İçe Aktar', description: 'JSON dosyasından içerik aktar', icon: '⬆️', color: 'from-green-500 to-lime-500' },
  ]);

  return (
    <div className="p-8">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-white">Toplu İşlemler</h2>
        <p className="text-gray-400">AI destekli toplu operasyonlar</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {operations.map(op => (
          <button
            key={op.id}
            className="text-left p-6 rounded-2xl bg-[#111114] border border-white/5 hover:border-white/10 transition-all group"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${op.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
              {op.icon}
            </div>
            <h3 className="font-semibold text-white mb-1">{op.name}</h3>
            <p className="text-gray-400 text-sm">{op.description}</p>
          </button>
        ))}
      </div>

      {/* Operation Preview Panel */}
      <div className="mt-8 bg-[#111114] rounded-2xl border border-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Son İşlemler</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
            <span className="text-green-400">✓</span>
            <div className="flex-1">
              <p className="text-white text-sm">Soru sayıları senkronize edildi</p>
              <p className="text-gray-500 text-xs">5 dakika önce</p>
            </div>
            <span className="text-gray-400 text-sm">127 ünite güncellendi</span>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
            <span className="text-green-400">✓</span>
            <div className="flex-1">
              <p className="text-white text-sm">Toplu soru üretimi tamamlandı</p>
              <p className="text-gray-500 text-xs">1 saat önce</p>
            </div>
            <span className="text-gray-400 text-sm">45 soru eklendi</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== LOADING ====================

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400">Yükleniyor...</span>
      </div>
    </div>
  );
}
