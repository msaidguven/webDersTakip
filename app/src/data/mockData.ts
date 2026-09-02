import { NavItem } from '../models/types';

// Bu, panel/profil "app shell"ının kendi Sidebar/TopBar'ı için nav listesi — "Ana Sayfa"
// burada dashboard'u (/panel) ifade eder, genel siteye dönüş Sidebar'ın ayrı "Siteye Dön"
// linkinden yapılır (bkz. Sidebar.tsx). Hedefler gerçek sayfalarla eşleşiyor: ayrı bir
// "/units" galerisi yok, bunlar panelin kendi bölümlerine yönleniyor (bkz.
// app/panel/page.tsx'teki id="uniteler"); ayrı bir "İstatistik" sayfası da yok — panelin
// kendi İstatistik kartları (StatsRow) yeterli görüldüğü için /progress kaldırıldı
// (bkz. kullanıcıyla 2026-09-02 tartışması). "/profile" değil "/profil" (bkz. app/profil).
export const navItems: NavItem[] = [
  { id: 'home', label: 'Ana Sayfa', icon: 'home', href: '/panel', isAction: false },
  { id: 'units', label: 'Üniteler', icon: 'book', href: '/panel#uniteler', isAction: false },
  { id: 'start', label: 'Başla', icon: 'play', href: '/', isAction: true },
  { id: 'profile', label: 'Profil', icon: 'user', href: '/profil', isAction: false },
];
