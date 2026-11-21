// HTML → A4 PDF (Chromium). Yazılı kağıdı (herkese açık örnek + öğretmen kağıdı) ve konu PDF'i ortak kullanır.
// Kullanan route'lar next.config.ts'te CHROMIUM_TRACE_INCLUDES'a eklenmeli (binary dinamik yükleniyor).
import 'server-only';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser } from 'puppeteer-core';
import { SITE_URL } from '@/app/src/lib/site';

// @sparticuz/chromium'daki bin/al2023.tar.br (libnspr4.so, libnss3.so, libexpat.so.1…) paket içinde
// yalnız AWS Lambda ve Vercel ortam değişkenleri görülünce açılıyor. Firebase App Hosting (Cloud Run)
// bu değişkenleri taşımadığı için minimal Linux imajında libnspr4.so bulunamayıp Code 127 ile çöküyordu.
// Aynı paket içindeki arşivi Linux'ta eksiksiz açıp Chromium sürecine LD_LIBRARY_PATH olarak veriyoruz.
let preparedExecutablePath: Promise<string> | null = null;

function findAl2023Archive(): string | null {
  try {
    const req = createRequire(import.meta.url);
    const entry = req.resolve('@sparticuz/chromium');
    const candidate = path.resolve(path.dirname(entry), '..', '..', 'bin', 'al2023.tar.br');
    if (fs.existsSync(candidate)) return candidate;
  } catch {
    // Fallback aşağıda.
  }
  const fallback = path.join(process.cwd(), 'node_modules', '@sparticuz', 'chromium', 'bin', 'al2023.tar.br');
  return fs.existsSync(fallback) ? fallback : null;
}

function extractAl2023Libs(destDir: string): void {
  const libDir = path.join(destDir, 'lib');
  if (fs.existsSync(path.join(libDir, 'libnspr4.so'))) return;

  const archivePath = findAl2023Archive();
  if (!archivePath) return;

  const tar = brotliDecompressSync(fs.readFileSync(archivePath));
  const resolvedDest = path.resolve(destDir);
  fs.mkdirSync(resolvedDest, { recursive: true });

  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    if (!name) break;

    const mode = Number.parseInt(header.subarray(100, 108).toString('utf8').replace(/\0.*$/, '').trim(), 8) || 0o644;
    const size = Number.parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim() || '0', 8);
    const typeflag = String.fromCharCode(header[156]);
    const dataStart = offset + 512;
    offset = dataStart + Math.ceil(size / 512) * 512;

    const target = path.resolve(resolvedDest, name);
    if (!target.startsWith(`${resolvedDest}${path.sep}`)) continue;

    if (typeflag === '5') {
      fs.mkdirSync(target, { recursive: true });
    } else if (typeflag === '0' || typeflag === '\0') {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const tmp = `${target}.tmp-${process.pid}`;
      fs.writeFileSync(tmp, tar.subarray(dataStart, dataStart + size), { mode });
      fs.renameSync(tmp, target);
    }
  }
}

function prepareChromium(): Promise<string> {
  if (!preparedExecutablePath) {
    preparedExecutablePath = (async () => {
      const executablePath = await chromium.executablePath();
      if (process.platform === 'linux') {
        extractAl2023Libs(path.join(os.tmpdir(), 'al2023'));
      }
      return executablePath;
    })().catch((err) => {
      preparedExecutablePath = null;
      throw err;
    });
  }
  return preparedExecutablePath;
}

function findLocalBrowserExecutable(): string | null {
  const fromEnv = process.env.CHROME_EXECUTABLE_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates =
    process.platform === 'win32'
      ? [
          path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
          path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          ]
        : [];

  return candidates.find((p) => p && fs.existsSync(p)) ?? null;
}

export async function launchChromium(): Promise<Browser> {
  // @sparticuz/chromium yalnızca Linux x64 binary'si içerir; Windows/macOS yerelde
  // sistemdeki Chrome/Edge'i (veya CHROME_EXECUTABLE_PATH) kullanır.
  if (process.platform !== 'linux') {
    const localPath = findLocalBrowserExecutable();
    if (!localPath) {
      throw new Error('Yerel Chrome/Edge bulunamadı. Chrome kurun veya CHROME_EXECUTABLE_PATH tanımlayın.');
    }
    return puppeteer.launch({ executablePath: localPath, headless: true });
  }

  const executablePath = await prepareChromium();
  const env: Record<string, string | undefined> = { ...process.env };

  const al2023Lib = path.join(os.tmpdir(), 'al2023', 'lib');
  const existing = env.LD_LIBRARY_PATH?.split(':').filter(Boolean) ?? [];
  if (!existing.includes(al2023Lib)) {
    env.LD_LIBRARY_PATH = [al2023Lib, ...existing].join(':');
  }
  env.FONTCONFIG_PATH ??= path.join(os.tmpdir(), 'fonts');
  env.HOME ??= os.tmpdir();

  // @sparticuz/chromium 137'de defaultViewport/headless static alanları kaldırıldı
  // — sadece args/executablePath sağlıyor, headless artık puppeteer-core'un varsayılanı (true).
  return puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
    env,
  });
}

export async function htmlToA4Pdf(html: string): Promise<Uint8Array> {
  let browser: Browser | null = null;
  try {
    browser = await launchChromium();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
    const siteLabel = SITE_URL.replace(/^https?:\/\//, '');
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="font-size:7.5px; width:100%; padding:0 12mm; display:flex; justify-content:space-between; color:#555; font-family:Arial,sans-serif;"><span>${siteLabel} · Ders Takip</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
  } finally {
    if (browser) await browser.close();
  }
}
