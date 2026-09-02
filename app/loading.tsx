// app/loading.tsx — kök segmentte tanımlı olduğu için Next.js bunu sadece "/" için değil,
// kendi loading.tsx'i olmayan HER rota için (panel, ders içerik sayfaları, sınıf/ders/ünite/
// konu sayfaları vb.) devreye sokuyor. Eskiden burada SADECE anasayfaya özel bir iskelet
// (hafta seçici + sınıf kartları) vardı — başka bir sayfaya geçerken yanlış şekilli bir
// iskelet görünüyor, bu da tıklamanın hiç işe yaramadığı hissini güçlendiriyordu (kullanıcı
// bildirdi, 2026-09-02). Artık her sayfaya uyan, yuvarlak dönen genel bir gösterge var.
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-default">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );
}
