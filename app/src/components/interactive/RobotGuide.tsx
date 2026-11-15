'use client';

// Etkileşimli dersin anlatıcı karakteri "Atom" (2026-11-03; eski adı Bit — "bit" ile alay edilebileceği için
// değişti). Çizim kullanıcının getirdiği atom karakteri temel alınarak uyarlandı: küçük boyutta yüz seçilsin diye
// görünüm kırpıldı ve çekirdek büyüdü, tepedeki anten kaldırıldı (üstteki elektronla üst üste biniyordu).
// Ruh hâli göz + ağızla (normal/happy/think/wow/oops); konuşurken ağız oynar, yörüngeler hep yavaşça döner;
// upgraded = ders sonu ödülü (altın parıltı). Ad ve çizim değişirse yalnız bu dosya + guide.ts ROBOT_NAME.
import { useId } from 'react';

export type RobotMood = 'normal' | 'happy' | 'think' | 'wow' | 'oops';

const INK = '#1A237E';
const EYES: Record<RobotMood, string> = {
  normal: `<ellipse cx="86" cy="102" rx="5.5" ry="7.5" fill="${INK}"/><circle cx="84.3" cy="99.3" r="2.3" fill="#fff"/><ellipse cx="114" cy="102" rx="5.5" ry="7.5" fill="${INK}"/><circle cx="112.3" cy="99.3" r="2.3" fill="#fff"/>`,
  happy: `<path d="M79 104q7-10 14 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M107 104q7-10 14 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  wow: `<circle cx="86" cy="101" r="8" fill="${INK}"/><circle cx="83.5" cy="98" r="3" fill="#fff"/><circle cx="114" cy="101" r="8" fill="${INK}"/><circle cx="111.5" cy="98" r="3" fill="#fff"/>`,
  think: `<ellipse cx="88" cy="99" rx="5" ry="6.5" fill="${INK}"/><circle cx="87" cy="96" r="2" fill="#fff"/><ellipse cx="116" cy="99" rx="5" ry="6.5" fill="${INK}"/><circle cx="115" cy="96" r="2" fill="#fff"/>`,
  oops: `<path d="M80 96l11 6-11 6" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M120 96l-11 6 11 6" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
};
const MOUTH: Record<RobotMood, string> = {
  normal: 'M92 114 Q100 123 108 114',
  happy: 'M89 112 Q100 127 111 112',
  wow: 'M96 117 Q100 111 104 117 Q100 123 96 117',
  think: 'M94 118 H107',
  oops: 'M91 118 q4.5 -4 9 0 t9 0',
};

const STYLE = `
.atom-svg{overflow:visible;animation:atom-bob 3.2s ease-in-out infinite}
@keyframes atom-bob{50%{transform:translateY(-4px)}}
.atom-orbits{transform-box:view-box;transform-origin:100px 105px;animation:atom-spin 18s linear infinite}
.atom-talking .atom-orbits{animation-duration:6s}
@keyframes atom-spin{to{transform:rotate(360deg)}}
.atom-mouth{transform-box:fill-box;transform-origin:center}
.atom-talking .atom-mouth{animation:atom-talk .22s ease-in-out infinite alternate}
@keyframes atom-talk{to{transform:scaleY(1.9)}}
.atom-happy .atom-core{animation:atom-hop .45s ease-in-out 2 alternate;transform-box:fill-box;transform-origin:bottom}
@keyframes atom-hop{to{transform:translateY(-6px) scale(1.04)}}
.atom-oops .atom-core{animation:atom-shake .12s linear 4 alternate;transform-box:fill-box;transform-origin:center}
@keyframes atom-shake{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}
.atom-spark{animation:atom-twinkle 1.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes atom-twinkle{50%{transform:scale(.6);opacity:.5}}
@media (prefers-reduced-motion:reduce){.atom-svg,.atom-svg *{animation:none!important}}
`;

function svg(id: string, mood: RobotMood, upgraded: boolean): string {
  const glow = upgraded ? '#FFD54F' : '#FFAB40';
  return `<defs>
    <radialGradient id="${id}g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${glow}" stop-opacity="${upgraded ? 0.7 : 0.3}"/><stop offset="100%" stop-color="#FF5722" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}c" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FF7043"/><stop offset="50%" stop-color="#FF5722"/><stop offset="100%" stop-color="#E64A19"/></linearGradient>
    <linearGradient id="${id}e" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00E5FF"/><stop offset="100%" stop-color="#00B0FF"/></linearGradient>
  </defs>
  <circle cx="100" cy="105" r="${upgraded ? 86 : 75}" fill="url(#${id}g)"/>
  <g class="atom-orbits">
    <ellipse cx="100" cy="105" rx="75" ry="24" fill="none" stroke="#64B5F6" stroke-width="3.5" opacity=".7" transform="rotate(-30 100 105)" stroke-dasharray="8 4"/>
    <ellipse cx="100" cy="105" rx="75" ry="24" fill="none" stroke="#4DD0E1" stroke-width="3.5" opacity=".7" transform="rotate(30 100 105)"/>
    <ellipse cx="100" cy="105" rx="75" ry="22" fill="none" stroke="#80D8FF" stroke-width="4" opacity=".85" transform="rotate(90 100 105)"/>
    <circle cx="38" cy="70" r="10" fill="#00E5FF" opacity=".3"/><circle cx="38" cy="70" r="7" fill="url(#${id}e)"/>
    <circle cx="162" cy="140" r="10" fill="#00E5FF" opacity=".3"/><circle cx="162" cy="140" r="7" fill="url(#${id}e)"/>
    <circle cx="100" cy="30" r="10" fill="#00E5FF" opacity=".3"/><circle cx="100" cy="30" r="7" fill="url(#${id}e)"/>
  </g>
  <g class="atom-core">
    <circle cx="100" cy="106" r="46" fill="url(#${id}c)"/>
    <path d="M71 86 A33 33 0 0 1 121 73" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/>
    ${EYES[mood]}
    <circle cx="77" cy="113" r="5" fill="#FF8A80" opacity=".6"/><circle cx="123" cy="113" r="5" fill="#FF8A80" opacity=".6"/>
    <path class="atom-mouth" d="${MOUTH[mood]}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
  </g>
  <path d="M 32 90 A 75 24 0 0 0 148 128" fill="none" stroke="#64B5F6" stroke-width="3.5" opacity=".9" transform="rotate(-30 100 105)"/>
  ${upgraded ? '<path class="atom-spark" d="M156 44l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#FFC531"/><path class="atom-spark" d="M42 150l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFC531" style="animation-delay:.5s"/>' : ''}`;
}

export default function RobotGuide({ mood = 'normal', talking = false, upgraded = false, className = '' }: { mood?: RobotMood; talking?: boolean; upgraded?: boolean; className?: string }) {
  // Aynı sayfada birden çok kopya olabilir (balon + bitiş ekranı): gradyan kimlikleri çakışmasın.
  const id = `atom${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <span className={`block ${talking ? 'atom-talking' : ''} atom-${mood} ${className}`}>
      <style>{STYLE}</style>
      {/* Sabit, kodda yazılmış SVG (dışarıdan veri yok). viewBox kırpık: küçük boyutta yüz seçilsin. */}
      <svg viewBox="22 22 156 160" className="atom-svg block h-auto w-full" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg(id, mood, upgraded) }} />
    </span>
  );
}
