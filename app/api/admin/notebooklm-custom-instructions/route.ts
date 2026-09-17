import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';

// NotebookLM'in normal sohbet kutusunun karakter sınırı (yayınlanmış bir rakam yok, topluluk
// raporları ~2000 karakter civarı gösteriyor) yüzünden, konu üretme promptları uzayınca
// (özellikle çok kazanımlı konularda) sığmıyordu (kullanıcı raporu, 2026-09-17). Kalite
// kurallarını her mesajda tekrarlamak yerine, admin bunu notebook'un "Özel Talimatlar"
// alanına (10.000 karakter limitli, kalıcı) BİR KERE kaydediyor — 03/09/24. promptlar artık
// bu kuralları tekrar içermiyor, sadece konuya özgü kısa bağlamı taşıyor.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const prompt = await readFile(
    path.join(process.cwd(), 'app', 'prompt', '00-notebooklm-custom-instructions.md'),
    'utf8'
  );

  return NextResponse.json({ prompt });
}
