// Etkileşimli dersi (admin önizlemesi) gerçek tarayıcıda baştan sona oynar: dersin verisini API'den okuyup her
// adımı çözer (bazılarında önce bilerek yanlış yapar: ✓ kilit / ✕ kalır akışı), ekran görüntüsü alır, takılan
// adımı, konsol hatalarını ve çalınan Bit seslerini yazar.
//   node scripts/walk-interactive-lesson.mjs <görüntü klasörü> <konu yolu> <topicId> <etiket> [genişlik]
//   ör. node scripts/walk-interactive-lesson.mjs /tmp/shots 6-sinif/fen-bilimleri/gunes-sistemi-ve-tutulmalar/gunes-sistemi 704 fen 390
// Önkoşul: dev sunucusu (localhost:3000, Node 22), .env.local'da TEST_ADMIN_*, Playwright kurulu.
import { chromium } from 'playwright';
import fs from 'node:fs';

const [OUT, TOPIC_PATH, TOPIC_ID, TAG, WIDTH = '390'] = process.argv.slice(2);
if (!OUT || !TOPIC_PATH || !TOPIC_ID || !TAG) {
  console.error('Kullanım: node scripts/walk-interactive-lesson.mjs <görüntü klasörü> <konu yolu> <topicId> <etiket> [genişlik]');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: Number(WIDTH), height: Number(WIDTH) > 600 ? 800 : 844 } });
const errors = [];
const voices = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
page.on('response', (r) => r.url().includes('/interactive-voice/') && r.url().endsWith('.mp3') && voices.push(r.status()));

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 120000 });
await page.fill('input[type=email]', env.TEST_ADMIN_EMAIL);
await page.fill('input[type=password]', env.TEST_ADMIN_PASSWORD);
await page.click('button[type=submit]');
await page.waitForTimeout(3000);
await page.goto('http://localhost:3000/' + TOPIC_PATH, { waitUntil: 'networkidle', timeout: 180000 });
await page.evaluate(() => localStorage.removeItem('interactive-lesson-scale'));
const lesson = await page.evaluate(async (id) => (await fetch(`/api/admin/interactive-lesson?topicId=${id}`)).json(), TOPIC_ID);
// Oynatıcıdaki gibi: anlatım üç ekrana bölünür (metin / görsel / yanılgı; guide.ts narrativeParts).
const parts = (st) => [st.body || st.predict || !st.visual ? 'text' : null, st.visual ? 'visual' : null, st.misconception ? 'mis' : null].filter(Boolean);
const steps = lesson.blocks.flatMap((b) => [...b.steps.flatMap((st) => (st.kind === 'anlatim' ? parts(st).map((part) => ({ ...st, part })) : [st])), { kind: 'bolum_sonu' }]);

// Next.js geliştirme rozeti ("N 1 Issue") alttaki düğmelerin üstünü örtmesin; içeriği rapora yazılır.
const devIssues = await page.evaluate(() => document.querySelector('nextjs-portal')?.shadowRoot?.textContent?.slice(0, 300) ?? '');
await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
await page.getByRole('button', { name: /Etkileşimli ders/ }).click();
const dlg = page.getByRole('dialog', { name: 'Etkileşimli ders' });
const bubble = dlg.locator('section').first();
const primary = () => bubble.locator('button').last();
const stage = dlg.locator('section + div');
await primary().click({ timeout: 90000 }); // Başla

const shot = async (name) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
};
const btn = (loc, name) => loc.getByRole('button', { name, exact: true });
// Öğe düğmelerine kısa bekleme süresi: takılınca 30 sn beklemesin.
page.setDefaultTimeout(8000);
const clickPrimary = async (label) => {
  const b = primary();
  if ((await b.textContent())?.trim() !== label) throw new Error(`Ana düğme "${label}" bekleniyordu: "${await b.textContent()}"`);
  await b.click();
};
// Haritadaki bölgenin ortasına tıkla (dokunma noktası en yakın bölgeye eşlenir).
const tapZone = async (term) => {
  const box = await dlg.locator(`[data-fig] [data-term~="${term}"]`).first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};
