// AI'ın ürettiği ham SVG diyagram kodunu (topic_content_sections.diagram_svg) render
// öncesi temizler. Sıkı bir allowlist kullanılır — script/style/foreignObject/image/use/
// href/on* gibi kod çalıştırabilecek veya dış kaynağa gidebilecek her şey dışarıda kalır.
// Sadece client'ta (window/DOM gerektirir) çalışır.
import DOMPurify from 'dompurify';

const MAX_LENGTH = 20_000;

const ALLOWED_TAGS = [
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'marker', 'title',
];

const ALLOWED_ATTR = [
  'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'points', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'font-size', 'font-weight', 'font-family', 'text-anchor',
  'dominant-baseline', 'transform', 'id', 'marker-end', 'marker-start', 'orient',
  'refX', 'refY', 'markerWidth', 'markerHeight', 'opacity', 'fill-opacity', 'stroke-opacity',
];

export function sanitizeMathSvg(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('<svg') || !trimmed.endsWith('</svg>')) return null;
  if (trimmed.length > MAX_LENGTH) return null;

  const clean = DOMPurify.sanitize(trimmed, {
    USE_PROFILES: { svg: true, svgFilters: false },
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  }).trim();

  return clean.startsWith('<svg') ? clean : null;
}
