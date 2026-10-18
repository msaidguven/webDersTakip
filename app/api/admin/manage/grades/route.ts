import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/src/lib/adminAuth";
import { createServerClient as createServiceClient } from "@/utils/supabase/server-public";
import { revalidateHomepage } from "@/app/src/lib/topicPageRevalidation";

// Sınıfın sitede görünürlüğünü (grades.is_active) değiştirir. Sınıf açılıp kapanınca
// ana sayfa, sınıf seçimi, sitemap ve o sınıfın altındaki TÜM sayfalar (haftalık ISR)
// değişir; nadir bir işlem olduğu için sınıf yolu 'layout' kapsamıyla toptan invalide edilir.
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as {
    gradeId?: unknown;
    isActive?: unknown;
  } | null;
  const gradeId = Number(body?.gradeId);
  if (
    !Number.isInteger(gradeId) ||
    gradeId <= 0 ||
    typeof body?.isActive !== "boolean"
  ) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("grades")
    .update({ is_active: body.isActive })
    .eq("id", gradeId)
    .select("slug")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "Sınıf bulunamadı" }, { status: 404 });

  revalidateHomepage();
  try {
    revalidatePath("/sinif");
    revalidatePath("/sitemap.xml");
    if (data.slug) revalidatePath(`/${data.slug}`, "layout");
  } catch (e) {
    console.error("[grades PATCH] revalidate başarısız:", e);
  }
  return NextResponse.json({ ok: true });
}
