'use client';

// Soru bankası ünite sayfasındaki konu listesi — eskiden her konu ayrı bir sayfaya (tam
// navigasyon) giden bir Link'ti, kullanıcı "son sayfa ünite olsun, konular ayrı sayfa
// olmasın" dedi (bkz. [[project_soru_sayfalari_simplification]]). Artık her konu bu SAYFADA
// açılıp kapanan bir accordion — tıklanınca sorular /api/soru-bankasi/topic-questions'tan
// gecikmeli (lazy) çekiliyor, tek seferde ünitedeki TÜM soruları (bazı ünitelerde 180'e
// kadar) render etmek zorunda kalmıyoruz. Konunun kendi sayfası (bkz. [konu]/page.tsx) hâlâ
// var ve SEO/paylaşım linki olarak çalışıyor — bu component sadece ek, daha hızlı bir
// erişim yolu, tek doğru kaynağı DEĞİŞTİRMİYOR (QuestionBankBoard aynı component).
import { useState } from 'react';
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { QuizQuestion } from '@/app/src/lib/quizQuestions';
import QuestionBankBoard from '@/app/src/components/QuestionBankBoard';

interface TopicSummary {
  id: number;
  slug: string;
  title: string;
  questionCount: number;
}

interface TopicData {
  questions: QuizQuestion[];
  commentCounts: Record<number, number>;
}

export default function SoruBankasiUnitAccordion({
  topics,
  gradeSlug,
  lessonSlug,
  unitSlug,
  gradeId,
  lessonId,
  unitId,
}: {
  topics: TopicSummary[];
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  gradeId: number;
  lessonId: number;
  unitId: number;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dataByTopic, setDataByTopic] = useState<Record<number, TopicData>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [errorId, setErrorId] = useState<number | null>(null);

  const toggle = async (topic: TopicSummary) => {
    if (expandedId === topic.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(topic.id);
    if (dataByTopic[topic.id] || loadingId === topic.id) return;

    setLoadingId(topic.id);
    setErrorId(null);
    try {
      const res = await fetch(`/api/soru-bankasi/topic-questions?topicId=${topic.id}`);
      if (!res.ok) throw new Error('fetch-failed');
      const json = (await res.json()) as TopicData;
      setDataByTopic((prev) => ({ ...prev, [topic.id]: json }));
    } catch {
      setErrorId(topic.id);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-2.5">
      {topics.map((topic) => {
        const isOpen = expandedId === topic.id;
        const basePath = `/soru-bankasi/${gradeSlug}/${lessonSlug}/${unitSlug}/${topic.slug}`;
        return (
          <div key={topic.id} className="overflow-hidden rounded-2xl border border-default bg-surface-elevated">
            <button
              type="button"
              onClick={() => toggle(topic)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-default">{topic.title}</p>
                <span className="mt-1 inline-block text-xs font-bold text-muted-foreground">{topic.questionCount} soru</span>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="border-t border-default p-3.5 sm:p-5">
                {loadingId === topic.id && (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm font-bold text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Sorular yükleniyor…
                  </div>
                )}
                {errorId === topic.id && (
                  <p className="py-6 text-center text-sm font-bold text-rose-500">Sorular yüklenemedi, tekrar dener misin?</p>
                )}
                {dataByTopic[topic.id] && (
                  <>
                    <Link
                      href={basePath}
                      className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-indigo-500"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Bu konuyu ayrı sayfada aç / paylaş
                    </Link>
                    <QuestionBankBoard
                      questions={dataByTopic[topic.id].questions}
                      basePath={basePath}
                      gradeId={gradeId}
                      lessonId={lessonId}
                      unitId={unitId}
                      commentCounts={dataByTopic[topic.id].commentCounts}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
