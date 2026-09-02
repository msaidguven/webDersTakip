'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { getWeeklyLeaderboard, LeaderboardEntry } from '../lib/leaderboard';
import { onQuizModalClosed } from '../lib/panelRefreshBridge';

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div className={`flex items-center gap-3 px-4 sm:px-6 py-2.5 sm:py-3 ${entry.isMe ? 'bg-indigo-500/10' : ''}`}>
      <span className={`w-6 text-sm font-bold ${entry.rank <= 3 ? 'text-amber-400' : 'text-muted-foreground'}`}>{entry.rank}</span>
      <span className={`flex-1 text-sm truncate ${entry.isMe ? 'text-indigo-400 font-semibold' : 'text-default'}`}>
        {entry.isMe ? 'Sen' : entry.displayName}
      </span>
      <span className="text-sm text-muted-foreground whitespace-nowrap">{entry.totalQuestions} soru</span>
    </div>
  );
}

interface LeaderboardCardProps {
  limit?: number;
  showSeeAll?: boolean;
}

// Aynı sınıf seviyesindeki (grade_id) herkese karşı haftalık, tamamen isimsiz bir sıralama —
// gerçek bir arkadaş/sınıf sistemi yok, bu yüzden başka öğrencilerin kimliği hiçbir zaman
// gösterilmez; sadece kendi seçtikleri bir kullanıcı adı varsa (profiles.username) o görünür,
// yoksa "Öğrenci" (bkz. get_weekly_leaderboard RPC'si — bunu da sunucu tarafında garanti eder).
export function LeaderboardCard({ limit = 5, showSeeAll = true }: LeaderboardCardProps) {
  const { user, supabase } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    // user.id'ye bakıyor, ham user nesnesine değil — AuthContext sekme odağa her geldiğinde
    // aynı kullanıcı için bile yeni bir user nesnesi üretiyor (bkz. useSidebarLessons.ts'teki
    // aynı düzeltme); burada tutulsaydı sekme değiştirip panele her dönüşte sıralama
    // gereksiz yere yeniden çekilirdi.
    if (!user) return;
    let cancelled = false;
    getWeeklyLeaderboard(supabase).then((result) => {
      if (!cancelled) setEntries(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase]);

  // Quiz modalı (X / Escape ile) kapanınca sıralamayı da sessizce tazele — diğer panel
  // bölümleri zaten refreshData ile güncelleniyordu, sıralama bu akışa dahil değildi
  // (kullanıcının "haftalık sıralama güncellenmiyor" bildirimi, 2026-09-02). Eski veri
  // ekranda kalır, yeni sonuç gelince yerini alır — skeleton'a dönüp duraklamaz.
  useEffect(() => {
    if (!user) return;
    return onQuizModalClosed(() => {
      getWeeklyLeaderboard(supabase).then((result) => setEntries(result));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase]);

  if (!user) return null;

  if (entries === null) {
    return (
      <div className="rounded-xl sm:rounded-2xl bg-surface-elevated border border-default p-4 sm:p-6">
        <div className="h-5 w-32 bg-zinc-800 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 rounded-lg bg-zinc-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const me = entries.find((e) => e.isMe);
  const topEntries = entries.slice(0, limit);
  const showMeSeparately = !!me && !topEntries.some((e) => e.isMe);

  return (
    <div className="rounded-xl sm:rounded-2xl bg-surface-elevated border border-default overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-default flex items-center justify-between">
        <h3 className="font-semibold text-default text-sm sm:text-base">🏆 Haftalık Sıralama</h3>
        {showSeeAll && entries.length > 0 && (
          <Link href="/panel/siralama" className="text-xs sm:text-sm text-muted-foreground hover:text-indigo-400 transition-colors">
            Tümünü Gör →
          </Link>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="p-6 sm:p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Sınıfın için henüz bir sıralama yok — sınıfını profilinden seçip soru çözmeye başla.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {topEntries.map((entry) => (
            <LeaderboardRow key={entry.rank} entry={entry} />
          ))}
          {showMeSeparately && me && (
            <>
              <div className="px-4 py-1 text-center text-xs text-muted-foreground">•••</div>
              <LeaderboardRow entry={me} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
