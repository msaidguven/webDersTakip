'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDersViewModel } from '../src/viewmodels/useDersViewModel';
import { Icon } from '../src/components/icons';

const CURRENT_WEEK = 19;

// Components
function HtmlContent({ html }: { html: string }) {
  if (!html) return null;
  
  const cleanHtml = html
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/\n\s*\n/g, '\n')
    .replace(/<table/g, '<div class="overflow-x-auto my-4"><table class="w-full border-collapse"')
    .replace(/<\/table>/g, '</table></div>')
    .replace(/<td/g, '<td class="border border-zinc-700 px-4 py-2 text-zinc-300 text-lg"')
    .replace(/<th/g, '<th class="border border-zinc-700 px-4 py-2 bg-zinc-800 text-white font-semibold text-lg"')
    .replace(/<ul/g, '<ul class="list-disc list-inside space-y-2 my-4 text-zinc-300 text-lg"')
    .replace(/<ol/g, '<ol class="list-decimal list-inside space-y-2 my-4 text-zinc-300 text-lg"')
    .replace(/<h1/g, '<h1 class="text-3xl font-bold text-white my-6"')
    .replace(/<h2/g, '<h2 class="text-2xl font-bold text-white my-5"')
    .replace(/<h3/g, '<h3 class="text-xl font-bold text-white my-4"')
    .replace(/<h4/g, '<h4 class="text-lg font-bold text-white my-3"')
    .replace(/<p(?![^>]*class)/g, '<p class="text-zinc-300 leading-relaxed my-3 text-lg"')
    .replace(/<strong/g, '<strong class="text-white font-semibold"')
    .replace(/<b(?![^>]*class)/g, '<b class="text-white"')
    .replace(/<em/g, '<em class="text-zinc-300 italic"')
    .replace(/<a(?![^>]*class)/g, '<a class="text-indigo-400 hover:text-indigo-300 underline transition-colors"')
    .replace(/<img/g, '<img class="max-w-full h-auto rounded-xl my-4 shadow-lg"')
    .replace(/<blockquote/g, '<blockquote class="border-l-4 border-indigo-500 pl-4 my-4 italic text-zinc-400 bg-zinc-800/50 py-2 pr-4 rounded-r-lg"')
    .replace(/<code(?![^>]*class)/g, '<code class="bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded text-sm font-mono"')
    .replace(/<pre/g, '<pre class="bg-zinc-800 p-4 rounded-xl overflow-x-auto my-4 text-sm"')
    .replace(/<hr/g, '<hr class="border-zinc-700 my-6"');

  return (
    <div 
      className="html-content"
      dangerouslySetInnerHTML={{ __html: cleanHtml }} 
    />
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400">Yukleniyor...</p>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl mx-auto mb-6">⚠️</div>
        <h1 className="text-2xl font-bold text-white mb-4">Hata</h1>
        <p className="text-zinc-400 mb-6">{error}</p>
        <div className="flex gap-3 justify-center">
          <button 
            onClick={onRetry}
            className="px-6 py-3 rounded-xl bg-indigo-500 text-white"
          >
            Tekrar Dene
          </button>
          <Link href="/" className="px-6 py-3 rounded-xl bg-zinc-800 text-white">
            Ana Sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}

function Header({ gradeName, lessonName }: { gradeName: string; lessonName: string }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[60px] sm:h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-3 sm:px-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-lg sm:text-xl">📚</span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-white hidden sm:block">Ders Takip</span>
          </Link>
          <div className="h-6 w-px bg-white/10 hidden sm:block" />
          <Link href="/" className="text-zinc-400 hover:text-white text-sm sm:text-base">{'<-'} Geri</Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-zinc-400 text-xs sm:text-sm hidden md:block">{gradeName} {'->'} {lessonName}</span>
          <div className="bg-zinc-800 text-white text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-zinc-700">{CURRENT_WEEK}. Hafta</div>
        </div>
      </div>
    </nav>
  );
}

function PageHeader({ gradeName, lessonName, outcomeCount }: { 
  gradeName: string; 
  lessonName: string; 
  outcomeCount: number;
}) {
  return (
    <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-white/10 p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-zinc-500 mb-3 sm:mb-4">
        <span>🎓 {gradeName}</span>
        <span>{'->'}</span>
        <span>📚 {lessonName}</span>
        <span className="hidden sm:inline">{'->'}</span>
        <span className="hidden sm:inline">{CURRENT_WEEK}. Hafta</span>
      </div>
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">{CURRENT_WEEK}. Hafta Konulari</h1>
      <div className="flex items-center gap-4 sm:gap-6 text-zinc-400">
        <span className="flex items-center gap-2 text-sm">
          <Icon name="book" size={16} className="sm:w-[18px] sm:h-[18px]" />
          {outcomeCount} Kazanim
        </span>
      </div>
    </div>
  );
}

