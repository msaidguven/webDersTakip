'use client';

// Yazılı sorusunun görseli. sanitizeMathSvg (DOMPurify) DOM ister, bu yüzden temizleme mount sonrası
// tarayıcıda yapılır (QuizClient.QuestionSvg ile aynı desen; o bileşen tüm oynatıcıyı çektiği için
// burada küçük, yakınlaştırmasız bir kopya). Görsel kabı karanlık temada da açık kalır.
import { useEffect, useState } from 'react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';

export function YaziliSvg({ svgContent, label }: { svgContent: string; label?: string }) {
  const [clean, setClean] = useState<string | null>(null);
  useEffect(() => {
    setClean(sanitizeMathSvg(svgContent));
  }, [svgContent]);
  if (!clean) return null;
  return (
    <div
      role="img"
      aria-label={label}
      className="light my-3 flex w-full justify-center rounded-xl border border-default bg-white p-3 [&_svg]:h-auto [&_svg]:max-h-64 [&_svg]:w-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
