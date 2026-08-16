// Tek seferlik migrasyon: topic-content-images bucket'ındaki düz (sections/{id}-{ts}.webp,
// hero/{id}-{ts}.webp) dosyaları sınıf/ders/ünite hiyerarşisine taşır, DB'deki image_url /
// hero_image_url alanlarını günceller, ardından referanssız kalan tüm eski dosyaları siler.
//
// @supabase/supabase-js yerine doğrudan REST/Storage HTTP çağrıları kullanılıyor çünkü
// bu ortamdaki Node 18, supabase-js'in realtime modülünün gerektirdiği native WebSocket'e
// sahip değil (script'in realtime'a hiç ihtiyacı yok).
//
// Kullanım: node scripts/migrate-content-images.mjs           (dry-run, hiçbir şey değiştirmez)
//           node scripts/migrate-content-images.mjs --apply   (gerçekten uygular)

import { readFileSync, writeFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const BUCKET = 'topic-content-images';

function loadEnv() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const vars = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) vars[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return vars;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY || env.NEXT_PUBLIC_SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY .env.local içinde bulunamadı');
}

const authHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function restGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: authHeaders });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function restPatch(table, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${table}?id=eq.${id} -> ${res.status} ${await res.text()}`);
}

async function storageList(prefix) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000 }),
  });
  if (!res.ok) throw new Error(`storage list ${prefix} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function storageMove(sourceKey, destinationKey) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/move`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId: BUCKET, sourceKey, destinationKey }),
  });
  if (!res.ok) throw new Error(`storage move ${sourceKey} -> ${destinationKey}: ${res.status} ${await res.text()}`);
}

async function storageRemove(paths) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) throw new Error(`storage remove -> ${res.status} ${await res.text()}`);
}

function publicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function extractStoragePath(url) {
  if (!url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length) || null;
}

function extractHierarchy(units) {
  if (!units) return null;
  const grade = Array.isArray(units.grades) ? units.grades[0] : units.grades;
  const lesson = Array.isArray(units.lessons) ? units.lessons[0] : units.lessons;
  if (!grade?.slug || !lesson?.slug) return null;
  return {
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug: units.slug || `unite-${units.id}`,
  };
}

async function main() {
  console.log(APPLY ? '=== APPLY modu ===' : '=== DRY-RUN modu (--apply ile gerçek çalıştırın) ===');

  const sectionsQuery =
    'id,image_url,topic_contents(topics(unit_id,units(id,slug,grades(slug),lessons(slug))))';
  const sections = await restGet(
    `topic_content_sections?select=${encodeURIComponent(sectionsQuery)}&image_url=not.is.null`
  );

  const heroesQuery = 'id,hero_image_url,topics(unit_id,units(id,slug,grades(slug),lessons(slug)))';
  const heroes = await restGet(
    `topic_contents?select=${encodeURIComponent(heroesQuery)}&hero_image_url=not.is.null`
  );

  const moves = [];
  const unresolved = [];

  for (const s of sections) {
    const units = s.topic_contents?.topics?.units ?? null;
    const hierarchy = extractHierarchy(units);
    const oldPath = extractStoragePath(s.image_url);
    if (!hierarchy || !oldPath) {
      unresolved.push({ kind: 'section', id: s.id, image_url: s.image_url });
      continue;
    }
    const newPath = `${hierarchy.gradeSlug}/${hierarchy.lessonSlug}/${hierarchy.unitSlug}/sections/${s.id}.webp`;
    if (oldPath === newPath) continue;
    moves.push({ kind: 'section', id: s.id, table: 'topic_content_sections', column: 'image_url', oldPath, newPath });
  }

  for (const h of heroes) {
    const units = h.topics?.units ?? null;
    const hierarchy = extractHierarchy(units);
    const oldPath = extractStoragePath(h.hero_image_url);
    if (!hierarchy || !oldPath) {
      unresolved.push({ kind: 'hero', id: h.id, hero_image_url: h.hero_image_url });
      continue;
    }
    const newPath = `${hierarchy.gradeSlug}/${hierarchy.lessonSlug}/${hierarchy.unitSlug}/hero/${h.id}.webp`;
    if (oldPath === newPath) continue;
    moves.push({ kind: 'hero', id: h.id, table: 'topic_contents', column: 'hero_image_url', oldPath, newPath });
  }

  console.log(`\nTaşınacak dosya sayısı: ${moves.length}`);
  moves.forEach((m) => console.log(`  [${m.kind} ${m.id}] ${m.oldPath} -> ${m.newPath}`));

  if (unresolved.length) {
    console.log(`\nUYARI: Hiyerarşisi çözülemeyen ${unresolved.length} kayıt (dokunulmayacak):`);
    unresolved.forEach((u) => console.log('  ', u));
  }

  if (APPLY) {
    for (const m of moves) {
      try {
        await storageMove(m.oldPath, m.newPath);
        await restPatch(m.table, m.id, { [m.column]: publicUrl(m.newPath) });
      } catch (e) {
        console.error(`  HATA [${m.kind} ${m.id}]: ${e.message}`);
      }
    }
    console.log('\nTaşıma tamamlandı.');
  }

  // Eski düz klasörlerde kalan (artık referanssız) dosyaları bul
  const orphanPaths = [];
  for (const prefix of ['sections', 'hero']) {
    const files = await storageList(prefix);
    for (const f of files ?? []) {
      orphanPaths.push(`${prefix}/${f.name}`);
    }
  }

  console.log(`\nEski düz klasörlerde kalan (silinecek) dosya sayısı: ${orphanPaths.length}`);
  orphanPaths.forEach((p) => console.log(`  DELETE ${p}`));

  writeFileSync(
    new URL('./migrate-content-images.log.json', import.meta.url),
    JSON.stringify({ ranAt: new Date().toISOString(), apply: APPLY, moves, unresolved, orphanPaths }, null, 2)
  );

  if (APPLY && orphanPaths.length) {
    try {
      await storageRemove(orphanPaths);
      console.log('\nOrphan dosyalar silindi.');
    } catch (e) {
      console.error(`HATA (remove): ${e.message}`);
    }
  }

  console.log(
    `\nÖzet: ${moves.length} taşıma, ${orphanPaths.length} silme, ${unresolved.length} çözülemeyen. Log: scripts/migrate-content-images.log.json`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