const seen = new Set();

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  try {
  const first = !seen.has(step.kind);
  seen.add(step.kind);
  if (step.predict && (step.kind !== 'anlatim' || step.part === 'text')) await btn(stage, step.predict.options[(step.predict.answer + 1) % step.predict.options.length]).click();
  switch (step.kind) {
    case 'anlatim':
      if (!seen.has(`anlatim-${step.part}`)) await shot(`${i}-anlatim-${step.part}`);
      seen.add(`anlatim-${step.part}`);
      break;
    case 'kesif':
      for (const b of await stage.locator('[aria-label="Keşfedilecekler"] button').all()) await b.click();
      if (first) await shot(`${i}-kesif`);
      break;
    case 'eslestirme': {
      const matrix = step.targets.length <= 4;
      const put = async (k, t) => {
        if (matrix) await stage.getByRole('button', { name: `${step.items[k].text}: ${step.targets[t]}`, exact: true }).click();
        else {
          await stage.getByRole('button', { name: new RegExp(`^${step.items[k].text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `) }).click();
          await btn(stage.locator('[aria-label="Seçenekler"]'), step.targets[t]).click();
        }
      };
      // Önce iki öğenin hedefini bilerek takas et (bire bir eşleştirmede kullanılan seçenek bankadan düşer) →
      // kontrol → ikisi ✕ kalır, diğerleri ✓ kilitli → ikisini boşalt, doğru koy.
      const j = step.items.findIndex((it) => it.target !== step.items[0].target);
      const target = (k) => (k === 0 ? step.items[j].target : k === j ? step.items[0].target : step.items[k].target);
      for (let k = 0; k < step.items.length; k++) await put(k, target(k));
      await clickPrimary('Kontrol et');
      await shot(`${i}-eslestir-isaret`);
      if (!matrix) for (const k of [0, j]) await stage.getByRole('button', { name: new RegExp(`^${step.items[k].text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `) }).click();
      await put(0, step.items[0].target);
      await put(j, step.items[j].target);
      await clickPrimary('Kontrol et');
      break;
    }
    case 'dogru_yanlis':
      for (const st of step.statements) await stage.getByRole('button', { name: `${st.text}: ${st.correct ? 'Doğru' : 'Yanlış'}`, exact: true }).click();
      await clickPrimary('Kontrol et');
      break;
    case 'bosluk':
      for (const a of step.answers) await btn(stage.locator('[aria-label="Kelime bankası"]'), a).first().click();
      await clickPrimary('Kontrol et');
      break;
    case 'siralama': {
      // Önce ilk ikisini ters koy → ikisi ✕, kalanlar ✓ kilitli → ✕'leri geri al, doğru koy.
      const order = step.items.map((_, k) => k);
      [order[0], order[1]] = [order[1], order[0]];
      for (const k of order) await btn(stage.locator('[aria-label="Sıralanacaklar"]'), step.items[k]).click();
      await clickPrimary('Kontrol et');
      await shot(`${i}-sirala-isaret`);
      const bad = await stage.locator('ol button').evaluateAll((els) => els.filter((e) => e.textContent.includes('✕')).length);
      if (bad !== 2) throw new Error(`Sıralamada 2 ✕ bekleniyordu: ${bad}`);
      await stage.getByRole('button', { name: `1. sıra: ${step.items[1]}`, exact: true }).click();
      if ((await stage.locator('ol button').evaluateAll((els) => els.filter((e) => e.textContent.includes('✕')).length)) !== 1) throw new Error('Bir ✕ geri alınınca diğeri kalmalıydı');
      await stage.getByRole('button', { name: `2. sıra: ${step.items[0]}`, exact: true }).click();
      for (const k of [0, 1]) await btn(stage.locator('[aria-label="Sıralanacaklar"]'), step.items[k]).click();
      await clickPrimary('Kontrol et');
      break;
    }
    case 'coklu_secim':
      for (const o of step.options) if (o.correct) await stage.getByRole('button', { name: new RegExp(o.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
      await clickPrimary('Kontrol et');
      break;
    case 'etiketle':
      for (let k = 0; k < step.labels.length; k++) {
        await stage.getByRole('button', { name: `${k + 1}. yuva, boş`, exact: true }).click();
        await btn(stage.locator('[aria-label="Etiketler"]'), step.labels[k].text).click();
      }
      if (first) await shot(`${i}-etiketle`);
      await clickPrimary('Kontrol et');
      break;
    case 'bul':
      for (let q = 0; q < step.questions.length; q++) {
        if (q === 0) {
          const wrong = step.zones.find((z) => z.term !== step.questions[0].term);
          await tapZone(wrong.term);
          await tapZone(wrong.term);
          await shot(`${i}-bul-ipucu`);
        }
        await tapZone(step.questions[q].term);
        if (q < step.questions.length - 1) await clickPrimary('Sonraki soru');
      }
      break;
    case 'soru': {
      const opts = step.question.type === 'multiple_choice' ? step.question.choices : step.question.options;
      const pick = first ? opts.findIndex((o) => !o.is_correct) : opts.findIndex((o) => o.is_correct);
      await stage.locator('ul li button').nth(pick).click();
      if (first) await shot(`${i}-soru`);
      break;
    }
    case 'klasik':
      await stage.locator('textarea').fill('Deneme cevabı');
      await clickPrimary('Karşılaştır');
      if (first) await shot(`${i}-anladik-mi`);
      break;
    case 'bolum_sonu':
      if (first) await shot(`${i}-bolum-sonu`);
      break;
  }
  } catch (err) {
    console.log('HATA:', i, step.kind, String(err.message).split('\n')[0]);
    await shot('hata');
    break;
  }
  const label = i === steps.length - 1 ? 'Dersi bitir' : 'Devam';
  const b = primary();
  if ((await b.textContent())?.trim() !== label || (await b.isDisabled())) {
    console.log('TAKILDI:', i, step.kind, '| düğme:', await b.textContent(), (await b.isDisabled()) ? '(pasif)' : '');
    await shot('takildi');
    break;
  }
  await b.click();
}
await shot('bitis');
const ignored = /favicon|adsbygoogle|googletag|Download the React|500 \(Internal/;
const ok = voices.filter((s) => s === 200).length;
console.log(TAG, WIDTH, 'adım:', steps.length, 'bitti:', await dlg.getByText('Ders tamamlandı').first().isVisible(), '| Bit sesi:', `${ok}/${voices.length} dosya`, '| yatay taşma:', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), '| hatalar:', JSON.stringify(errors.filter((e) => !ignored.test(e))), devIssues ? `| dev rozeti: ${devIssues}` : '');
await browser.close();
