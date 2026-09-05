// app/soru-bankasi/layout.tsx
// Panelinkiyle (app/panel/layout.tsx) birebir aynı desen: `modal` slotu, soru bankasından
// "Teste Başla"/"Devam Et" tıklandığında intercepting route ile dolduruluyor (bkz.
// app/soru-bankasi/@modal). Böylece test aynı sayfanın üzerinde overlay olarak açılır,
// kullanıcı soru bankasından hiç ayrılmamış hissi yaşar (kullanıcının 2026-09-05 isteği).

export default function SoruBankasiLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
