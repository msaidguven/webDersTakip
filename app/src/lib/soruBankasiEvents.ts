// Soru bankası konu sayfasındaki bağımsız client bileşenleri arasında (aynı sayfada, farklı
// ağaçlarda) haberleşme için window event adları.
// ?soru=ID paylaşım linki: ilgili soruyu göster (bkz. QuestionBankHighlight).
export const FOCUS_QUESTION_EVENT = 'soru-bankasi:focus-question';
// Kapaktaki "Cevap anahtarlı N soruyu incele": soru listesini aç (bkz. GuestTestCover).
export const OPEN_QUESTION_LIST_EVENT = 'soru-bankasi:open-list';
// Öğrenci konu karnesindeki "Çözmediklerim" düğmesi: TestStatusCard'daki konu testini başlatır.
export const START_TOPIC_TEST_EVENT = 'soru-bankasi:start-topic-test';