function TabButtons({ 
  activeTab, 
  onTabChange 
}: { 
  activeTab: 'outcomes' | 'content'; 
  onTabChange: (tab: 'outcomes' | 'content') => void;
}) {
  return (
    <div className="flex gap-2 mb-6 sm:mb-8">
      <button
        onClick={() => onTabChange('outcomes')}
        className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base ${activeTab === 'outcomes' ? 'bg-indigo-500 text-white' : 'bg-zinc-900/50 text-zinc-400 hover:text-white'}`}
      >
        <span className="sm:hidden">🎯 Kazanımlar</span>
        <span className="hidden sm:inline">🎯 Kazanimlar</span>
      </button>
      <button
        onClick={() => onTabChange('content')}
        className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base ${activeTab === 'content' ? 'bg-indigo-500 text-white' : 'bg-zinc-900/50 text-zinc-400 hover:text-white'}`}
      >
        <span className="sm:hidden">📚 Konu</span>
        <span className="hidden sm:inline">📚 Konu Anlatimi</span>
      </button>
    </div>
  );
}

function OutcomesList({ outcomes }: { outcomes: Array<{ id: number; description: string; topicTitle: string }> }) {
  if (outcomes.length === 0) {
    return <p className="text-zinc-400 text-sm sm:text-base">Bu hafta icin kazanim bulunmuyor.</p>;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {outcomes.map((outcome, index) => (
        <div key={outcome.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-zinc-800/30">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-sm sm:text-base">{index + 1}</div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-200 text-sm sm:text-base leading-relaxed">{outcome.description}</p>
            {outcome.topicTitle && <p className="text-zinc-500 text-xs sm:text-sm mt-1.5 sm:mt-2">{outcome.topicTitle}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContentList({ 
  contents, 
  lessonId,
  isLoading 
}: { 
  contents: Array<{ id: number; title: string; content: string; orderNo: number }>;
  lessonId: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-400">Konu anlatimlari yukleniyor...</p>
      </div>
    );
  }

  if (contents.length === 0) {
    return <p className="text-zinc-400">Bu hafta icin icerik bulunmuyor.</p>;
  }

  return (
    <div className="space-y-6">
      {contents.map((content, idx) => (
        <article key={content.id} className="rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-900/50 border border-white/10 overflow-hidden">
          <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-white/5 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                <span className="text-xl font-bold text-white">{idx + 1}</span>
              </div>
              <div className="flex-1 pt-1">
                <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{content.title}</h2>
                <p className="text-zinc-500 text-sm mt-1">Konu {idx + 1} / {contents.length}</p>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <HtmlContent html={content.content} />
          </div>
        </article>
      ))}
      
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg shadow-indigo-500/30">
          🎯
        </div>
        <h3 className="text-2xl font-bold text-white mb-3">Haftalik Test</h3>
        <p className="text-zinc-400 mb-6 max-w-md mx-auto">
          Coktan secmeli, bosluk doldurma, eslestirme ve klasik sorularin karistigi test.
        </p>
        <Link 
          href={`/karisik-test?lesson_id=${lessonId}&week=${CURRENT_WEEK}`} 
          className="inline-block px-10 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
        >
          Teste Basla →
        </Link>
      </div>
    </div>
  );
}

function DersContent() {
  const searchParams = useSearchParams();
  const gradeId = searchParams.get('grade_id');
  const lessonId = searchParams.get('lesson_id');

  const { state, contentsLoading, setActiveTab, refreshData } = useDersViewModel(gradeId, lessonId);

  if (state.isLoading) return <LoadingState />;
  if (state.error) return <ErrorState error={state.error} onRetry={refreshData} />;
  if (!state.data) return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
      <p className="text-zinc-400">Veriler yuklenemedi</p>
    </div>
  );

  const { data } = state;

  return (
    <div className="min-h-screen bg-[#0f0f11]">
      <Header gradeName={data.gradeName} lessonName={data.lessonName} />

      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <PageHeader 
            gradeName={data.gradeName} 
            lessonName={data.lessonName} 
            outcomeCount={data.outcomes.length}
          />

          <TabButtons activeTab={state.activeTab} onTabChange={setActiveTab} />

          {state.activeTab === 'outcomes' && (
            <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-white mb-6">Bu Haftanin Kazanimlari</h2>
              <OutcomesList outcomes={data.outcomes} />
            </div>
          )}

          {state.activeTab === 'content' && lessonId && (
            <ContentList contents={data.contents} lessonId={lessonId} isLoading={contentsLoading} />
          )}
        </div>
      </main>
    </div>
  );
}

export default function DersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f11]" />}>
      <DersContent />
    </Suspense>
  );
}
