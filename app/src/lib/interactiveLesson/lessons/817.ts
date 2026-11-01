// 5. sınıf Bilişim · Bilgisayar Sistemlerinin Kullanımı (konu 817) — KEŞİF HARİTASI örneği (yalnız bölüm 2,
// "Donanım Birimleri ve İşlevleri", topic_content_sections 1383). Harita: masaüstü bilgisayar; kasanın yan
// penceresinden anakart, işlemci ve RAM görünür. İçerik konu metninden; havuzda klasik soru yok → derste yazıldı.
import type { LessonDefinition, LessonTerm } from '../types';

const TEXT = '#e2e8f0';
const BODY = '#94a3b8';
const DARK = '#475569';

const label = (term: string, x: number, y: number, text: string) =>
  `<text data-label="${term}" x="${x}" y="${y}" text-anchor="middle" font-size="22" font-weight="700" fill="${TEXT}">${text}</text>`;

// Masaüstü bilgisayar: her parça data-term = kendi kimliği + grubu (giriş/çıkış/işlem birimi).
function desktopPc(): string {
  const keys = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 12 }, (_, c) => `<rect x="${214 + c * 25}" y="${308 + r * 13}" width="20" height="9" rx="2" fill="${DARK}"/>`).join(''),
  ).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 430">` +
    // mikrofon
    `<g data-term="mikrofon giris-birimi"><rect x="38" y="104" width="30" height="46" rx="15" fill="${BODY}"/><path d="M53 150 V228 M30 230 H76" stroke="${BODY}" stroke-width="6" stroke-linecap="round"/></g>` +
    // Hoparlör yazısıyla çakışmasın diye mikrofonun üstünde.
    label('mikrofon', 53, 90, 'Mikrofon') +
    // hoparlör
    `<g data-term="hoparlor cikis-birimi"><rect x="112" y="112" width="70" height="120" rx="10" fill="${BODY}"/><circle cx="147" cy="146" r="16" fill="${DARK}"/><circle cx="147" cy="200" r="22" fill="${DARK}"/></g>` +
    label('hoparlor', 147, 262, 'Hoparlör') +
    // monitör
    `<g data-term="monitor cikis-birimi"><rect x="222" y="34" width="300" height="190" rx="10" fill="${BODY}"/><rect x="236" y="48" width="272" height="160" rx="4" fill="#1e3a5f"/><path d="M352 224 h40 l10 30 h-60 z" fill="${BODY}"/></g>` +
    label('monitor', 372, 130, 'Monitör') +
    // klavye
    `<g data-term="klavye giris-birimi"><rect x="204" y="296" width="314" height="56" rx="8" fill="${BODY}"/>${keys}</g>` +
    label('klavye', 361, 384, 'Klavye') +
    // fare
    `<g data-term="fare giris-birimi"><ellipse cx="566" cy="326" rx="20" ry="30" fill="${BODY}"/><path d="M566 298 V318" stroke="${DARK}" stroke-width="3"/></g>` +
    label('fare', 566, 384, 'Fare') +
    // kasa + yan pencere: anakart, işlemci, RAM
    `<rect x="616" y="34" width="190" height="318" rx="12" fill="${BODY}"/>` +
    `<rect x="632" y="54" width="158" height="236" rx="6" fill="#1f2937"/>` +
    `<rect data-term="anakart islem-birimi" x="642" y="64" width="138" height="216" rx="4" fill="#166534"/>` +
    `<g data-term="merkezi-islem-birimi islem-birimi"><rect x="660" y="86" width="56" height="56" rx="4" fill="#d1d5db"/><rect x="672" y="98" width="32" height="32" rx="2" fill="#6b7280"/></g>` +
    label('merkezi-islem-birimi', 688, 172, 'İşlemci') +
    `<g data-term="ram-bellek islem-birimi"><rect x="734" y="80" width="10" height="110" rx="2" fill="#38bdf8"/><rect x="752" y="80" width="10" height="110" rx="2" fill="#38bdf8"/></g>` +
    label('ram-bellek', 748, 218, 'RAM') +
    `<text x="711" y="330" text-anchor="middle" font-size="20" font-weight="700" fill="#1f2937">Kasa</text>` +
    // yazıcı
    `<g data-term="yazici cikis-birimi"><rect x="22" y="318" width="150" height="62" rx="8" fill="${BODY}"/><rect x="44" y="296" width="106" height="26" fill="#f8fafc"/><rect x="44" y="370" width="106" height="20" fill="#f8fafc"/></g>` +
    label('yazici', 97, 420, 'Yazıcı') +
    `</svg>`
  );
}

