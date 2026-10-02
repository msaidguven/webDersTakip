'use client';

// Profilim → Ayarlar (2026-10-02): kullanıcıya sorulan tercihlerin kalıcı yeri. Şimdilik akşam
// hatırlatması (cihaz başına Web Push) ve günlük soru hedefi; yeni tercihler buraya eklenir.
// Anasayfadaki "Hatırlatma al" kartı ve İlerlemem'deki hedef seçici bu ayarlara kısayoldur —
// aynı kodu (usePushReminder, DailyGoalPicker) kullanırlar. /profil#ayarlar ile doğrudan açılır.
import { Bell, BellOff, Share } from 'lucide-react';
import { usePushReminder } from '@/app/src/hooks/usePushReminder';
import { DailyGoalPicker } from '@/app/src/components/progress/DailyGoalPicker';

export function SettingsCard({ isStudent }: { isStudent: boolean }) {
  return (
    <section id="ayarlar" className="scroll-mt-24 bg-surface-elevated border border-default rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '340ms' }}>
      <h3 className="mb-5 text-lg font-semibold text-default flex items-center gap-2">
        <span className="text-xl">⚙️</span> Ayarlar
      </h3>
      <div className="flex flex-col gap-5 [&>*+*]:border-t [&>*+*]:border-default [&>*+*]:pt-5">
        <ReminderSetting />
        {isStudent && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-semibold text-default">Günlük soru hedefi</p>
              <p className="text-sm text-muted-foreground">Her gün kaç soru çözmeyi hedefliyorsun? 5 ile 100 arasında seçebilirsin.</p>
            </div>
            <DailyGoalPicker variant="full" />
          </div>
        )}
      </div>
    </section>
  );
}

function ReminderSetting() {
  const { state, subscribe, unsubscribe } = usePushReminder();
  const on = state === 'subscribed';
  const canToggle = state === 'available' || state === 'subscribed' || state === 'error';

  const hint =
    state === 'unsupported'
      ? 'Bu tarayıcı bildirimleri desteklemiyor. Chrome, Edge ya da Firefox ile deneyebilirsin.'
      : state === 'ios-install'
        ? null
        : state === 'denied'
          ? 'Bildirim izni kapalı. Tarayıcı ayarlarından bu site için bildirimlere izin verirsen buradan açabilirsin.'
          : state === 'error'
            ? 'Bir sorun oldu, tekrar dener misin?'
            : 'O gün hiç soru çözmediysen akşam 19:00’da tek bir hatırlatma. Bu ayar sadece bu cihaz için geçerli.';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          {state === 'denied' || state === 'unsupported' ? <BellOff className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" /> : <Bell className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />}
        </span>
        <div>
          <p id="hatirlatma-etiket" className="font-semibold text-default">Akşam hatırlatması</p>
          <p className="text-sm text-muted-foreground">
            {state === 'ios-install' ? (
              <>
                iPhone’da hatırlatma için önce Safari’de <Share className="inline h-3.5 w-3.5 align-[-2px]" aria-label="Paylaş" /> → “Ana Ekrana Ekle” ile siteyi ekle, oradan açıp bu ayarı aç.
              </>
            ) : (
              hint
            )}
          </p>
        </div>
      </div>
      {state !== 'loading' && (canToggle || state === 'working') && (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="hatirlatma-etiket"
          disabled={state === 'working'}
          onClick={() => void (on ? unsubscribe() : subscribe())}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
            on ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      )}
    </div>
  );
}
