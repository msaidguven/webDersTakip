// Anlatıcı robot Bit'in çizimi (geçici; kullanıcı sonra kendi çizimini getirecek — yalnız bu dosya değişir).
// Ruh hâli göz/ağız/kolu değiştirir; konuşurken ağız oynar ve anten yanıp söner; upgraded: ders sonu ödülü
// (yıldız anteni + jet motoru).
export type BitMood = 'normal' | 'happy' | 'think' | 'wow' | 'oops';

const EYES: Record<BitMood, string> = {
  normal: '<circle cx="47" cy="52" r="6" class="bit-eye"/><circle cx="73" cy="52" r="6" class="bit-eye"/>',
  happy: '<path d="M40 55q7-10 14 0" class="bit-eyel"/><path d="M66 55q7-10 14 0" class="bit-eyel"/>',
  wow: '<circle cx="47" cy="51" r="8.5" class="bit-eye"/><circle cx="73" cy="51" r="8.5" class="bit-eye"/><circle cx="50" cy="48" r="2.6" fill="#fff"/><circle cx="76" cy="48" r="2.6" fill="#fff"/>',
  think: '<circle cx="50" cy="48" r="5" class="bit-eye"/><circle cx="76" cy="48" r="5" class="bit-eye"/>',
  oops: '<path d="M41 47l11 5-11 5" class="bit-eyel"/><path d="M79 47l-11 5 11 5" class="bit-eyel"/>',
};
const MOUTH: Record<BitMood, string> = { normal: 'M53 64q7 5 14 0', happy: 'M51 63q9 9 18 0', wow: 'M56 66q4-5 8 0q-4 5-8 0', think: 'M55 66h11', oops: 'M52 66q4-3 8 0t8 0' };

const STYLE = `
.bit-svg{overflow:visible;animation:bit-bob 3.2s ease-in-out infinite}
@keyframes bit-bob{50%{transform:translateY(-4px)}}
.bit-eye{fill:#6ff2ff}.bit-eyel{fill:none;stroke:#6ff2ff;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
.bit-mouth{fill:none;stroke:#6ff2ff;stroke-width:3.5;stroke-linecap:round;transform-box:fill-box;transform-origin:center}
.bit-talking .bit-mouth{animation:bit-talk .22s ease-in-out infinite alternate}@keyframes bit-talk{to{transform:scaleY(2.4)}}
.bit-ant{fill:#ffc531}.bit-talking .bit-ant{animation:bit-blink .4s steps(2) infinite}@keyframes bit-blink{50%{fill:#fff6c9}}
.bit-arm{transform-box:view-box;transform-origin:88px 98px}.bit-happy .bit-arm{animation:bit-wave .5s ease-in-out 3 alternate}@keyframes bit-wave{to{transform:rotate(-28deg)}}
.bit-flame{transform-box:fill-box;transform-origin:top;animation:bit-flame .18s ease-in-out infinite alternate}@keyframes bit-flame{to{transform:scaleY(1.35)}}
@media (prefers-reduced-motion:reduce){.bit-svg,.bit-svg *{animation:none!important}}
`;

function svg(mood: BitMood, upgraded: boolean): string {
  const arm = mood === 'oops' || mood === 'think' ? 'M88 98q18-8 12-46' : 'M88 98q16 6 18 18';
  return `<ellipse cx="60" cy="144" rx="30" ry="4" fill="#0002"/>
    ${upgraded ? '<path class="bit-flame" d="M48 128q12 26 24 0z" fill="#ffb238"/><path class="bit-flame" d="M53 128q7 15 14 0z" fill="#fff1a8"/>' : ''}
    <line x1="60" y1="24" x2="60" y2="9" stroke="#8d9ccc" stroke-width="3"/><circle class="bit-ant" cx="60" cy="8" r="5.5"/>
    ${upgraded ? '<line x1="44" y1="25" x2="36" y2="12" stroke="#8d9ccc" stroke-width="3"/><path d="M36 4l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#ffc531"/>' : ''}
    <rect x="9" y="44" width="11" height="20" rx="4" fill="#ff8a1f"/><rect x="100" y="44" width="11" height="20" rx="4" fill="#ff8a1f"/>
    <rect x="17" y="23" width="86" height="62" rx="22" fill="#eef2ff" stroke="#8d9ccc" stroke-width="3"/>
    <rect x="27" y="33" width="66" height="42" rx="14" fill="#1b2350"/>
    ${EYES[mood]}<path class="bit-mouth" d="${MOUTH[mood]}"/>
    <circle cx="35" cy="64" r="3.5" fill="#ff7aa8" opacity=".7"/><circle cx="85" cy="64" r="3.5" fill="#ff7aa8" opacity=".7"/>
    <path d="M32 98q-16 6-18 18" fill="none" stroke="#8d9ccc" stroke-width="6" stroke-linecap="round"/>
    <path class="bit-arm" d="${arm}" fill="none" stroke="#8d9ccc" stroke-width="6" stroke-linecap="round"/>
    <rect x="32" y="86" width="56" height="44" rx="15" fill="#eef2ff" stroke="#8d9ccc" stroke-width="3"/>
    <circle cx="60" cy="106" r="8" fill="${upgraded ? '#ffc531' : '#ff8a1f'}"/><circle cx="60" cy="106" r="3.5" fill="#fff8"/>`;
}

export default function BitRobot({ mood = 'normal', talking = false, upgraded = false, className = '' }: { mood?: BitMood; talking?: boolean; upgraded?: boolean; className?: string }) {
  return (
    <span className={`block ${talking ? 'bit-talking' : ''} bit-${mood} ${className}`}>
      <style>{STYLE}</style>
      {/* Sabit, kodda yazılmış SVG (dışarıdan veri yok). */}
      <svg viewBox="0 0 120 150" className="bit-svg block h-auto w-full" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg(mood, upgraded) }} />
    </span>
  );
}
