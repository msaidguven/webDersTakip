// Kullanım: node scripts/apply-content-plan.js scripts/content-plans/<dosya>.js
// Plan dosyası, module.exports olarak applyTopicPlan'ın beklediği { title?, sections, cover } şeklinde
// bir obje veya bu şekildeki objelerin dizisini export etmeli (bkz. scripts/lib/topic-content-pipeline.js).
const path = require('path');
const { applyTopicPlan } = require('./lib/topic-content-pipeline');

async function main() {
  const planPath = process.argv[2];
  if (!planPath) {
    console.error('Kullanım: node scripts/apply-content-plan.js <plan-dosyası.js>');
    process.exit(1);
  }

  const plans = require(path.resolve(planPath));
  const list = Array.isArray(plans) ? plans : [plans];

  for (const plan of list) {
    console.log(`\n→ Konu ${plan.topicId} işleniyor...`);
    const result = await applyTopicPlan(plan.topicId, plan);
    console.log(`   Kaydedildi. topic_content_id=${result.topicContentId}, sections=[${result.sectionIds.join(', ')}]`);
    if (result.unresolvedCodes.length) {
      console.warn(`   UYARI: eşlenemeyen kazanım kodları: ${result.unresolvedCodes.join(', ')}`);
    }
  }

  console.log('\nTÜM PLANLAR UYGULANDI.');
}

main().catch((e) => { console.error('HATA:', e); process.exit(1); });
