'use client';

import React, { useState } from 'react';
import Link from 'next/link';

const CURRENT_WEEK = 19;

interface DersClientProps {
  initialData: {
    gradeName: string;
    lessonName: string;
    unitName: string;
    outcomes: any[];
    contents: any[];
  };
  gradeId: string;
  lessonId: string;
}

function HtmlContent({ html }: { html: string }) {
  if (!html) return null;
  
  const cleanHtml = html
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/\n\s*\n/g, '\n')
    .replace(/<table/g, '<div class="overflow-x-auto my-4"><table class="w-full border-collapse"')
    .replace(/<\/table>/g, '</table></div>')
    .replace(/<td/g, '<td class="border border-default px-4 py-2 text-muted text-lg"')
    .replace(/<th/g, '<th class="border border-default px-4 py-2 bg-surface-elevated text-default font-semibold text-lg"')
    .replace(/<ul/g, '<ul class="list-disc list-inside space-y-2 my-4 text-muted text-lg"')
    .replace(/<ol/g, '<ol class="list-decimal list-inside space-y-2 my-4 text-muted text-lg"')
    .replace(/<h1/g, '<h1 class="text-3xl font-bold text-default my-6"')
    .replace(/<h2/g, '<h2 class="text-2xl font-bold text-red-500 my-5"')
    .replace(/<h3/g, '<h3 class="text-xl font-bold text-red-400 my-4"')
    .replace(/<h4/g, '<h4 class="text-lg font-bold text-default my-3"')
    .replace(/<p(?![^>]*class)/g, '<p class="text-muted leading-relaxed my-3 text-lg"')
    .replace(/<strong/g, '<strong class="text-default font-semibold"')
    .replace(/<b(?![^>]*class)/g, '<b class="text-default"')
    .replace(/<em/g, '<em class="text-muted italic"')
    .replace(/<a(?![^>]*class)/g, '<a class="text-indigo-500 hover:text-indigo-400 underline transition-colors"')
    .replace(/<img/g, '<img class="max-w-full h-auto rounded-xl my-4 shadow-lg"')
    .replace(/<blockquote/g, '<blockquote class="border-l-4 border-indigo-500 pl-4 my-4 italic text-muted bg-surface py-2 pr-4 rounded-r-lg"')
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

export default function DersClient({ initialData, gradeId, lessonId }: DersClientProps) {
  const [activeTab, setActiveTab] = useState<'outcomes' | 'content'>('outcomes');

  const { gradeName, lessonName, unitName, outcomes, contents } = initialData;

  return (
    <div className="min-h-screen bg-default">
      <main className="pt-6 sm:pt-8 pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-default p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
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
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 sm:mb-8">
            <button
              onClick={() => setActiveTab('outcomes')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base ${
                activeTab === 'outcomes' 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-surface-elevated text-muted hover:text-default'
              }`}
            >
              <span className="sm:hidden">🎯 Kazanimlar</span>
              <span className="hidden sm:inline">🎯 Kazanimlar</span>
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all text-sm sm:text-base ${
                activeTab === 'content' 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-surface-elevated text-muted hover:text-default'
              }`}
            >
              <span className="sm:hidden">📚 Konu</span>
              <span className="hidden sm:inline">📚 Konu Anlatimi</span>
            </button>
          </div>

          {/* Content */}
          {activeTab === 'outcomes' ? (
            <div className="bg-surface-elevated border border-default rounded-2xl p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-default mb-6">Bu Haftanin Kazanimlari</h2>
              <div className="space-y-3 sm:space-y-4">
                {outcomes.length === 0 ? (
                  <p className="text-muted">Bu hafta icin kazanim bulunmuyor.</p>
                ) : (
                  outcomes.map((outcome: any, index: number) => (
                    <div key={outcome.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-surface border border-default">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0 font-bold text-sm sm:text-base">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-default text-sm sm:text-base leading-relaxed">{outcome.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {contents.length === 0 ? (
                <p className="text-muted">Bu hafta icin icerik bulunmuyor.</p>
              ) : (
                contents.map((content: any) => (
                  <article key={content.id} className="rounded-2xl bg-surface-elevated border border-default overflow-hidden">
                    <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-default bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent">
                      <h2 className="text-xl sm:text-2xl font-bold text-red-500 leading-tight text-center">{content.title}</h2>
                    </div>
                    <div className="p-6 sm:p-8">
                      <HtmlContent html={content.content} />
                    </div>
                  </article>
                ))
              )}

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
          )}
        </div>
      </main>
    </div>
  );
}
