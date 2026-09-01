// user_time_based_stats.period_date bir "date" kolonu (saat/timezone taşımıyor); bu yüzden
// tarihi ISO string'in gün kısmıyla değil, yerel takvim gününe göre üretiyoruz — aksi halde
// UTC'ye çeviren toISOString() gece yarısına yakın saatlerde bir gün kayabilir.
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayDateString(): string {
  return toDateString(new Date());
}
