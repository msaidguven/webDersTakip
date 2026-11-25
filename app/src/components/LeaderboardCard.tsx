'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { getWeeklyLeaderboard, LeaderboardEntry } from '../lib/leaderboard';
import { onQuizModalClosed } from '../lib/panelRefreshBridge';
import { useIsAdmin } from '../hooks/useIsAdmin';
import r from './robotic/robotic.module.css';
import s from './Leaderboard.module.css';

// Görünüm (2026-10-19): robotik tema + yarışma öğeleri — ilk 3 için metalik kürsü, "senin konumun"
// modülü (üst sıraya yaklaşma çubuğu), lidere göre dolan enerji çubuklu liste. Kök tema sınıfı sayfada.

function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(' ');
}

// showRealMark: sadece admin için gerçek öğrencinin yanında "(G)" (sahte kayıtlardan ayırmak için).
// Profilini açmış üyenin adı kartına (/uye/<slug>) gider; kapalı profil ve sahte kayıtlar düz metin.
function getInitials(displayName: string): string {
  const letters = displayName
    .trim()
    .split(/\s+/)
    .map((word) => word.match(/\p{L}|\p{N}/u)?.[0] ?? '')
    .filter(Boolean);
  if (letters.length === 0) return 'Ö';
  if (letters.length === 1) return letters[0].toLocaleUpperCase('tr-TR');
  return (letters[0] + letters[letters.length - 1]).toLocaleUpperCase('tr-TR');
}

const AVATAR_TONES = [s.tone0, s.tone1, s.tone2, s.tone3, s.tone4, s.tone5] as const;

