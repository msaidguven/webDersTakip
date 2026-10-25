// HTML → A4 PDF (Chromium). Yazılı kağıdı (herkese açık örnek + öğretmen kağıdı) ortak kullanır.
// Kullanan route'lar next.config.ts'te CHROMIUM_TRACE_INCLUDES'a eklenmeli (binary dinamik yükleniyor).
import 'server-only';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { SITE_URL } from '@/app/src/lib/site';

export async function htmlToA4Pdf(html: string): Promise<Uint8Array> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
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
