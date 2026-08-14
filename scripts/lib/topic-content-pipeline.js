// Admin panelinin "prompt kopyala -> AI'a yapıştır -> cevabı yapıştır -> kaydet" akışının
// otomatikleştirilmiş hâli. Admin API route'ları (app/api/admin/topic-sections/*) cookie/session
// gerektirdiği için, burada aynı iş mantığını doğrudan Supabase REST üzerinden (service role) uyguluyoruz.
// Bkz: app/api/admin/topic-sections/plan/route.ts, .../section/[sectionId]/route.ts,
//      app/src/lib/outcomeCodes.ts, app/src/lib/topicContentHighlights.ts

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
  envContent.split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function rest(method, pathAndQuery, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${pathAndQuery} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const LETTERS = ['a', 'b', 'c', 'ç', 'd', 'e', 'f', 'g', 'ğ', 'h', 'ı', 'i', 'j', 'k', 'l'];
function letterAt(idx) {
  return LETTERS[idx] ?? `k${idx + 1}`;
}

async function getGradeLessonIds(gradeName, lessonName) {
  const grades = await rest('GET', `grades?name=ilike.*${encodeURIComponent(gradeName)}*&select=id,name`);
  const lessons = await rest('GET', `lessons?name=ilike.*${encodeURIComponent(lessonName)}*&select=id,name`);
  if (!grades.length) throw new Error(`Sınıf bulunamadı: ${gradeName}`);
  if (!lessons.length) throw new Error(`Ders bulunamadı: ${lessonName}`);
  return { gradeId: grades[0].id, lessonId: lessons[0].id, gradeName: grades[0].name, lessonName: lessons[0].name };
}

// Verilen sınıf+ders için, tüm üniteler boyunca ders sırasına göre (ünite order_no, konu order_no) tüm konuları döner.
async function listTopics(gradeId, lessonId) {
  const units = await rest('GET', `units?grade_id=eq.${gradeId}&lesson_id=eq.${lessonId}&order=order_no.asc&select=id,title,order_no`);
  const result = [];
  for (const u of units) {
    const topics = await rest('GET', `topics?unit_id=eq.${u.id}&order=order_no.asc&select=id,title,order_no,slug`);
    for (const t of topics) {
      result.push({ ...t, unitId: u.id, unitTitle: u.title, unitOrderNo: u.order_no });
    }
  }
  return result;
}

// order_index tek başına güvenilir değil (haftalar arası karışabilir), önce haftaya göre sıralar.
function sortOutcomes(outcomes) {
  return [...outcomes].sort((a, b) => {
    const wa = a.startWeek ?? Infinity;
    const wb = b.startWeek ?? Infinity;
    if (wa !== wb) return wa - wb;
    return (a.order_index ?? 0) - (b.order_index ?? 0);
  });
}

// Konunun kazanımlarını döner; kodu eksik olanlara sırayla harf atar (assign-codes route'uyla aynı mantık).
async function getTopicOutcomes(topicId) {
  const outcomesData = await rest('GET', `outcomes?topic_id=eq.${topicId}&order=order_index.asc&select=id,description,order_index,code`);
  const outcomeIds = outcomesData.map((o) => o.id);
  const weeksData = outcomeIds.length
    ? await rest('GET', `outcome_weeks?outcome_id=in.(${outcomeIds.join(',')})&select=outcome_id,start_week,end_week`)
    : [];
  const weekByOutcomeId = new Map(weeksData.map((w) => [w.outcome_id, w]));

  const withWeeks = outcomesData.map((o) => ({ ...o, startWeek: weekByOutcomeId.get(o.id)?.start_week ?? null, endWeek: weekByOutcomeId.get(o.id)?.end_week ?? null }));
  const sorted = sortOutcomes(withWeeks);

  const missing = sorted.filter((o) => !o.code?.trim());
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].code?.trim()) {
      const code = letterAt(i);
      await rest('PATCH', `outcomes?id=eq.${sorted[i].id}`, { code });
      sorted[i].code = code;
    }
  }
  if (missing.length) {
    console.log(`   (${missing.length} kazanıma kod atandı)`);
  }

  return sorted;
}

