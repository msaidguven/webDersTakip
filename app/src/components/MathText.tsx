'use client';

// Soru ekranındaki düz metin alanlarını (question_text, solution_text, şık/model cevap
// metinleri) render eder — içinde \( ... \) / \[ ... \] LaTeX geçiyorsa KaTeX ile düzgün
// formül olarak gösterir (kesir, üs, kök vb.), geçmiyorsa metni olduğu gibi basar. Ders
// notu ekranındaki (SectionContent.tsx) markdownToHtml'in AYNI math motorunu (topicContentV11)
// kullanır ki iki ekran arasında matematik gösterimi tutarlı olsun.
import { useMemo } from 'react';
import { renderPlainTextMath } from '@/app/src/lib/topicContentV11';

export default function MathText({
  text,
  as: Tag = 'span',
  className,
}: {
  text: string;
  as?: 'span' | 'p';
  className?: string;
}) {
  const html = useMemo(() => renderPlainTextMath(text), [text]);
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
