// app/prompt/02-section-content.md kurallarını METİN olarak değil, ÖLÇÜLEBİLİR olarak denetleyen script.
// Amaç: "kuralı okudum, uyduğumu sanıyorum" yerine geçer/kalır net bir rapor üretmek.
// Kullanım (kütüphane): const { lintSection } = require('./lint-section-content'); lintSection(bodyMarkdown)
// Kullanım (CLI): node scripts/lib/lint-section-content.js --topic-id 421,422  |  --section-id 313,314  |  --all

const BANNED_CLOSING_RE = [
  /\bBu\s+[^.]{0,60}?(sağlar|gösterir|oluşturur|sunar|kolaylaştırır)\.?\s*$/i,
  /^\s*(Yani|Kısacası|Böylece|Bu sayede|Özetle)\b/im,
];
const RHETORICAL_RE = /(değil mi\?|hiç düşündün mü\?|sizce\?|dersiniz\?)/i;
const SECOND_PERSON_RE = /\b(sen|senin|sence|seninle|sana|seni)\b/i;
const NARRATIVE_CONNECTOR_RE = /(bu sayede|bu araçlarla|bu şekilde|böylece|bu nedenle|bu yüzden)/i;

function stripBulletMarker(line) {
  return line.replace(/^\s*-\s?/, '');
}

function countWords(bodyMarkdown) {
  const cleaned = bodyMarkdown
    .split('\n')
    .map(stripBulletMarker)
    .join(' ');
  return cleaned.trim().split(/\s+/).filter(Boolean).length;
}

function lintSection(bodyMarkdown, opts = {}) {
  const heading = opts.heading || '(bilinmiyor)';
  const errors = [];
  const warnings = [];

  const lines = bodyMarkdown.split('\n').filter((l) => l.trim());
  const bulletLines = lines.filter((l) => l.trim().startsWith('-'));
  const nonBulletLines = lines.filter((l) => !l.trim().startsWith('-'));

  const wordCount = countWords(bodyMarkdown);
  if (wordCount < 60) errors.push(`kelime sayısı düşük: ${wordCount} (min 60)`);
  if (wordCount > 120) errors.push(`kelime sayısı yüksek: ${wordCount} (max 120)`);

  if (bulletLines.length < 5) errors.push(`madde sayısı düşük: ${bulletLines.length} (min 5, hedef 6-8)`);
  if (bulletLines.length < 6) warnings.push(`madde sayısı asgaride: ${bulletLines.length} (hedef 6-8)`);
  if (nonBulletLines.length > 1) errors.push(`${nonBulletLines.length} düz paragraf satırı var (madde işaretli liste olmalı, en fazla 1 kısa tanım cümlesine izin var)`);

  // Her madde "- **Terim**: ..." veya "- **Terim** ..." kalıbında mı (terim madde başında kalın)
  const boldLeadRe = /^-\s*\*\*[^*]+\*\*/;
  const boldLeadCount = bulletLines.filter((l) => boldLeadRe.test(l.trim())).length;
  const boldRatio = bulletLines.length ? boldLeadCount / bulletLines.length : 0;
  if (boldRatio < 0.8) {
    errors.push(
      `maddelerin sadece %${Math.round(boldRatio * 100)}'i kalın terimle başlıyor (min %80) — muhtemelen akıp giden tam cümleler, not-kartı formatında değil`
    );
  }

  // Ortalama madde uzunluğu — çok uzun madde genelde anlatı cümlesi demektir (kalın terimi olsa bile)
  const avgWordsPerBullet = bulletLines.length
    ? Math.round(bulletLines.reduce((sum, l) => sum + stripBulletMarker(l).split(/\s+/).filter(Boolean).length, 0) / bulletLines.length)
    : 0;
  if (avgWordsPerBullet > 20) warnings.push(`madde başına ortalama ${avgWordsPerBullet} kelime (>20) — maddeler çok uzun/anlatı gibi olabilir, kısalt`);

  // Yasaklı kalıplar
  for (const re of BANNED_CLOSING_RE) {
    if (re.test(bodyMarkdown)) errors.push(`şablon/kalıp kapanış cümlesi tespit edildi (regex: ${re})`);
  }
  if (RHETORICAL_RE.test(bodyMarkdown)) errors.push('retorik soru kalıbı tespit edildi');
  if (SECOND_PERSON_RE.test(bodyMarkdown)) errors.push('2. tekil şahıs hitabı tespit edildi (sen/senin/sence)');

  // Anlatı bağlaçları — madde İÇİNDE (başında değil) geçiyorsa muhtemelen cümleler birbirine bağlanmış
  const narrativeHits = bulletLines.filter((l) => NARRATIVE_CONNECTOR_RE.test(stripBulletMarker(l)));
  if (narrativeHits.length >= 2) {
    warnings.push(`${narrativeHits.length} maddede anlatı bağlacı var ("bu sayede/böylece/bu araçlarla" gibi) — akıp giden cümle olabilir, not formatına çevir`);
  }

  return {
    heading,
    ok: errors.length === 0,
    errors,
    warnings,
    wordCount,
    bulletCount: bulletLines.length,
    boldRatio: Math.round(boldRatio * 100),
    avgWordsPerBullet,
  };
}

module.exports = { lintSection, countWords };

// ---- CLI ----
if (require.main === module) {
  const { rest } = require('./topic-content-pipeline');
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };

  (async () => {
    let sections = [];
    const topicIdArg = getArg('--topic-id');
    const sectionIdArg = getArg('--section-id');
    const all = args.includes('--all');

    if (topicIdArg) {
      const topicIds = topicIdArg.split(',').map((s) => s.trim());
      const contents = await rest('GET', `topic_contents?topic_id=in.(${topicIds.join(',')})&select=id,topic_id,title`);
      const contentIds = contents.map((c) => c.id);
      if (contentIds.length) {
        sections = await rest(
          'GET',
          `topic_content_sections?topic_content_id=in.(${contentIds.join(',')})&select=id,topic_content_id,heading,body_markdown&order=id.asc`
        );
      }
    } else if (sectionIdArg) {
      const ids = sectionIdArg.split(',').map((s) => s.trim());
      sections = await rest('GET', `topic_content_sections?id=in.(${ids.join(',')})&select=id,topic_content_id,heading,body_markdown&order=id.asc`);
    } else if (all) {
      sections = await rest('GET', 'topic_content_sections?select=id,topic_content_id,heading,body_markdown&order=id.asc');
    } else {
      console.error('Kullanım: node scripts/lib/lint-section-content.js --topic-id 421,422 | --section-id 313,314 | --all');
      process.exit(1);
    }

    let failCount = 0;
    let warnCount = 0;
    for (const s of sections) {
      if (!s.body_markdown || !s.body_markdown.trim()) continue;
      const result = lintSection(s.body_markdown, { heading: s.heading });
      if (!result.ok || result.warnings.length) {
        console.log(`\n[section ${s.id}] ${result.heading} — wc=${result.wordCount} bullets=${result.bulletCount} boldRatio=%${result.boldRatio} avgWords=${result.avgWordsPerBullet}`);
        for (const e of result.errors) console.log(`  HATA: ${e}`);
        for (const w of result.warnings) console.log(`  UYARI: ${w}`);
      }
      if (!result.ok) failCount++;
      if (result.warnings.length) warnCount++;
    }
    console.log(`\nToplam ${sections.length} bölüm tarandı. ${failCount} HATA içeriyor, ${warnCount} UYARI içeriyor.`);
    process.exit(failCount > 0 ? 1 : 0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
