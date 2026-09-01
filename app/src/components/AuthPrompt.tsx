'use client';

import React from 'react';
import Link from 'next/link';

interface AuthPromptProps {
  message: string;
}

export function AuthPrompt({ message }: AuthPromptProps) {
  return (
    <div className="rounded-xl sm:rounded-2xl bg-surface-elevated border border-default p-6 sm:p-8 text-center">
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-3 sm:mb-4 text-xl sm:text-2xl">
        🔒
      </div>
      <p className="text-default font-medium mb-1">Bu bölümü görmek için giriş yapmalısın</p>
      <p className="text-muted-foreground text-sm mb-4">{message}</p>
      <Link
        href="/login?redirectTo=/panel"
        className="inline-block px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
      >
        Giriş Yap
      </Link>
    </div>
  );
}
