'use client';

import { useCallback, useEffect, useState } from 'react';

type SyncResult = {
  total: number;
  included: number;
  bySchoolType: Record<string, number>;
  excludedOther: number;
  cityMiss: number;
  districtMiss: number;
  cityMissSamples: string[];
  districtMissSamples: string[];
  written: number;
};

const TYPE_LABELS: Record<string, string> = { anaokulu: 'Anaokulu', ilkokul: 'İlkokul', ortaokul: 'Ortaokul', lise: 'Lise' };

export default function SchoolsSyncPanel() {
  const [count, setCount] = useState<number | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/admin/manage/schools-sync');
      const data = await res.json();
      if (res.ok) {
        setCount(data.count);
        setLastUpdatedAt(data.lastUpdatedAt);
      }
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function runSync() {
    setConfirmOpen(false);
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/manage/schools-sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Güncelleme başarısız');
        return;
      }
      setResult(data);
      loadStatus();
    } catch {
      setError('Güncelleme başarısız (ağ hatası)');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="py-4 sm:py-8">
      <header className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Okullar</h2>
        <p className="text-sm sm:text-base text-gray-400">MEB okul dizinini (il/ilçe/okul adı) senkronize et</p>
      </header>

      <div className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/5 p-4 sm:p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-gray-400 text-sm">Kayıtlı okul sayısı</p>
            <p className="text-2xl font-bold text-white">{loadingStatus ? '...' : (count ?? 0).toLocaleString('tr-TR')}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Son güncelleme</p>
            <p className="text-white text-sm">
              {loadingStatus ? '...' : lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString('tr-TR') : 'Hiç çalıştırılmadı'}
            </p>
          </div>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          MEB&apos;in resmi okul dizininden İlkokul, Ortaokul, Lise ve Anaokulu türündeki kurumları çeker; il/ilçe ile
          eşleştirip kaydeder. İşlem yaklaşık 1-2 dakika sürer, veritabanını bozmadan tekrar tekrar çalıştırılabilir
          (var olan kayıtlar güncellenir, yenileri eklenir).
        </p>

        <button
          onClick={() => setConfirmOpen(true)}
          disabled={syncing}
          className="w-full sm:w-auto px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-all"
        >
          {syncing ? 'Güncelleniyor... (1-2 dakika sürebilir)' : 'Okulları Güncelle'}
        </button>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-xl text-sm bg-red-500/10 text-red-300 border border-red-500/30">{error}</div>
        )}

        {result && (
          <div className="mt-4 px-4 py-3 rounded-xl text-sm bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 space-y-1">
            <p className="font-medium">Tamamlandı — {result.written.toLocaleString('tr-TR')} okul yazıldı</p>
            <p className="text-emerald-200/80">
              {Object.entries(result.bySchoolType)
                .map(([type, n]) => `${TYPE_LABELS[type] || type}: ${n.toLocaleString('tr-TR')}`)
                .join(' • ')}
            </p>
            <p className="text-emerald-200/60 text-xs">
              MEB toplam: {result.total.toLocaleString('tr-TR')} • Okul türü dışı hariç tutulan: {result.excludedOther.toLocaleString('tr-TR')} •
              İl eşleşmeyen: {result.cityMiss} • İlçe eşleşmeyen (il yine de kaydedildi): {result.districtMiss}
            </p>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111114] rounded-xl sm:rounded-2xl border border-white/10 w-full max-w-md p-4 sm:p-6">
            <h3 className="text-lg font-bold text-white mb-2">Okulları güncelle?</h3>
            <p className="text-gray-400 text-sm mb-4">
              MEB&apos;den ~50.000 okul çekilip veritabanına yazılacak. Bu işlem 1-2 dakika sürebilir, sayfadan ayrılmayın.
            </p>
            <div className="flex gap-2 sm:gap-3">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-white hover:bg-white/10 text-sm">
                Vazgeç
              </button>
              <button onClick={runSync} className="flex-1 px-4 py-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 text-sm">
                Başlat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
