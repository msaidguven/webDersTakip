'use client';

import { useEffect } from 'react';

// ?soru=ID ile gelen paylaşım linkleri için: sayfa yüklendiğinde ilgili soruya scroll edip
// kısa bir "flash" ile dikkat çeker, ardından ince/kalıcı bir "aktif soru" halkası bırakır.
// Soru id'sinin sayfada gerçekten var olup olmadığı server'da zaten doğrulanıyor (bkz.
// activeQuestionId'yi hesaplayan page.tsx) — burada sadece DOM tarafı ele alınır.
export default function QuestionBankHighlight({ activeQuestionId }: { activeQuestionId: number | null }) {
  useEffect(() => {
    if (activeQuestionId == null) return;
    const el = document.getElementById(`soru-${activeQuestionId}`);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('ring-2', 'ring-indigo-500');
    el.classList.add('animate-pulse');
    const timer = setTimeout(() => el.classList.remove('animate-pulse'), 2200);
    return () => clearTimeout(timer);
  }, [activeQuestionId]);

  return null;
}
