// Soru bankası test oynatıcısının veri adresleri. useQuizTestLauncher'dan ayrı dosyada: aktivite
// listesi (getRecentActivities) bunları kullanıyor ama oynatıcıyı (QuizWithAsk) paketine çekmemeli.
export function topicTestEndpoint(gradeSlug: string, lessonSlug: string, unitSlug: string, topicSlug: string) {
  return `/api/soru-bankasi/topic-test?gradeSlug=${gradeSlug}&lessonSlug=${lessonSlug}&unitSlug=${unitSlug}&topicSlug=${topicSlug}`;
}

export function unitTestEndpoint(gradeSlug: string, lessonSlug: string, unitSlug: string) {
  return `/api/soru-bankasi/unit-test?gradeSlug=${gradeSlug}&lessonSlug=${lessonSlug}&unitSlug=${unitSlug}`;
}
