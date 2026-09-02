// app/panel/layout.tsx
// Panel altındaki tüm sayfalarda (page.tsx, aktiviteler, siralama) ortak: `modal` slotu
// panelden bir teste tıklandığında intercepting route ile dolduruluyor (bkz. app/panel/@modal).
// AuthProvider/MainLayout zaten kök layout'ta (app/layout.tsx) sağlandığı için burada
// tekrarlanmıyor.

export default function PanelLayout({
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
