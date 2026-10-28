// Öğretmen paneli → "Yazılı hazırla" (docs/yazili-sorulari-plani.md 4. adım). Sunucu sayfası: yetki
// (öğretmen ya da admin; onay şartı yok) + öğretmenin branşındaki yayındaki yazılılar + seçili yazılının havuzu.
// Kağıt kurma tamamen istemcide (YaziliBuilder); indirme /api/ogretmen/yazili/{pdf,word}.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTeacherAccess } from '@/app/src/lib/teacherAuth';
import { listTeacherExams, loadTeacherExam, loadTeacherPaperDefaults } from '@/app/src/lib/yazili/teacher';
import { nationalCountPerLo } from '@/app/src/lib/yazili/papers';
import { pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import r from '@/app/src/components/robotic/robotic.module.css';
import { OgretmenTabs } from '../OgretmenTabs';
import { YaziliBuilder } from './YaziliBuilder';

export const metadata: Metadata = {
  title: 'Yazılı Hazırla · Öğretmen Paneli',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function Notice({ title, text, action, secondary }: { title: string; text: string; action?: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  return (
    <div className={`mx-auto mt-10 max-w-xl p-8 text-center ${r.panel}`}>
      <p className="text-lg font-bold text-default">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      {action && (
        <Link href={action.href} className={`mt-5 inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-bold ${r.btnNeon} ${r.btnText}`}>
          {action.label}
        </Link>
      )}
      {secondary && (
        <p className="mt-3 text-sm">
          <Link href={secondary.href} className={`font-semibold hover:underline ${r.accent}`}>{secondary.label}</Link>
        </p>
      )}
    </div>
  );
}

const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

export default async function OgretmenYaziliPage({ searchParams }: { searchParams: Promise<{ yazili?: string }> }) {
  const access = await getTeacherAccess();
  const requested = Number((await searchParams).yazili);
  const shell = (children: React.ReactNode) => (
    <div className={pageShellCls}>
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">{children}</div>
    </div>
  );

  if (!access.ok) {
    if (access.reason === 'login') {
      // Yazılı sayfasındaki "Öğretmen misiniz?" bağlantısından gelen, giriş/kayıt sonrası aynı yazılıya döner.
      const back = encodeURIComponent(`/ogretmen/yazili${Number.isInteger(requested) && requested > 0 ? `?yazili=${requested}` : ''}`);
      return shell(
        <Notice
          title="Yazılı hazırlamak için giriş yap"
          text="Soru havuzundan kendi yazılı kağıdını kur; MEB dağılımına göre kontrol et, kağıdı ve cevap anahtarını PDF ya da Word olarak indir. Öğretmen hesapları içindir."
          action={{ href: `/login?redirectTo=${back}`, label: 'Giriş yap' }}
          secondary={{ href: `/register?rol=ogretmen&redirectTo=${back}`, label: 'Öğretmen olarak ücretsiz kayıt ol' }}
        />
      );
    }
    return shell(<Notice title="Bu alan öğretmenler içindir" text="Öğretmen hesabıyla giriş yaptığında yazılı kağıdı hazırlayabilirsin." />);
  }

  const exams = (await listTeacherExams(access)).sort(
    (a, b) => (a.examDate ?? '9999').localeCompare(b.examDate ?? '9999') || a.gradeName.localeCompare(b.gradeName, 'tr', { numeric: true })
  );
  const selected = exams.find((e) => e.id === requested) ?? exams[0];
  const [loaded, profileDefaults] = await Promise.all([
    selected ? loadTeacherExam(access, selected.id) : null,
    loadTeacherPaperDefaults(access.user.id),
  ]);

  return shell(
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={r.label}>Öğretmen paneli</p>
          <h1 className={`mt-1 text-2xl font-bold uppercase text-default sm:text-3xl ${r.display}`}>Yazılı hazırla</h1>
        </div>
        <OgretmenTabs active="/ogretmen/yazili" />
      </div>

      {!exams.length ? (
        <Notice
          title="Branşında henüz hazır yazılı yok"
          text="Yazılı soruları ders ders ekleniyor. Branşındaki bir yazılı yayımlandığında burada görünecek."
          action={{ href: '/yazili-sorulari', label: 'Yazılı sorularına göz at' }}
        />
      ) : (
        <>
          <nav aria-label="Yazılı seç" className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {exams.map((e) => (
              <Link
                key={e.id}
                href={`/ogretmen/yazili?yazili=${e.id}`}
                aria-current={e.id === selected?.id ? 'page' : undefined}
                className={`shrink-0 rounded-2xl px-4 py-3 text-left ${r.item} ${r.itemHover} ${e.id === selected?.id ? r.neonBorder : ''}`}
              >
                <span className="block text-sm font-bold text-default">{e.gradeName} {e.lessonName}</span>
                <span className="block text-xs text-muted-foreground">
                  {e.label} · {e.questionCount} soru{e.examDate ? ` · ${formatDate(e.examDate)}` : ''}
                </span>
              </Link>
            ))}
          </nav>

          {loaded ? (
            <YaziliBuilder
              key={loaded.item.id}
              exam={{
                id: loaded.item.id,
                gradeName: loaded.data.gradeName,
                lessonName: loaded.data.lessonName,
                label: loaded.data.exam.label,
                national: loaded.data.exam.national,
                path: loaded.data.exam.path,
                defaultTitle: `${loaded.data.gradeName} ${loaded.data.lessonName} Dersi ${loaded.data.exam.label} Sınavı`,
              }}
              topics={loaded.data.topics.filter((t) => t.questions.length)}
              scenarios={loaded.data.scenarios}
              scenarioCount={loaded.data.scenarioCount}
              nationalNeed={(() => {
                const codes = [...new Set(loaded.data.topics.flatMap((t) => t.loCodes))];
                return Object.fromEntries(codes.map((c) => [c, nationalCountPerLo(codes.length)]));
              })()}
              profileDefaults={profileDefaults}
            />
          ) : (
            <Notice title="Yazılı yüklenemedi" text="Sayfayı yenileyip tekrar dene." />
          )}
        </>
      )}
    </>
  );
}
