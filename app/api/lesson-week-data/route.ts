import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getLessonWeekData } from '@/app/src/lib/lessonWeekData';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gradeId = Number(searchParams.get('gradeId'));
  const lessonId = Number(searchParams.get('lessonId'));
  const unitId = Number(searchParams.get('unitId'));
  const week = Number(searchParams.get('week'));
  // Verilirse sadece bu konunun ağır içeriği (section/highlight) çekilir — diğer konular
  // hafif kalır. DersClient bunu tek bir konuyu arkaplanda/isteğe bağlı yüklemek için kullanır;
  // verilmezse (ör. hafta değişimi, başka ünitenin arkaplanda ısıtılması) eskisi gibi ünitedeki
  // tüm konuların tam içeriği döner.
  const topicIdParam = searchParams.get('topicId');
  const topicId = topicIdParam != null ? Number(topicIdParam) : null;
  // Konu sayfasının hiyerarşi barındaki Sınıf/Ders/Ünite/Konu dropdown zinciri (DersClient.tsx:
  // fetchTopicsForUnit) henüz commit edilmemiş, FARKLI bir ders/sınıfa ait üniteleri önizlerken
  // bunu gönderir — o sayfa admin dahil KİMSEYE taslak göstermiyor, bu yüzden admin bypass'ı
  // burada devre dışı bırakılır (mevcut aynı-ders içi ünite ısıtma/önbellekleme çağrıları
  // publicOnly göndermez, onların davranışı değişmez).
  const publicOnly = searchParams.get('publicOnly') === '1';

  if (![gradeId, lessonId, unitId, week].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Eksik veya hatalı parametre' }, { status: 400 });
  }

  const supabase = await createClient();
  const isAdmin = !publicOnly && (await isViewerAdmin(supabase));
  const { outcomes, contents } = await getLessonWeekData(
    supabase,
    unitId,
    week,
    isAdmin,
    topicId != null && Number.isFinite(topicId) ? { id: topicId } : null
  );

  return NextResponse.json({ outcomes, contents });
}