function pickAvatarTone(displayName: string): string {
  let hash = 0;
  for (let i = 0; i < displayName.length; i++) {
    hash = (Math.imul(31, hash) + displayName.charCodeAt(i)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

function StudentAvatar({ entry, variant }: { entry: LeaderboardEntry; variant: 'podium' | 'row' | 'me' }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = entry.avatarUrl?.trim() || null;
  const showImg = !!url && failedUrl !== url;
  const initials = getInitials(entry.displayName);

  const badge = (
    <span
      className={cx(
        s.avatar,
        variant === 'podium' ? s.avatarPodium : variant === 'me' ? s.meAvatar : s.avatarRow,
        !showImg && pickAvatarTone(entry.displayName)
      )}
      aria-hidden="true"
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
          className={s.avatarImg}
        />
      ) : (
        initials
      )}
    </span>
  );

  if (!entry.publicSlug) return badge;
  return (
    <Link
      href={`/uye/${entry.publicSlug}`}
      tabIndex={-1}
      aria-hidden="true"
      className={s.avatarLink}
    >
      {badge}
    </Link>
  );
}

function Name({ entry, showRealMark }: { entry: LeaderboardEntry; showRealMark: boolean }) {
  const label = entry.isMe ? 'Sen' : entry.displayName;
  return (
    <>
      {entry.publicSlug ? (
        <Link href={`/uye/${entry.publicSlug}`} className="underline decoration-dotted underline-offset-4 hover:decoration-solid" title={entry.isMe ? 'Kartını gör' : `${entry.displayName} profilini gör`}>
          {label}
        </Link>
      ) : (
        label
      )}
      {showRealMark && entry.isReal && <span className="ml-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">(G)</span>}
    </>
  );
}

const PODIUM_STYLE = { 1: s.gold, 2: s.silver, 3: s.bronze } as const;

export function Podium({ entries, showRealMark }: { entries: LeaderboardEntry[]; showRealMark: boolean }) {
  // Görsel sıra: 2 · 1 · 3 (birinci ortada, en yüksek basamak).
  const byRank = (n: number) => entries.find((e) => e.rank === n);
  const slots = [byRank(2), byRank(1), byRank(3)];
  return (
    <ol className={s.podium} aria-label="İlk üç">
      {slots.map((e, i) =>
        e ? (
          <li key={e.rank} className={cx(s.step, PODIUM_STYLE[e.rank as 1 | 2 | 3], e.isMe && s.stepMe)}>
            {e.rank === 1 && <span className={s.crown} aria-hidden="true">👑</span>}
            <div className={s.podiumAvatarWrap}>
              <StudentAvatar entry={e} variant="podium" />
              <span className={s.medalBadge} aria-label={`${e.rank}. sıra`}>{e.rank}</span>
            </div>
            <span className={s.stepName}><Name entry={e} showRealMark={showRealMark} /></span>
            <span className={s.stepScore}>{e.totalQuestions} soru</span>
          </li>
        ) : (
          <li key={`bos-${i}`} aria-hidden="true" />
        )
      )}
    </ol>
  );
}

export function Row({ entry, max, showRealMark }: { entry: LeaderboardEntry; max: number; showRealMark: boolean }) {
  return (
    <li className={cx(s.row, r.item, entry.isMe && s.rowMe)}>
      <span className={cx(s.rank, r.chipBox)}>{entry.rank}</span>
      <StudentAvatar entry={entry} variant="row" />
      <span className={s.rowMain}>
        <span className={s.rowName}><Name entry={entry} showRealMark={showRealMark} /></span>
        <span className={s.energy} aria-hidden="true">
          <span className={s.energyFill} style={{ width: `${max ? Math.max(4, (entry.totalQuestions / max) * 100) : 0}%` }} />
        </span>
      </span>
      <span className={s.rowScore}>{entry.totalQuestions} soru</span>
    </li>
  );
}

interface LeaderboardCardProps {
  limit?: number;
  showSeeAll?: boolean;
}

// Haftalık sıralama — 2026-09-29'dan beri TÜM SINIFLAR tek liste (öğrenci sayısı az; bkz.
// weekly_leaderboard_all_grades.sql), geçici sahte kayıtlarla karışık (leaderboardSeed.ts).
// 2026-10-02'den beri tam ad (kullanıcı kararı) ya da öğrencinin seçtiği takma ad; isim sunucuda
// belirlenir (leaderboard_display_name, bkz. leaderboard_full_names_and_nickname.sql).
export function LeaderboardCard({ limit = 5, showSeeAll = true }: LeaderboardCardProps) {
  const { user, supabase } = useAuth();
  const isAdmin = useIsAdmin();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    // user.id'ye bakıyor, ham user nesnesine değil — AuthContext sekme odağa her geldiğinde
    // aynı kullanıcı için bile yeni bir user nesnesi üretiyor; burada tutulsaydı sekme
    // değiştirip dönüşte sıralama gereksiz yere yeniden çekilirdi.
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

  // Quiz modalı kapanınca sıralamayı sessizce tazele (eski veri ekranda kalır, yenisi gelince değişir).
  useEffect(() => {
    if (!user) return;
    return onQuizModalClosed(() => {
      getWeeklyLeaderboard(supabase).then((result) => setEntries(result));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase]);

  if (!user) return null;

  if (entries === null) {
    return <div aria-busy="true" aria-label="Sıralama yükleniyor" className={cx('h-80 animate-pulse rounded-[18px]', r.panel)} />;
  }

  const metaAvatar = (user.user_metadata?.avatar_url as string | undefined) || null;
  const enrichedEntries = entries.map((e) =>
    e.isMe && !e.avatarUrl && metaAvatar ? { ...e, avatarUrl: metaAvatar } : e
  );
  const me = enrichedEntries.find((e) => e.isMe);
  const topEntries = enrichedEntries.slice(0, limit);
  // Bir üst sıradakini geçmek için gereken soru — eşitlikte user_id'ye göre sıralandığı için
  // (bkz. get_weekly_leaderboard) geçmek kesin olarak +1 ister.
  const above = me && me.rank > 1 ? enrichedEntries[me.rank - 2] : null;
  const questionsToPass = above && me ? above.totalQuestions - me.totalQuestions + 1 : null;
  const showMeSeparately = !!me && !topEntries.some((e) => e.isMe);
  const max = enrichedEntries[0]?.totalQuestions ?? 0;
  const podium = topEntries.filter((e) => e.rank <= 3);
  const rest = topEntries.filter((e) => e.rank > 3);

  return (
    <div className="flex flex-col gap-5">
      {me && (
        <section aria-label="Senin konumun" className={cx(r.panel, s.me)}>
          <div className={s.meSide}>
            <StudentAvatar entry={me} variant="me" />
            <div className={s.meRank}>
              <div className="text-center">
                <div className={s.meRankNo}>{me.rank}</div>
                <div className={s.meRankLbl}>SIRA</div>
              </div>
            </div>
          </div>
          <div className={s.meText}>
            <span className={r.label}>Senin konumun · {me.totalQuestions} soru</span>
            <p className={s.meLine}>
              {me.rank === 1 ? (
                <>🥇 Bu hafta <b>1. sıradasın</b>, yerini koru!</>
              ) : (
                <>
                  <b>{me.rank - 1}. sıraya</b> çıkmak için <b>{questionsToPass} soru</b> daha çöz.
                </>
              )}
            </p>
            {above && (
              <span className={r.track} role="img" aria-label={`Bir üst sıraya yaklaşma: ${me.totalQuestions}/${above.totalQuestions + 1}`}>
                <span className={cx('block', r.fill)} style={{ width: `${Math.min(100, (me.totalQuestions / (above.totalQuestions + 1)) * 100)}%` }} />
              </span>
            )}
          </div>
        </section>
      )}

      {entries.length === 0 ? (
        <p className={cx('p-6 text-center text-sm text-muted-foreground', r.panel)}>
          Bu hafta henüz sıralama yok — soru çözmeye başla, ilk sen gir.
        </p>
      ) : (
        <>
          {podium.length > 0 && <Podium entries={podium} showRealMark={isAdmin} />}
          {(rest.length > 0 || showMeSeparately) && (
            <ol className={s.rows} aria-label="Sıralama">
              {rest.map((entry) => (
                <Row key={entry.rank} entry={entry} max={max} showRealMark={isAdmin} />
              ))}
              {showMeSeparately && me && (
                <>
                  <li className={s.gap} aria-hidden="true">•••</li>
                  <Row entry={me} max={max} showRealMark={isAdmin} />
                </>
              )}
            </ol>
          )}
        </>
      )}

      {showSeeAll && entries.length > 0 && (
        <Link href="/ilerlemem/siralama" className={cx('w-fit text-sm font-semibold hover:underline', r.accent)}>
          Tümünü gör →
        </Link>
      )}
    </div>
  );
}
