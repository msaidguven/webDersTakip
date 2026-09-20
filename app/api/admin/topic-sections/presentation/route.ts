import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';
import { Resvg } from '@resvg/resvg-js';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';

const SVG_RENDER_WIDTH = 800;

const HEADING_COLOR = '1F2937';
const BODY_COLOR = '374151';
const MUTED_COLOR = '6B7280';
const ACCENT_COLOR = '6C63FF';
const ACCENT_SOFT = 'EDEBFF';
const CARD_BORDER = 'E5E7EB';
const TIP_BG = 'FFF7E6';
const TIP_BORDER = 'F5C453';

type SlideRow = { slides: SlideDeck };

async function urlToImageData(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function svgToImageData(svg: string): string | null {
  try {
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: SVG_RENDER_WIDTH } });
    const png = resvg.render().asPng();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

function addEyebrowAndCounter(slide: PptxGenJS.Slide, eyebrowText: string, counterText: string) {
  const eyebrowW = Math.min(0.1 * eyebrowText.length + 0.5, 7.5);
  slide.addShape('roundRect', {
    x: 0.4, y: 0.28, w: eyebrowW, h: 0.38, rectRadius: 0.08,
    fill: { color: ACCENT_SOFT }, line: { color: ACCENT_COLOR, width: 0.75 },
  });
  slide.addText(eyebrowText, {
    x: 0.4, y: 0.28, w: eyebrowW, h: 0.38,
    fontSize: 10, bold: true, color: ACCENT_COLOR, align: 'center', valign: 'middle', charSpacing: 1,
  });
  slide.addShape('roundRect', {
    x: 9.05, y: 0.28, w: 0.55, h: 0.38, rectRadius: 0.08,
    fill: { color: 'F3F4F6' }, line: { color: CARD_BORDER, width: 0.75 },
  });
  slide.addText(counterText, {
    x: 9.05, y: 0.28, w: 0.55, h: 0.38, fontSize: 10, bold: true, color: MUTED_COLOR, align: 'center', valign: 'middle',
  });
}

function addBulletChips(slide: PptxGenJS.Slide, bullets: string[], x: number, y: number, w: number, h: number) {
  if (!bullets.length) {
    slide.addText('(İçerik özetlenemedi — admin panelden kontrol edin)', {
      x, y, w, h, fontSize: 13, italic: true, color: '9CA3AF',
    });
    return;
  }
  const gap = 0.14;
  const rowH = (h - gap * (bullets.length - 1)) / bullets.length;
  bullets.forEach((bullet, i) => {
    const rowY = y + i * (rowH + gap);
    slide.addShape('roundRect', {
      x, y: rowY, w, h: rowH, rectRadius: 0.09, fill: { color: 'F9FAFB' }, line: { color: CARD_BORDER, width: 0.75 },
    });
    slide.addShape('ellipse', { x: x + 0.15, y: rowY + rowH / 2 - 0.06, w: 0.12, h: 0.12, fill: { color: ACCENT_COLOR } });
    slide.addText(bullet, {
      x: x + 0.42, y: rowY, w: w - 0.55, h: rowH, fontSize: 14, color: BODY_COLOR, valign: 'middle',
    });
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { topicId?: unknown } | null;
  const topicId = typeof body?.topicId === 'number' ? body.topicId : Number(body?.topicId);
  if (!topicId || !Number.isInteger(topicId)) {
    return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: topicContent } = await supabase.from('topic_contents').select('id').eq('topic_id', topicId).maybeSingle();
  if (!topicContent) return NextResponse.json({ error: 'Bu konu için içerik hazırlanmamış' }, { status: 404 });

  const { data: slideRow } = await supabase
    .from('topic_content_slides')
    .select('slides')
    .eq('topic_content_id', (topicContent as { id: number }).id)
    .maybeSingle();
  if (!slideRow) {
    return NextResponse.json({ error: 'Önce "Sunum Oluştur" ile slaytları üretmelisiniz' }, { status: 404 });
  }

  const deck = (slideRow as SlideRow).slides;
  const totalSlides = deck.slides.length;

  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';

  for (let index = 0; index < deck.slides.length; index++) {
    const slideData = deck.slides[index];
    const isCover = slideData.kind === 'cover';
    const imageData = slideData.imageUrl
      ? await urlToImageData(slideData.imageUrl)
      : slideData.diagramSvg
        ? svgToImageData(slideData.diagramSvg)
        : null;
    const isLast = index === deck.slides.length - 1;
    const showTip = isLast && !!deck.tip?.content;

    const slide = pres.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.12, fill: { color: ACCENT_COLOR } });
    if (deck.eyebrowText) addEyebrowAndCounter(slide, deck.eyebrowText, `${index + 1}/${totalSlides}`);

    if (isCover) {
      const textW = imageData ? 5.6 : 8.8;
      slide.addText(slideData.heading, { x: 0.6, y: 1.9, w: textW, h: 1.6, fontSize: 34, bold: true, color: HEADING_COLOR, valign: 'top' });
      if (slideData.subtitle) {
        slide.addText(slideData.subtitle, { x: 0.6, y: 3.4, w: textW, h: 1, fontSize: 16, color: MUTED_COLOR, valign: 'top' });
      }
      if (imageData) {
        slide.addShape('roundRect', { x: 6.25, y: 1.1, w: 3.35, h: 3.35, rectRadius: 0.12, fill: { color: 'F9FAFB' }, line: { color: CARD_BORDER, width: 1 } });
        slide.addImage({ data: imageData, x: 6.4, y: 1.25, w: 3.05, h: 3.05, sizing: { type: 'contain', w: 3.05, h: 3.05 } });
      }
      continue;
    }

    slide.addText(slideData.heading, { x: 0.5, y: 0.78, w: 9, h: 0.7, fontSize: 26, bold: true, color: HEADING_COLOR, valign: 'top' });

    const bulletsY = 1.55;
    const bulletsH = showTip ? 2.85 : 3.75;
    const bulletsW = imageData ? 5.3 : 9;
    addBulletChips(slide, slideData.bullets, 0.5, bulletsY, bulletsW, bulletsH);

    if (imageData) {
      const frameW = 3.3;
      const frameH = Math.min(bulletsH, 3.3);
      slide.addShape('roundRect', { x: 6.2, y: bulletsY, w: frameW, h: frameH, rectRadius: 0.1, fill: { color: 'F9FAFB' }, line: { color: CARD_BORDER, width: 1 } });
      slide.addImage({
        data: imageData, x: 6.35, y: bulletsY + 0.15, w: frameW - 0.3, h: frameH - 0.3,
        sizing: { type: 'contain', w: frameW - 0.3, h: frameH - 0.3 },
      });
    }

    if (showTip && deck.tip) {
      const tipY = bulletsY + bulletsH + 0.15;
      slide.addShape('roundRect', { x: 0.5, y: tipY, w: 9, h: 0.75, rectRadius: 0.1, fill: { color: TIP_BG }, line: { color: TIP_BORDER, width: 1 } });
      slide.addText(
        [
          { text: `💡 ${deck.tip.title}: `, options: { bold: true, color: '92400E' } },
          { text: deck.tip.content, options: { color: '78350F' } },
        ],
        { x: 0.7, y: tipY, w: 8.6, h: 0.75, fontSize: 12, valign: 'middle' }
      );
    }
  }

  const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="konu-sunumu.pptx"`,
    },
  });
}
