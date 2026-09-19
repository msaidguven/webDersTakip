'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import RagDocumentsPanel from '@/app/src/components/admin/RagDocumentsPanel';
import RagQaApprovalPanel from '@/app/src/components/admin/RagQaApprovalPanel';
import RagReportsPanel from '@/app/src/components/admin/RagReportsPanel';
import AiQuestionDraftsPanel from '@/app/src/components/admin/AiQuestionDraftsPanel';
import AiContentDraftsPanel from '@/app/src/components/admin/AiContentDraftsPanel';
import RagTopicBuilderPanel from '@/app/src/components/admin/RagTopicBuilderPanel';
import TeacherGuideDocumentsPanel from '@/app/src/components/admin/TeacherGuideDocumentsPanel';
import AdminThemeToggle from '@/app/src/components/admin/AdminThemeToggle';

export const dynamic = 'force-dynamic';

type Tab = 'reports' | 'qa' | 'documents' | 'drafts' | 'content-drafts' | 'build' | 'teacher-guide';

export default function DersNotuRagPage() {
  return (
    <Suspense fallback={null}>
      <DersNotuRagPageInner />
    </Suspense>
  );
}

// /admin/konu-icerik/[topicId]'deki "RAG Kaynağını Yönet →" linki buraya ?tab=build&topicId=
// ile geliyor (kullanıcının 2026-09-18 isteği: RAG araçları iki yerde tekrarlanmasın, tek
// kanonik yer burası olsun, konu sayfasından bir tık uzakta kalsın).
function DersNotuRagPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab | null) || 'reports';
  const initialTopicId = Number(searchParams.get('topicId'));
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <span>←</span> Admin Paneline Dön
        </Link>
        <h1 className="font-bold text-foreground text-sm sm:text-base flex-1">Ders Notu Soru-Cevap (RAG)</h1>
        <AdminThemeToggle />
      </header>
      <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
        <div className="flex gap-2 mb-6 flex-wrap">
          <TabButton active={tab === 'reports'} onClick={() => setTab('reports')} label="Bildirilenler" />
          <TabButton active={tab === 'qa'} onClick={() => setTab('qa')} label="Onay Bekleyenler" />
          <TabButton active={tab === 'documents'} onClick={() => setTab('documents')} label="Ders Notu PDF'leri" />
          <TabButton active={tab === 'drafts'} onClick={() => setTab('drafts')} label="AI Soru Taslakları" />
          <TabButton active={tab === 'content-drafts'} onClick={() => setTab('content-drafts')} label="AI İçerik Taslakları" />
          <TabButton active={tab === 'build'} onClick={() => setTab('build')} label="Sentezle RAG Oluştur" />
          <TabButton active={tab === 'teacher-guide'} onClick={() => setTab('teacher-guide')} label="Öğretmen Kılavuzu" />
        </div>
        {tab === 'reports' && <RagReportsPanel />}
        {tab === 'qa' && <RagQaApprovalPanel />}
        {tab === 'documents' && <RagDocumentsPanel />}
        {tab === 'drafts' && <AiQuestionDraftsPanel />}
        {tab === 'content-drafts' && <AiContentDraftsPanel />}
        {tab === 'build' && <RagTopicBuilderPanel initialTopicId={Number.isFinite(initialTopicId) && initialTopicId > 0 ? initialTopicId : null} />}
        {tab === 'teacher-guide' && <TeacherGuideDocumentsPanel />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
        active ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}
