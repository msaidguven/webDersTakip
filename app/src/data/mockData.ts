import { NavItem } from '../models/types';

// Bu, panel/profil "app shell"ının kendi Sidebar/TopBar'ı için nav listesi — "Ana Sayfa"
// burada dashboard'u (/panel) ifade eder, genel siteye dönüş Sidebar'ın ayrı "Siteye Dön"
// linkinden yapılır (bkz. Sidebar.tsx). Hedefler gerçek sayfalarla eşleşiyor: ayrı bir
// "/units" veya "/stats" galerisi yok, bunlar panelin kendi bölümlerine (bkz.
// app/panel/page.tsx'teki id="uniteler") ya da mevcut /progress sayfasına yönleniyor;
// "/profile" değil "/profil" (bkz. app/profil).
export const navItems: NavItem[] = [
  { id: 'home', label: 'Ana Sayfa', icon: 'home', href: '/panel', isAction: false },
  { id: 'units', label: 'Üniteler', icon: 'book', href: '/panel#uniteler', isAction: false },
  { id: 'start', label: 'Başla', icon: 'play', href: '/', isAction: true },
  { id: 'stats', label: 'İstatistik', icon: 'chart-line', href: '/progress', isAction: false },
  { id: 'profile', label: 'Profil', icon: 'user', href: '/profil', isAction: false },
];
