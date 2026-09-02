// QuizModal (app/panel/@modal altındaki intercepting route) kapanınca panel anasayfasının
// istatistiklerini/aktivitelerini/ilerlemesini otomatik tazeletmek için köprü — modal ve
// panel/page.tsx farklı route ağaçlarında (parallel route slot) render edildiğinden aralarında
// doğrudan prop/callback geçirilemiyor, bu yüzden panelLessonBridge'deki gibi küçük bir
// köprü modülü kullanılıyor (orada sessionStorage, burada anlık bir sinyal olduğu için window event).
const EVENT_NAME = 'panel:quiz-modal-closed';

export function emitQuizModalClosed() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function onQuizModalClosed(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}
