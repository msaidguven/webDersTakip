// Sidebar (profil, /panel/siralama, /panel/aktiviteler gibi panel anasayfası
// olmayan bir sayfadayken) bir derse tıklanınca önce /panel'e gidilmesi gerekiyor;
// hangi dersin seçileceğini URL'e (?lesson=..) koymak yerine (adres çubuğunda
// görünüp kalıcı bir link izlenimi verdiği için istenmedi) sekmeler arası bu
// sessionStorage köprüsüyle taşınıyor — panel anasayfası mount olunca bir kez okuyup siliyor.
const STORAGE_KEY = 'panel:pendingLessonId';

export function setPendingLessonId(lessonId: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, lessonId);
  } catch {
    // sessionStorage kapalıysa (gizli sekme vb.) sessizce yok say
  }
}

export function takePendingLessonId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = sessionStorage.getItem(STORAGE_KEY);
    if (id) sessionStorage.removeItem(STORAGE_KEY);
    return id;
  } catch {
    return null;
  }
}
