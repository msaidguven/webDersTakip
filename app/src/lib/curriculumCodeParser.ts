// Bazı konu/ünite başlıkları müfredat koduyla birlikte girilmiş oluyor
// (örn. "BT.6.3.1. Bilgisayar Ağları"). Bu kodun asıl yeri curriculum_code
// sütunudur; bu fonksiyon başlıktan kodu ayıklar ve temiz başlığı döner.
const CODE_PATTERN = /^([A-ZÇŞĞÜÖİ]{1,6}\.\d+(?:\.\d+)*)\.?\s*[-.]?\s*(.+)$/;

export function parseCurriculumCodeFromTitle(title: string): { code: string; cleanTitle: string } | null {
  const match = CODE_PATTERN.exec(title.trim());
  if (!match) return null;
  const code = match[1];
  const cleanTitle = match[2].trim();
  if (!cleanTitle) return null;
  return { code, cleanTitle };
}
