'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from './icons';
import { useAuth } from '../context/AuthContext';

type Notification = {
  id: number;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const POLL_INTERVAL_MS = 30000;

function formatRelative(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  return new Date(iso).toLocaleDateString('tr-TR');
}

// Header'daki bildirim zili. Projede henüz Supabase Realtime kullanılmıyor (ilk
// eklendiğinde bilinçli bir tercih — bkz. commit notu); cevaplar zaten dakikalar
// süren bir kuyruktan geldiği için (bkz. /api/rag/process-queue) 30 sn'lik bir
// polling gecikmesi kullanıcı için fark etmiyor, realtime'ın karmaşıklığını haklı
// çıkarmıyor. Okuma/okundu-işaretleme doğrudan client'tan RLS ile yapılıyor
// (bkz. supabase/migrations/notifications.sql) — ayrı bir API route'una gerek yok,
// sadece kendi satırlarına dokunabiliyor.
export function NotificationBell() {
  const { isAuthenticated, user, supabase } = useAuth();
  const [items, setItems] = React.useState<Notification[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const load = React.useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, link, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setItems((data as Notification[] | null) || []);
  }, [supabase, user]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    load();
    const timer = window.setInterval(load, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, load]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  async function markRead(notification: Notification) {
    if (notification.read_at) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read_at: now } : n)));
    await supabase.from('notifications').update({ read_at: now }).eq('id', notification.id);
  }

  async function markAllRead() {
    if (!user?.id || unreadCount === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase.from('notifications').update({ read_at: now }).eq('user_id', user.id).is('read_at', null);
  }

  if (!isAuthenticated) {
    return (
      <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface border border-default flex items-center justify-center">
        <Icon name="bell" className="text-muted-foreground" size={18} />
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Bildirimler"
        className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface border border-default flex items-center justify-center hover:bg-surface-elevated hover:border-default/20 transition-all"
      >
        <Icon name="bell" className="text-muted-foreground" size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-zinc-200 dark:border-default bg-white dark:bg-surface shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-default">
            <span className="text-sm font-semibold text-default">Bildirimler</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-indigo-500 hover:text-indigo-400 font-medium">
                Tümünü okundu yap
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">Henüz bildirimin yok.</p>
            ) : (
              items.map((n) => {
                const content = (
                  <div
                    className={`px-4 py-3 border-b border-zinc-100 dark:border-default/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-surface-elevated transition-colors ${
                      !n.read_at ? 'bg-indigo-50/60 dark:bg-indigo-500/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-default truncate">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[11px] text-muted-foreground mt-1">{formatRelative(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => {
                      markRead(n);
                      setIsOpen(false);
                    }}
                    className="block"
                  >
                    {content}
                  </Link>
                ) : (
                  <button key={n.id} onClick={() => markRead(n)} className="block w-full text-left">
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
