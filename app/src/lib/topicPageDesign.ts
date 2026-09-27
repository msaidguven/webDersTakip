// Konu okuma sayfasının hangi tasarımla gösterileceği (kullanıcının 2026-09-27 isteği:
// mevcut tasarım "v1" olarak kalsın, modern taslak "v2" olarak yapılsın; "v2 kullanılsın"
// denince sadece bu satır 'v2' yapılır). Yayındaki tasarım ne olursa olsun, adrese
// ?tasarim=v1 / ?tasarim=v2 eklenerek diğeri önizlenebilir (bkz. app/ders/TopicDesignSwitch.tsx).
export type TopicPageDesign = 'v1' | 'v2';

export const TOPIC_PAGE_DESIGN: TopicPageDesign = 'v1';
