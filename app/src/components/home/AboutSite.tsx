import Link from 'next/link';
import { formatGradeRange } from '@/app/src/lib/homeMapping';
import type { SiteStats } from '@/app/src/lib/homeStats';

// "Ders Takip nedir?" (2026-09-29): 28 Eylül sadeleştirmesinde anasayfa gövdesinde marka adı
// neredeyse hiç geçmez oldu ve "ders takip" aramasında anasayfa geriledi. Sitenin kim olduğunu
// ve ne sunduğunu düz metinle söyleyen kısa bölüm — rakamlar ve sınıf aralığı gerçek veriden
// (sınıflar her hafta ekleniyor, elle yazılmaz). METİN SEO İÇİN KORUNMALI.
// 2026-10-02: metnin altında tek üyelik kartı (eski ayrı JoinBand'ın yerine); sayfada sıralamanın yanında.
export function AboutSite({ gradeLevels, stats }: { gradeLevels: number[]; stats: SiteStats }) {
  const gradeRange = formatGradeRange(gradeLevels);
  return (
    <section aria-labelledby="ders-takip-nedir" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h2 id="ders-takip-nedir" className="text-2xl font-bold tracking-tight text-default">
          Ders Takip nedir?
        </h2>
        <p className="leading-relaxed text-muted-foreground">
          Ders Takip, {gradeRange ? `${gradeRange} öğrencileri` : 'ortaokul ve lise öğrencileri'} için ücretsiz bir ders çalışma
          sitesidir. MEB müfredatına uygun {stats.topicCount} konu anlatımı ve {stats.questionCount} cevap anahtarlı soruyu tek
          yerde toplar.
        </p>
        <p className="leading-relaxed text-muted-foreground">
          Her konuyu önce kısa ve anlaşılır bir anlatımla öğrenir, ardından o konunun sorularıyla kendini denersin. Üye olursan
          yanlış yaptığın sorular tekrar zamanı gelince yeniden karşına çıkar; serini ve hangi konularda zorlandığını Ders Takip
          senin için takip eder. Yeni sınıflar ve dersler her hafta ekleniyor.
        </p>
      </div>
      <div className="flex flex-col gap-3 rounded-[20px] border border-indigo-100 bg-indigo-50 p-6 dark:border-indigo-500/20 dark:bg-indigo-500/10">
        <h3 className="text-lg font-bold text-default">Çözdüğün her soru kaydedilsin</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Yanlışların tekrar zamanı gelince önüne gelir, ilerlemeni görürsün, haftalık sıralamaya girersin.
        </p>
        <Link
          href="/register"
          className="flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          Ücretsiz üye ol
        </Link>
        <p className="text-center text-xs text-muted-foreground">
          Google ile saniyeler içinde ·{' '}
          <Link href="/login" className="font-semibold text-indigo-700 underline dark:text-indigo-300">
            Giriş yap
          </Link>
        </p>
      </div>
    </section>
  );
}
