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
    // Theme-aware table styling
    .replace(/<table/g, '<div class="overflow-x-auto my-4"><table class="w-full border-collapse"')
    .replace(/<\/table>/g, '</table></div>')
    .replace(/<td/g, '<td class="border border-default px-4 py-2 text-muted text-lg"')
    .replace(/<th/g, '<th class="border border-default px-4 py-2 bg-surface-elevated text-default font-semibold text-lg"')
    // Theme-aware lists
    .replace(/<ul/g, '<ul class="list-disc list-inside space-y-2 my-4 text-muted text-lg"')
    .replace(/<ol/g, '<ol class="list-decimal list-inside space-y-2 my-4 text-muted text-lg"')
    // Theme-aware headings
    .replace(/<h1/g, '<h1 class="text-3xl font-bold text-default my-6"')
    .replace(/<h2/g, '<h2 class="text-2xl font-bold text-default my-5"')
    .replace(/<h3/g, '<h3 class="text-xl font-bold text-default my-4"')
    .replace(/<h4/g, '<h4 class="text-lg font-bold text-default my-3"')
    // Theme-aware paragraphs and text
    .replace(/<p(?![^>]*class)/g, '<p class="text-muted leading-relaxed my-3 text-lg"')
    .replace(/<strong/g, '<strong class="text-default font-semibold"')
    .replace(/<b(?![^>]*class)/g, '<b class="text-default"')
    .replace(/<em/g, '<em class="text-muted italic"')
    .replace(/<a(?![^>]*class)/g, '<a class="text-indigo-500 hover:text-indigo-400 underline transition-colors"')
    .replace(/<img/g, '<img class="max-w-full h-auto rounded-xl my-4 shadow-lg"')
    // Theme-aware blockquote
    .replace(/<blockquote/g, '<blockquote class="border-l-4 border-indigo-500 pl-4 my-4 italic text-muted bg-surface py-2 pr-4 rounded-r-lg"')
    // Theme-aware code
    .replace(/<code(?![^>]*class)/g, '<code class="bg-surface text-emerald-500 px-1.5 py-0.5 rounded text-sm font-mono"')
    .replace(/<pre/g, '<pre class="bg-surface p-4 rounded-xl overflow-x-auto my-4 text-sm"')
    .replace(/<hr/g, '<hr class="border-default my-6"');

  return (
    <div 
      className="html-content"
      dangerouslySetInnerHTML={{ __html: cleanHtml }} 
    />
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-default flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted">Yukleniyor...</p>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-default flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl mx-auto mb-6">⚠️</div>
        <h1 className="text-2xl font-bold text-default mb-4">Hata</h1>
        <p className="text-muted mb-6">{error}</p>
        <div className="flex gap-3 justify-center">
          <button 
            onClick={onRetry}
            className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-medium"
          >
            Tekrar Dene
          </button>
          <Link href="/" className="px-6 py-3 rounded-xl bg-surface text-default border border-default">
            Ana Sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ gradeName, lessonName, outcomeCount, unitName }: { 
  gradeName: string; 
  lessonName: string; 
  outcomeCount: number;
  unitName?: string;
}) {
  return (
    <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-default p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
      {/* Navigasyon: 19. Hafta -> 5. Sınıf -> Ders */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm mb-4">
        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{CURRENT_WEEK}. Hafta</span>
        <span className="text-muted">→</span>
        <span className="text-default">{gradeName}</span>
        <span className="text-muted">→</span>
        <span className="text-default">{lessonName}</span>
        {unitName && (
          <>
            <span className="text-muted">→</span>
            <span className="text-default">{unitName}</span>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-4 sm:gap-6 text-muted">
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
        className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base ${activeTab === 'outcomes' ? 'bg-indigo-500 text-white' : 'bg-surface-elevated text-muted hover:text-default'}`}
      >
        <span className="sm:hidden">🎯 Kazanımlar</span>
        <span className="hidden sm:inline">🎯 Kazanimlar</span>
      </button>
      <button
        onClick={() => onTabChange('content')}
        className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base ${activeTab === 'content' ? 'bg-indigo-500 text-white' : 'bg-surface-elevated text-muted hover:text-default'}`}
      >
        <span className="sm:hidden">📚 Konu</span>
        <span className="hidden sm:inline">📚 Konu Anlatimi</span>
      </button>
    </div>
  );
}

function OutcomesList({ outcomes }: { outcomes: Array<{ id: number; description: string; topicTitle: string }> }) {
  if (outcomes.length === 0) {
    return <p className="text-muted text-sm sm:text-base">Bu hafta icin kazanim bulunmuyor.</p>;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {outcomes.map((outcome, index) => (
        <div key={outcome.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-surface border border-default">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0 font-bold text-sm sm:text-base">{index + 1}</div>
          <div className="flex-1 min-w-0">
            <p className="text-default text-sm sm:text-base leading-relaxed">{outcome.description}</p>
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
        <p className="text-muted">Konu anlatimlari yukleniyor...</p>
      </div>
    );
  }

  if (contents.length === 0) {
    return <p className="text-muted">Bu hafta icin icerik bulunmuyor.</p>;
  }

  return (
    <div className="space-y-6">
      {contents.map((content, idx) => (
        <article key={content.id} className="rounded-2xl bg-surface-elevated border border-default overflow-hidden">
          <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-default bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                <span className="text-xl font-bold text-white">{idx + 1}</span>
              </div>
              <div className="flex-1 pt-1">
                <h2 className="text-xl sm:text-2xl font-bold text-default leading-tight">{content.title}</h2>
                <p className="text-muted text-sm mt-1">Konu {idx + 1} / {contents.length}</p>
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
        <h3 className="text-2xl font-bold text-default mb-3">Haftalik Test</h3>
        <p className="text-muted mb-6 max-w-md mx-auto">
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
    <div className="min-h-screen flex items-center justify-center bg-default">
      <p className="text-muted">Veriler yuklenemedi</p>
    </div>
  );

  const { data } = state;

  return (
    <div className="min-h-screen bg-default">
      <main className="pt-6 sm:pt-8 pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <PageHeader 
            gradeName={data.gradeName} 
            lessonName={data.lessonName} 
            outcomeCount={data.outcomes.length}
          />

          <TabButtons activeTab={state.activeTab} onTabChange={setActiveTab} />

          {state.activeTab === 'outcomes' && (
            <div className="rounded-2xl bg-surface-elevated border border-default p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-default mb-6">Bu Haftanin Kazanimlari</h2>
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
    <Suspense fallback={<div className="min-h-screen bg-default" />}>
      <DersContent />
    </Suspense>
  );
}
