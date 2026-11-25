'use client';

// Üye profil ve başarı kartı.
// Rozetler için BadgesList, ders notları/soru/konu paylaşımları için StudyNotesCard ortak bileşenleri kullanılır (bkz. GEMINI.md Kural 5).
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  EyeOff,
  Flame,
  MessageCircle,
  Share2,
  Swords,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { AuthPrompt } from '@/app/src/components/AuthPrompt';
import { BadgesList } from '@/app/src/components/progress/Badges';
import { StudyNotesCard } from '@/app/src/components/StudyNotesCard';
import { useMyGradeSlug } from '@/app/src/hooks/useMyGradeSlug';
import { computeBadges } from '@/app/src/lib/badges';
import {
  deleteStudyItem,
  fetchPublicSavedItems,
  setStudyItemVisibility,
  type SavedStudyItem,
} from '@/app/src/lib/savedStudyItems';
import { roboticFontVars } from '@/app/src/components/robotic/fonts';
import r from '@/app/src/components/robotic/robotic.module.css';
import { renderProfileCardBlob, triggerBlobDownload } from './shareProfileCard';

type ReactionKey = 'clap' | 'fire' | 'rival';

type PublicProfile = {
  display_name: string;
  avatar_url: string | null;
  grade_name: string | null;
  member_since: string | null;
  current_streak: number;
  longest_streak?: number | null;
  active_days?: number | null;
  weekly_questions: number;
  total_questions: number;
  week_active_days?: boolean[] | null;
  favorite_lesson?: string | null;
  viewer_weekly_questions?: number | null;
  clap_count?: number | null;
  fire_count?: number | null;
  rival_count?: number | null;
  my_reaction?: ReactionKey | null;
  is_public: boolean;
  is_me: boolean;
};

type ReactionState = {
  clap: number;
  fire: number;
  rival: number;
  mine: ReactionKey | null;
};

// Genel kimlik biçimi (public_profile_slug.sql): 12 karakter harf/rakam.
const SLUG = /^[A-Za-z0-9]{12}$/;
const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

const REACTIONS: { key: ReactionKey; emoji: string; label: string }[] = [
  { key: 'clap', emoji: '👏', label: 'Tebrikler' },
  { key: 'fire', emoji: '🔥', label: 'Serin harika' },
  { key: 'rival', emoji: '🚀', label: 'Böyle devam!' },
];

function memberSinceLabel(iso: string | null) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

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

