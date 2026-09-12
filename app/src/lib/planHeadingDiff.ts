// Alt başlık planı/içeriği toplu kaydedilirken (plan/route.ts) sunucu, gelen başlıkları
// mevcutlarla METIN OLARAK BİREBİR (trim edilmiş) eşleştirir; eşleşmeyen eski satırlar
// SİLİNİR — ve o satıra bağlı görsel/diyagram (id'ye bağlı, storage'da yedeksiz) da gider.
// Bu dosya, kaydetmeden ÖNCE admin'e aynı eşleştirmeyi göstermek için sunucudaki FIFO
// eşleştirme mantığının birebir aynısını client tarafında tekrar eder (bkz. 2026-09-12
// kullanıcı talebi: "başlıklar aynı değilse bile düzeltip aynı olmasını sağlayayım,
// diyagram/görsel silinir mi uyarsın").

export type ExistingSectionForDiff = {
  id: number;
  heading: string;
  hasDiagram: boolean;
  hasImage: boolean;
};

export type PlanHeadingDiff = {
  // Eşleşmeyen (silinecek) eski satırlar — kalan sırayla.
  removedSections: ExistingSectionForDiff[];
  // pastedHeadings içinde, hiçbir eski başlıkla eşleşmeyen indexler.
  unmatchedNewIndexes: number[];
};

export function computePlanHeadingDiff(
  existingSections: ExistingSectionForDiff[],
  pastedHeadings: string[]
): PlanHeadingDiff {
  const queueByHeading = new Map<string, ExistingSectionForDiff[]>();
  for (const s of existingSections) {
    const list = queueByHeading.get(s.heading) || [];
    list.push(s);
    queueByHeading.set(s.heading, list);
  }

  const unmatchedNewIndexes: number[] = [];
  pastedHeadings.forEach((heading, idx) => {
    const trimmed = heading.trim();
    const queue = queueByHeading.get(trimmed);
    if (queue && queue.length) {
      queue.shift();
    } else {
      unmatchedNewIndexes.push(idx);
    }
  });

  const removedSections: ExistingSectionForDiff[] = [];
  queueByHeading.forEach((queue) => removedSections.push(...queue));

  return { removedSections, unmatchedNewIndexes };
}

// removedSections içinde en az bir satırın kaybedecek bir görsel/diyagramı var mı —
// sadece buton rengi/metni için kullanılır (ör. ilk kayıtta ya da silinen satırların
// hiçbirinde medya yoksa "riskli" sayılmaz, ama yine de admin'e gösterilir).
export function planDiffHasRiskyLoss(diff: PlanHeadingDiff): boolean {
  return diff.removedSections.some((s) => s.hasDiagram || s.hasImage);
}

// PlanModal/NotebookPlanModal açıldığında mevcut alt başlıkları (heading + diyagram/görsel
// var mı) çekmek için ortak yardımcı — bundle endpoint'i zaten bunları döndürüyor.
export async function fetchExistingSectionsForDiff(topicId: number): Promise<ExistingSectionForDiff[]> {
  const res = await fetch(`/api/admin/topic-sections?topicId=${topicId}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data?.sections)) return [];
  return (data.sections as { id: number; heading: string; diagram_svg: string | null; image_url: string | null }[]).map((s) => ({
    id: s.id,
    heading: s.heading,
    hasDiagram: Boolean(s.diagram_svg),
    hasImage: Boolean(s.image_url),
  }));
}