async function getOrCreateTopicContent(topicId, fallbackTitle) {
  const existing = await rest('GET', `topic_contents?topic_id=eq.${topicId}&select=id`);
  if (existing.length) return existing[0].id;

  const created = await rest('POST', 'topic_contents', [{
    topic_id: topicId,
    title: fallbackTitle,
    body_markdown: '',
    is_published: false,
    source: 'ai_generated',
  }]);
  return created[0].id;
}

// Yeniden çalıştırılabilir olsun diye (regenerate), önceki sections/highlights'ı temizler.
async function clearTopicContentChildren(topicContentId) {
  const oldSections = await rest('GET', `topic_content_sections?topic_content_id=eq.${topicContentId}&select=id`);
  const oldSectionIds = oldSections.map((s) => s.id);
  if (oldSectionIds.length) {
    await rest('DELETE', `topic_content_section_outcomes?section_id=in.(${oldSectionIds.join(',')})`);
    await rest('DELETE', `topic_content_sections?topic_content_id=eq.${topicContentId}`);
  }
  await rest('DELETE', `topic_content_highlights?topic_content_id=eq.${topicContentId}`);
}

// Tek bir konu için: kazanım kodlarını tamamlar, alt başlıkları + içerikleri + kapağı kaydeder ve yayınlar.
// plan: { title?, sections: [{heading, matched_outcome_codes, body_markdown, needs_image, image_prompt}], cover: { subtitle, image_prompt, highlights: [{position, icon, title, description}] } }
async function applyTopicPlan(topicId, plan) {
  const [topicRows] = await Promise.all([rest('GET', `topics?id=eq.${topicId}&select=id,title`)]);
  const topic = topicRows[0];
  if (!topic) throw new Error(`Konu bulunamadı: ${topicId}`);

  const outcomes = await getTopicOutcomes(topicId);
  const outcomeIdByCode = new Map(outcomes.map((o) => [o.code, o.id]));

  const topicContentId = await getOrCreateTopicContent(topicId, topic.title);
  await clearTopicContentChildren(topicContentId);

  await rest('PATCH', `topic_contents?id=eq.${topicContentId}`, {
    title: plan.title || topic.title,
    body_markdown: '',
    subtitle: plan.cover.subtitle,
    is_published: true,
    source: 'ai_generated',
    generation_meta: plan.cover.image_prompt ? { heroImagePrompt: plan.cover.image_prompt } : null,
  });

  const insertedSections = await rest('POST', 'topic_content_sections', plan.sections.map((s, idx) => ({
    topic_content_id: topicContentId,
    order_no: idx,
    heading: s.heading,
    body_markdown: s.body_markdown,
    image_prompt: s.needs_image ? s.image_prompt : null,
    status: 'content_ready',
  })));

  const links = [];
  const unresolvedCodes = new Set();
  insertedSections.forEach((inserted, idx) => {
    for (const code of plan.sections[idx].matched_outcome_codes || []) {
      const outcomeId = outcomeIdByCode.get(code);
      if (outcomeId) links.push({ section_id: inserted.id, outcome_id: outcomeId });
      else unresolvedCodes.add(code);
    }
  });
  if (links.length) await rest('POST', 'topic_content_section_outcomes', links);

  if (plan.cover.highlights?.length) {
    await rest('POST', 'topic_content_highlights', plan.cover.highlights.map((h, idx) => ({
      topic_content_id: topicContentId,
      position: h.position,
      icon: h.icon || null,
      title: h.title,
      description: h.description,
      order_no: idx,
    })));
  }

  return { topicId, topicContentId, sectionIds: insertedSections.map((s) => s.id), unresolvedCodes: Array.from(unresolvedCodes) };
}

module.exports = { rest, getGradeLessonIds, listTopics, getTopicOutcomes, getOrCreateTopicContent, clearTopicContentChildren, applyTopicPlan };