export default function UyeClient({ slug }: { slug: string }) {
  const { user, loading, supabase } = useAuth();
  const myGradeSlug = useMyGradeSlug();
  const validSlug = SLUG.test(slug);

  const [card, setCard] = useState<PublicProfile | null | 'auth_required' | undefined>(undefined);
  const [savedItems, setSavedItems] = useState<SavedStudyItem[] | null>(null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [reactions, setReactions] = useState<ReactionState>({ clap: 0, fire: 0, rival: 0, mine: null });
  const [reacting, setReacting] = useState(false);
  const [reactionHint, setReactionHint] = useState<string | null>(null);

  const [sharingCard, setSharingCard] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !validSlug) return;
    let cancelled = false;

    Promise.all([
      supabase.rpc('get_public_profile', { p_slug: slug }),
      fetchPublicSavedItems(supabase, slug),
    ]).then(([profileRes, items]) => {
      if (cancelled) return;
      const { data, error } = profileRes;
      if (error) {
        if (!user && /authentication|permission/i.test(error.message)) {
          setCard('auth_required');
          return;
        }
        setCard(null);
        return;
      }
      const row = Array.isArray(data) ? (data[0] as PublicProfile | undefined) : undefined;
      if (row) {
        setReactions({
          clap: row.clap_count ?? 0,
          fire: row.fire_count ?? 0,
          rival: row.rival_count ?? 0,
          mine: (row.my_reaction as ReactionKey | null) ?? null,
        });
      }
      setCard(row ?? null);
      setSavedItems(items);
    });

    return () => {
      cancelled = true;
    };
  }, [loading, user, supabase, slug, validSlug]);

  const badges = useMemo(() => {
    if (!card || card === 'auth_required') return null;
    return computeBadges({
      last7: { answered: 0, accuracy: null },
      prev7: { answered: 0, accuracy: null },
      totalAnswered: card.total_questions,
      activeDays: card.active_days ?? (card.total_questions > 0 ? 1 : 0),
      currentStreak: card.current_streak,
      longestStreak: Math.max(card.longest_streak ?? 0, card.current_streak),
    });
  }, [card]);

  const shell = (body: React.ReactNode) => (
    <div className={`${roboticFontVars} ${r.root}`}>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-20 pt-6 sm:gap-6 sm:px-6 sm:pt-10">
        <Link
          href={user ? '/ilerlemem/siralama' : '/'}
          className={`inline-flex w-fit items-center gap-1.5 text-sm font-bold hover:underline ${r.accent}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {user ? 'Haftalık sıralama' : 'Ana sayfa'}
        </Link>
        {body}
      </main>
    </div>
  );

  if (!validSlug) {
    return shell(
      <section className={`flex flex-col items-center gap-3 p-8 text-center ${r.panel}`}>
        <span className={`h-12 w-12 ${r.chipBox}`} aria-hidden="true"><EyeOff className="h-5 w-5" /></span>
        <h1 className={`text-xl font-bold uppercase text-default ${r.display}`}>Bu profil gizli</h1>
        <p className="text-sm text-muted-foreground">Bu üye profil kartını diğer üyelere açmamış.</p>
      </section>
    );
  }

  if (loading || card === undefined) {
    return shell(<div aria-busy="true" aria-label="Profil yükleniyor" className={`h-80 animate-pulse rounded-[18px] ${r.panel}`} />);
  }

  if (card === 'auth_required') {
    return shell(<AuthPrompt message="Bu üyenin başarı kartını görmek ve yarışa katılmak için giriş yap." />);
  }

  if (!card) {
    return shell(
      <section className={`flex flex-col items-center gap-3 p-8 text-center ${r.panel}`}>
        <span className={`h-12 w-12 ${r.chipBox}`} aria-hidden="true"><EyeOff className="h-5 w-5" /></span>
        <h1 className={`text-xl font-bold uppercase text-default ${r.display}`}>Bu profil gizli</h1>
        <p className="text-sm text-muted-foreground">Bu üye profil kartını diğer üyelere açmamış.</p>
      </section>
    );
  }

  const initials = getInitials(card.display_name);
  const avatarUrl =
    card.avatar_url?.trim() ||
    (card.is_me ? ((user?.user_metadata?.avatar_url as string | undefined)?.trim() ?? null) : null);
  const showAvatarImg = !!avatarUrl && failedAvatarUrl !== avatarUrl;
  const since = memberSinceLabel(card.member_since);
  const earnedBadges = badges?.filter((b) => b.earned) ?? [];
  const weekDays = Array.isArray(card.week_active_days) && card.week_active_days.length === 7 ? card.week_active_days : null;
  const activeWeekCount = weekDays ? weekDays.filter(Boolean).length : 0;

  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/uye/${slug}` : `https://www.derstakip.net/uye/${slug}`;
  const shareMessage =
    card.current_streak > 0
      ? `🔥 DersTakip'te ${card.current_streak} günlük serideyim, bu hafta ${card.weekly_questions} soru çözdüm! Beni geçebilir misin? ${profileUrl}`
      : `⚡ DersTakip'te toplam ${card.total_questions} soru çözdüm! Haftalık sıralamada yarışalım: ${profileUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopiedLink(true);
      setShareFeedback(null);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setShareFeedback('Bağlantı kopyalanamadı.');
    }
  };

  const buildCardBlob = () =>
    renderProfileCardBlob({
      displayName: card.display_name,
      avatarUrl: showAvatarImg ? avatarUrl : null,
      initials,
      gradeName: card.grade_name,
      currentStreak: card.current_streak,
      weeklyQuestions: card.weekly_questions,
      totalQuestions: card.total_questions,
      weekActiveDays: weekDays ?? [false, false, false, false, false, false, false],
      favoriteLesson: card.favorite_lesson ?? null,
      earnedBadges,
    });

  const handleShareCard = async () => {
    setSharingCard(true);
    setShareFeedback(null);
    try {
      const blob = await buildCardBlob();
      const file = new File([blob], 'derstakip-basari-karti.png', { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
      if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
        await nav.share({
          title: `${card.display_name} · DersTakip Başarı Kartı`,
          text: shareMessage,
          files: [file],
        });
      } else {
        triggerBlobDownload(blob, 'derstakip-basari-karti.png');
        await navigator.clipboard?.writeText(profileUrl).catch(() => undefined);
        setShareFeedback('Başarı kartı görseli indirildi ve profil bağlantın panoya kopyalandı!');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setShareFeedback('Kart hazırlanırken bir sorun oluştu, tekrar dener misin?');
    } finally {
      setSharingCard(false);
    }
  };

  const handleDownloadCard = async () => {
    setSharingCard(true);
    setShareFeedback(null);
    try {
      const blob = await buildCardBlob();
      triggerBlobDownload(blob, 'derstakip-basari-karti.png');
      setShareFeedback('Başarı kartın PNG olarak indirildi!');
    } catch {
      setShareFeedback('Görsel indirilemedi, tekrar dener misin?');
    } finally {
      setSharingCard(false);
    }
  };

  const handleReaction = async (key: ReactionKey) => {
    if (!user) {
      setReactionHint('Motivasyon tepkisi bırakmak için giriş yapmalısın.');
      return;
    }
    if (reacting || card.is_me) return;
    setReactionHint(null);

    const prev = reactions;
    const nextMine = prev.mine === key ? null : key;
    const optimistic: ReactionState = {
      clap: prev.clap - (prev.mine === 'clap' ? 1 : 0) + (nextMine === 'clap' ? 1 : 0),
      fire: prev.fire - (prev.mine === 'fire' ? 1 : 0) + (nextMine === 'fire' ? 1 : 0),
      rival: prev.rival - (prev.mine === 'rival' ? 1 : 0) + (nextMine === 'rival' ? 1 : 0),
      mine: nextMine,
    };
    setReactions(optimistic);
    setReacting(true);

    try {
      const { data, error } = await supabase.rpc('react_to_public_profile', {
        p_slug: slug,
        p_reaction: nextMine,
      });
      if (error) throw error;
      const row = Array.isArray(data)
        ? (data[0] as { clap_count: number; fire_count: number; rival_count: number; my_reaction: ReactionKey | null } | undefined)
        : undefined;
      if (row) {
        setReactions({
          clap: row.clap_count,
          fire: row.fire_count,
          rival: row.rival_count,
          mine: row.my_reaction ?? null,
        });
      }
    } catch {
      setReactions(prev);
      setReactionHint('Tepki kaydedilemedi, biraz sonra tekrar dene.');
    } finally {
      setReacting(false);
    }
  };

  const handleDeleteSavedItem = async (id: number) => {
    const prev = savedItems;
    setSavedItems((cur) => (cur ? cur.filter((x) => x.id !== id) : cur));
    try {
      await deleteStudyItem(supabase, id);
    } catch {
      setSavedItems(prev);
    }
  };

  const handleToggleSavedPublic = async (id: number, nextPublic: boolean) => {
    const prev = savedItems;
    setSavedItems((cur) => (cur ? cur.map((x) => (x.id === id ? { ...x, isPublic: nextPublic } : x)) : cur));
    try {
      await setStudyItemVisibility(supabase, id, nextPublic);
    } catch {
      setSavedItems(prev);
    }
  };

  const stats = [
    { label: 'Seri', value: `${card.current_streak} gün`, isStreak: true },
    { label: 'Bu hafta', value: `${card.weekly_questions} soru`, isStreak: false },
    { label: 'Toplam', value: `${card.total_questions} soru`, isStreak: false },
  ];

  const viewerWeekly = typeof card.viewer_weekly_questions === 'number' ? card.viewer_weekly_questions : null;
  const duelMax = viewerWeekly !== null ? Math.max(1, card.weekly_questions, viewerWeekly) : 1;
  const diff = viewerWeekly !== null ? card.weekly_questions - viewerWeekly : 0;
  const quizHref = myGradeSlug ? `/soru-bankasi/${myGradeSlug}` : '/soru-bankasi';
  const browseLessonsHref = myGradeSlug ? `/${myGradeSlug}` : '/ders';

  return shell(
    <>
      {card.is_me && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm ${
            card.is_public
              ? `${r.neonBorder} ${r.tint}`
              : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          }`}
        >
          <span>
            {card.is_public
              ? 'Bu senin başarı kartın — arkadaşlarınla paylaşabilirsin.'
              : 'Profilin şu an gizli; bağlantı paylaştığında açılması için görünür yapmalısın.'}
          </span>
          <Link href="/profil/ayarlar" className="font-semibold underline">
            Ayarlar
          </Link>
        </div>
      )}

      {/* 1. KİMLİK + PAYLAŞIM + TEPKİ SAYAÇLARI */}
      <section aria-labelledby="uye-ad" className={`flex flex-col items-center gap-5 p-6 text-center sm:p-7 ${r.panel} ${r.hero}`}>
        <span className={r.scan} aria-hidden="true" />
        <div className={`grid h-28 w-28 place-items-center overflow-hidden p-[3px] ${r.brandChip} !rounded-full`}>
          {showAvatarImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailedAvatarUrl(avatarUrl)}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span className={`text-4xl ${r.statValue} ${r.accent}`}>{initials}</span>
          )}
        </div>

        <div>
          <h1 id="uye-ad" className={`text-3xl leading-tight ${r.chrome}`}>
            {card.display_name}
          </h1>
          <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Özet">
            {card.grade_name && <li className={r.badge}>{card.grade_name}</li>}
            {card.favorite_lesson && (
              <li className={r.badge}>
                <Zap className="mr-1 h-3 w-3" aria-hidden="true" />
                {card.favorite_lesson}
              </li>
            )}
            {since && <li className={r.badge}>{since} üyesi</li>}
          </ul>
        </div>

        {/* Motivasyon Tepkileri: Her zaman sayaçlı (0 dahil); başkasının kartında tıklanabilir, kendi kartında alınan tepki göstergesi */}
        <div className="flex w-full flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Motivasyon tepkileri">
            {REACTIONS.map(({ key, emoji, label }) => {
              const active = reactions.mine === key;
              const count = reactions[key];
              if (card.is_me) {
                return (
                  <span
                    key={key}
                    title={`Arkadaşlarından aldığın "${label}" tepkisi`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--edge)] bg-[var(--panel-solid)] px-3.5 py-1 text-xs font-bold text-default sm:text-sm"
                  >
                    <span aria-hidden="true">{emoji}</span>
                    <span>{label}</span>
                    <span className={`ml-0.5 rounded-full bg-[color-mix(in_srgb,var(--neon)_14%,transparent)] px-2 py-0.5 text-[11px] font-extrabold ${r.accent}`}>
                      {count}
                    </span>
                  </span>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  disabled={reacting}
                  aria-pressed={active}
                  onClick={() => void handleReaction(key)}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all sm:text-sm ${
                    active
                      ? `${r.neonBorder} ${r.tint} shadow-[0_0_16px_-4px_var(--glow)]`
                      : 'border-[var(--edge)] bg-[var(--panel-solid)] text-default hover:border-[var(--neon)]'
                  }`}
                >
                  <span aria-hidden="true">{emoji}</span>
                  <span>{label}</span>
                  <span
                    className={`ml-0.5 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                      active
                        ? `bg-[color-mix(in_srgb,var(--neon)_20%,transparent)] ${r.accent}`
                        : 'bg-[var(--track)] text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {reactionHint && (
            <p role="status" className="text-xs text-muted-foreground">
              {reactionHint}{' '}
              {!user && (
                <Link href={`/login?next=/uye/${slug}`} className={`font-semibold underline ${r.accent}`}>
                  Giriş yap
                </Link>
              )}
            </p>
          )}
        </div>

        {/* KENDİ KARTIYSA: Başarı Kartı Paylaşım Aksiyonları */}
        {card.is_me && (
          <div className="flex w-full flex-col items-center gap-2.5 border-t border-[var(--edge)] pt-4">
            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void handleShareCard()}
                disabled={sharingCard}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold sm:text-sm disabled:opacity-60 ${r.btnNeon} ${r.btnText}`}
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                {sharingCard ? 'Kart hazırlanıyor…' : 'Başarı Kartımı Paylaş'}
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadCard()}
                disabled={sharingCard}
                title="Başarı kartını görsel (PNG) olarak indir"
                className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold sm:text-sm disabled:opacity-60 ${r.btnGhost}`}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                PNG İndir
              </button>

              {card.is_public && (
                <>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold sm:text-sm ${r.item} ${r.itemHover}`}
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    WhatsApp
                  </a>

                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold sm:text-sm ${r.item} ${r.itemHover}`}
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                        Kopyalandı
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        Linki Kopyala
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            {shareFeedback && (
              <p role="status" className={`text-xs font-semibold ${r.accent}`}>
                {shareFeedback}
              </p>
            )}
          </div>
        )}
      </section>

      {/* 2. SAYAÇLAR + BU HAFTANIN AKTİF GÜNLERİ */}
      <section aria-label="Çalışma istatistikleri" className="flex flex-col gap-3">
        <dl className="grid grid-cols-3 gap-3">
          {stats.map((st) => (
            <div key={st.label} className={`flex flex-col gap-1 px-3 py-3 text-center sm:px-4 ${r.stat}`}>
              <dt className={r.label}>{st.label}</dt>
              <dd className={`flex items-center justify-center gap-1 text-base sm:text-lg ${r.statValue}`}>
                {st.isStreak && <Flame className="h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />}
                {st.value}
              </dd>
            </div>
          ))}
        </dl>

        {weekDays && (
          <div className={`flex flex-col gap-3 p-4 sm:p-5 ${r.panel}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={r.label}>Bu haftaki çalışma düzeni</span>
              <span className={`text-xs font-bold ${r.accent}`}>{activeWeekCount} / 7 gün aktif</span>
            </div>
            <ul className="grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Pazartesiden pazara aktif günler">
              {DAY_LABELS.map((dayName, idx) => {
                const active = Boolean(weekDays[idx]);
                return (
                  <li
                    key={dayName}
                    aria-label={`${dayName}: ${active ? 'çalışıldı' : 'henüz çalışılmadı'}`}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2 text-center transition-colors ${
                      active
                        ? `${r.neonBorder} ${r.tint} shadow-[0_0_14px_-6px_var(--glow)]`
                        : 'border-[var(--edge)] bg-[var(--panel-solid)] opacity-65'
                    }`}
                  >
                    <span className={`text-[11px] font-bold sm:text-xs ${active ? r.accent : 'text-muted-foreground'}`}>
                      {dayName}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full ${active ? 'bg-[var(--neon)] shadow-[0_0_8px_var(--neon)]' : 'bg-[var(--track)]'}`}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* 3. REKABET / DÜELLO KUTUSU (!is_me) VEYA MİSAFİR DAVETİ */}
      {!card.is_me && user && viewerWeekly !== null && (
        <section aria-labelledby="rekabet-baslik" className={`flex flex-col gap-4 p-5 sm:p-6 ${r.panel}`}>
          <div className="flex items-center gap-2.5">
            <span className={`h-10 w-10 shrink-0 ${r.chipBox}`} aria-hidden="true">
              <Swords className="h-5 w-5" />
            </span>
            <div>
              <h2 id="rekabet-baslik" className={`text-base font-bold uppercase text-default ${r.display}`}>
                Sen vs. {card.display_name}
              </h2>
              <p className="text-xs text-muted-foreground">Bu haftaki soru temposu karşılaştırması</p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="truncate text-default">{card.display_name}</span>
                <span className={r.mono}>{card.weekly_questions} soru</span>
              </div>
              <span className={r.track} aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-amber-500/85"
                  style={{ width: `${Math.max(4, Math.round((card.weekly_questions / duelMax) * 100))}%` }}
                />
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className={r.accent}>Sen</span>
                <span className={`${r.mono} ${r.accent}`}>{viewerWeekly} soru</span>
              </div>
              <span className={r.track} aria-hidden="true">
                <span
                  className={`block ${r.fill}`}
                  style={{ width: `${Math.max(4, Math.round((viewerWeekly / duelMax) * 100))}%` }}
                />
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-default">
              {diff > 0 ? (
                <>
                  Önüne geçmek için <b className={r.accent}>{diff + 1} soru</b> daha çöz!
                </>
              ) : diff === 0 ? (
                <>
                  Baş başasınız! <b className={r.accent}>1 soru</b> çözüp öne geç!
                </>
              ) : (
                <>
                  Bu hafta <b className={r.accent}>{Math.abs(diff)} soru</b> farkla öndesin, temponu koru!
                </>
              )}
            </p>
            <Link
              href={quizHref}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold ${r.btnNeon} ${r.btnText}`}
            >
              Hemen Soru Çöz
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      {!user && (
        <section aria-labelledby="davet-baslik" className={`flex flex-col items-center gap-3 p-6 text-center ${r.panel} ${r.neonBorder}`}>
          <h2 id="davet-baslik" className={`text-lg font-bold uppercase text-default ${r.display}`}>
            Sen de {card.display_name} ile yarışmak ister misin?
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Ücretsiz hesabını aç, kendi sınıfının testlerini çözerek haftalık sıralamaya gir ve rozetleri topla!
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-2.5">
            <Link
              href="/register"
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold ${r.btnNeon} ${r.btnText}`}
            >
              Ücretsiz Katıl
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={`/login?next=/uye/${slug}`}
              className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold ${r.btnGhost}`}
            >
              Giriş Yap
            </Link>
          </div>
        </section>
      )}

      {/* 4. DERS NOTLARI, SORU VE KONU PAYLAŞIMLARI (Ortak StudyNotesCard bileşeni) */}
      <StudyNotesCard
        items={savedItems}
        isOwner={card.is_me}
        title={card.is_me ? 'Ders Notlarım ve Paylaşımlarım' : 'Paylaştığı Notlar ve Sorular'}
        headingId="uye-ders-notlari"
        emptyBrowseHref={browseLessonsHref}
        onDelete={card.is_me ? handleDeleteSavedItem : undefined}
        onTogglePublic={card.is_me ? handleToggleSavedPublic : undefined}
      />

      {/* 5. ROZETLER (İlerlemem ile birebir aynı ortak BadgesList bileşeni, mobilde kompakt 4 sütun) */}
      <BadgesList
        badges={badges}
        title={card.is_me ? 'Rozetlerim' : 'Rozetler'}
        headingId="uye-rozetler"
        hideLockedProgress={!card.is_me}
      />
    </>
  );
}
