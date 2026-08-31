'use client';

import { useState } from 'react';
import Link from 'next/link';
import RagDocumentsPanel from '@/app/src/components/admin/RagDocumentsPanel';
import RagQaApprovalPanel from '@/app/src/components/admin/RagQaApprovalPanel';
import RagReportsPanel from '@/app/src/components/admin/RagReportsPanel';

export const dynamic = 'force-dynamic';

type Tab = 'reports' | 'qa' | 'documents';

export default function DersNotuRagPage() {
  const [tab, setTab] = useState<Tab>('reports');

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <header className="sticky top-0 z-10 bg-[#111114] border-b border-white/5 px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/admin" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
          <span>←</span> Admin Paneline Dön
        </Link>
        <h1 className="font-bold text-white text-sm sm:text-base">Ders Notu Soru-Cevap (RAG)</h1>
      </header>
      <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
        <div className="flex gap-2 mb-6 flex-wrap">
          <TabButton active={tab === 'reports'} onClick={() => setTab('reports')} label="Bildirilenler" />
          <TabButton active={tab === 'qa'} onClick={() => setTab('qa')} label="Onay Bekleyenler" />
          <TabButton active={tab === 'documents'} onClick={() => setTab('documents')} label="Ders Notu PDF'leri" />
        </div>
        {tab === 'reports' && <RagReportsPanel />}
        {tab === 'qa' && <RagQaApprovalPanel />}
        {tab === 'documents' && <RagDocumentsPanel />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
        active ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}