const MAP = desktopPc();

const concept = (title: string, iconName: LessonTerm['iconName'], description: string, group: string, task: string): LessonTerm => ({
  title,
  description,
  iconName,
  facts: [
    { label: 'Grubu', value: group },
    { label: 'Görevi', value: task },
  ],
});

export const lesson817: LessonDefinition = {
  topicId: 817,
  // Anlatıcı robotun bu derse özel hikâyesi (açılış/kapanış).
  guide: {
    intro: "Merhaba! Ben Bit. Bilgisayarın parçaları da tıpkı benim parçalarım gibi birlikte çalışır. Hangi parça ne iş yapar, birlikte keşfedelim mi?",
    finish: "Harika! Artık giriş ve çıkış birimlerini tanıyorsun. Parçalarım da sayende tıkır tıkır çalışıyor!",
  },
  terms: {
    klavye: concept('Klavye', 'Keyboard', 'Harf, rakam ve komutları bilgisayara aktarır.', 'Giriş birimi', 'Yazı ve komut girmek'),
    fare: concept('Fare', 'Mouse', 'İmleci hareket ettirip tıklayarak komut verir.', 'Giriş birimi', 'Seçmek ve tıklamak'),
    mikrofon: concept('Mikrofon', 'Mic', 'Sesi bilgisayara aktarır.', 'Giriş birimi', 'Ses kaydetmek'),
    monitor: concept('Monitör', 'Monitor', 'İşlenen verileri görüntü olarak gösterir.', 'Çıkış birimi', 'Görüntü sunmak'),
    hoparlor: concept('Hoparlör', 'Speaker', 'Bilgisayardaki sesi dışarı verir.', 'Çıkış birimi', 'Ses vermek'),
    yazici: concept('Yazıcı', 'Printer', 'Belgeleri kâğıda aktarır.', 'Çıkış birimi', 'Kâğıda çıktı almak'),
    // Anahtar kavram kimlikleriyle aynı: tanım kartı burada zenginleştirildi (öncelik dersin kaydında).
    'merkezi-islem-birimi': {
      ...concept('Merkezi İşlem Birimi (İşlemci)', 'Cpu', 'Bilgisayarın beyni: verileri işler, hesaplar.', 'İşlem birimi', 'Veri işlemek, hesaplamak'),
      shortTitle: 'İşlemci',
      aliases: ['işlemci', 'CPU'],
    },
    'ram-bellek': {
      shortTitle: 'RAM',
      ...concept('RAM Bellek', 'MemoryStick', 'Geçici, hızlı bellek; elektrik kesilince silinir.', 'İşlem birimi', 'Çalışan verileri geçici tutmak'),
      aliases: ['RAM'],
    },
    anakart: { title: 'Anakart', description: 'Bilgisayarın tüm iç parçalarının bağlandığı temel devre kartıdır.', iconName: 'CircuitBoard' },
    'giris-birimi': { title: 'Giriş birimi', description: 'Dış dünyadan bilgisayara veri ve komut aktaran parçadır.', iconName: 'Keyboard', aliases: ['giriş birimleri'] },
    'cikis-birimi': { title: 'Çıkış birimi', description: 'İşlenen verileri kullanıcıya sunan parçadır.', iconName: 'Monitor', aliases: ['çıkış birimleri'] },
  },
  blocks: [
    {
      sectionId: 1383,
      title: 'Donanım birimleri',
      steps: [
        {
          kind: 'kesif',
          title: 'Bilgisayarın parçalarını keşfet',
          predict: { question: 'Sence bilgisayarın "beyni" hangi parçadır?', options: ['Monitör', 'İşlemci', 'Klavye'], answer: 1 },
          intro: 'Her parçaya dokun: ne işe yaradığını ve hangi gruba girdiğini gör.',
          map: { kind: 'svg', svg: MAP, caption: 'Kasanın yan penceresinden anakart, işlemci ve RAM görünüyor.' },
          items: ['klavye', 'fare', 'mikrofon', 'monitor', 'hoparlor', 'yazici', 'merkezi-islem-birimi', 'ram-bellek'].map((term) => ({ term })),
          misconception: { wrong: 'Monitör bilgisayarın beynidir; işlemler monitörde yapılır.', right: 'Monitör bir çıkış birimidir. Verileri işleyen kasadaki işlemcidir.' },
        },
        {
          kind: 'anlatim',
          title: 'Donanımın dört grubu',
          body:
            'Giriş birimleri veriyi bilgisayara **alır**, işlem birimi **işler**, çıkış birimleri sonucu bize **sunar**.\n\n' +
            '**Dokunmatik ekran** hem dokunuşla komut alır hem görüntü sunar: hem giriş hem çıkış birimidir.',
          visual: {
            kind: 'akis',
            steps: [
              { label: 'Giriş: klavye, fare, mikrofon', icon: 'Keyboard', term: 'giris-birimi' },
              { label: 'İşlem: işlemci, RAM', icon: 'Cpu', term: 'merkezi-islem-birimi' },
              { label: 'Çıkış: monitör, yazıcı, hoparlör', icon: 'Monitor', term: 'cikis-birimi' },
            ],
          },
        },
        {
          kind: 'etiketle',
          prompt: 'Parçaların adlarını bilgisayardaki yerlerine yerleştir.',
          map: { kind: 'svg', svg: MAP },
          labels: [
            { term: 'monitor', text: 'Monitör' },
            { term: 'klavye', text: 'Klavye' },
            { term: 'yazici', text: 'Yazıcı' },
            { term: 'merkezi-islem-birimi', text: 'İşlemci' },
            { term: 'hoparlor', text: 'Hoparlör' },
          ],
          explanation: 'İşlemci ve RAM kasanın içinde, anakartın üzerindedir.',
        },
        {
          kind: 'bul',
          prompt: 'Bilgisayarda doğru parçaya dokun.',
          map: { kind: 'svg', svg: MAP },
          zones: [
            { term: 'giris-birimi', name: 'bir giriş birimi' },
            { term: 'cikis-birimi', name: 'bir çıkış birimi' },
            { term: 'merkezi-islem-birimi', name: 'işlemci' },
            { term: 'ram-bellek', name: 'RAM' },
            { term: 'anakart', name: 'anakart' },
          ],
          questions: [
            { prompt: 'Bir giriş birimine dokun.', term: 'giris-birimi' },
            { prompt: 'Bir çıkış birimine dokun.', term: 'cikis-birimi' },
            { prompt: 'Verileri işleyen, bilgisayarın beynine dokun.', term: 'merkezi-islem-birimi' },
            { prompt: 'Elektrik kesilince verileri silinen belleğe dokun.', term: 'ram-bellek' },
          ],
          explanation: 'Klavye, fare ve mikrofon giriş; monitör, hoparlör ve yazıcı çıkış birimidir. İşlemci ve RAM işlem birimindedir.',
        },
        {
          kind: 'eslestirme',
          prompt: 'Haritada olmayan bu donanımları da gruplarına yerleştir.',
          targets: ['Giriş', 'Çıkış', 'İkisi de'],
          items: [
            { text: 'Tarayıcı', target: 0 },
            { text: 'Projeksiyon cihazı', target: 1 },
            { text: 'Oyun kolu', target: 0 },
            { text: 'Kulaklık', target: 1 },
            { text: 'Dokunmatik ekran', target: 2 },
            { text: 'Web kamerası', target: 0 },
          ],
          explanation: 'Tarayıcı, oyun kolu ve web kamerası veri alır; projeksiyon ve kulaklık sunar. Dokunmatik ekran ikisini de yapar.',
        },
        { kind: 'soru', questionId: 6681 },
        { kind: 'soru', questionId: 6677 },
        { kind: 'soru', questionId: 6679 },
        {
          kind: 'klasik',
          prompt: 'Bir öğrenci klavyeyle yazdığı ödevi yazıcıdan çıkarıyor. Bu işlemde veri hangi birimlerden sırasıyla geçer? Her birimin görevini yazınız.',
          modelAnswer:
            'Veri önce klavyeden (giriş birimi) girer, işlemcide (işlem birimi) işlenir, sonra yazıcıdan (çıkış birimi) kâğıda çıkar. Giriş birimi veriyi alır, işlemci işler, çıkış birimi sonucu sunar.',
        },
      ],
    },
  ],
};
