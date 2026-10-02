import { formatGradeRange } from '@/app/src/lib/homeMapping';
import type { SiteStats } from '@/app/src/lib/homeStats';
import { GraduationCap } from 'lucide-react';
import { SectionCard } from './SectionCard';

// "Ders Takip nedir?" (2026-09-29): 28 Eylül sadeleştirmesinde anasayfa gövdesinde marka adı
// neredeyse hiç geçmez oldu ve "ders takip" aramasında anasayfa geriledi. Sitenin kim olduğunu
// ve ne sunduğunu düz metinle söyleyen kısa bölüm — rakamlar ve sınıf aralığı gerçek veriden
// (sınıflar her hafta ekleniyor, elle yazılmaz).
export function AboutSite({ gradeLevels, stats }: { gradeLevels: number[]; stats: SiteStats }) {
  const gradeRange = formatGradeRange(gradeLevels);
  return (
    // Renkli bölüm kartı (2026-10-02). Metin aynen korunuyor — marka sinyali (SEO) için önemli.
    <SectionCard
      tone="rose"
      headingId="ders-takip-nedir"
      icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
      title="Ders Takip nedir?"
      subtitle="Ücretsiz ders çalışma sitesi"
      bodyClassName="flex flex-col gap-4 p-5 sm:p-7"
    >
      <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
        Ders Takip, {gradeRange ? `${gradeRange} öğrencileri` : 'ortaokul ve lise öğrencileri'} için ücretsiz bir ders
        çalışma sitesidir. MEB müfredatına uygun {stats.topicCount} konu anlatımı ve {stats.questionCount} cevap
        anahtarlı soruyu tek yerde toplar.
      </p>
      <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
        Her konuyu önce kısa ve anlaşılır bir anlatımla öğrenir, ardından o konunun sorularıyla kendini denersin. Üye
        olursan yanlış yaptığın sorular tekrar zamanı gelince yeniden karşına çıkar; serini ve hangi konularda
        zorlandığını Ders Takip senin için takip eder. Yeni sınıflar ve dersler her hafta ekleniyor.
      </p>
    </SectionCard>
  );
}
