// user_time_based_stats.period_date bir "date" kolonu (saat/timezone taşımıyor); bu yüzden
// tarihi ISO string'in gün kısmıyla değil, yerel takvim gününe göre üretiyoruz — aksi halde
// UTC'ye çeviren toISOString() gece yarısına yakın saatlerde bir gün kayabilir.
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayDateString(): string {
  return toDateString(new Date());
}

// user_time_based_stats'ın haftalık satırlarındaki period_date, o haftanın Pazartesi'si
// (Türkiye/Avrupa haftası) — lider tablosu sorgusu bu tarihle eşleşmeli.
export function currentWeekStartDateString(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Pazar, 1=Pazartesi, ... 6=Cumartesi
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  return toDateString(monday);
}
