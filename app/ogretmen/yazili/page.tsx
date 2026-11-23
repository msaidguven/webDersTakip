// Öğretmen paneli → "Yazılı hazırla" (docs/yazili-sorulari-plani.md 4. adım). Sunucu sayfası: yetki
// (öğretmen ya da admin; onay şartı yok) + öğretmenin branşındaki yayındaki yazılılar + seçili yazılının havuzu.
// Masaüstünde sol sidebar (dersler/yazılılar) + sağda kurucu; mobilde önce ders seçimi → sonra ünite/konu → sorular.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTeacherAccess } from '@/app/src/lib/teacherAuth';
import { listTeacherExams, loadPaperDraft, loadTeacherExam, loadTeacherPaperDefaults } from '@/app/src/lib/yazili/teacher';
import { pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import r from '@/app/src/components/robotic/robotic.module.css';
import { YaziliBuilder } from './YaziliBuilder';
import { YaziliSidebar } from './YaziliSidebar';

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

export default async function OgretmenYaziliPage({ searchParams }: { searchParams: Promise<{ yazili?: string }> }) {
  const access = await getTeacherAccess();
  const requested = Number((await searchParams).yazili);
  const shell = (children: React.ReactNode) => (
    <div className={pageShellCls}>
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6">{children}</div>
    </div>
  );

  if (!access.ok) {
    if (access.reason === 'login') {
      const back = encodeURIComponent(`/ogretmen/yazili${Number.isInteger(requested) && requested > 0 ? `?yazili=${requested}` : ''}`);
      return shell(
        <Notice
          title="Yazılı hazırlamak için giriş yap"
          text="Soru havuzundan kendi yazılı kağıdını kur; seçtiğin sorular hesabında saklanır, kağıdı ve cevap anahtarını PDF ya da Word olarak indir. Öğretmen hesapları içindir."
          action={{ href: `/login?redirectTo=${back}`, label: 'Giriş yap' }}
          secondary={{ href: `/register?rol=ogretmen&redirectTo=${back}`, label: 'Öğretmen olarak ücretsiz kayıt ol' }}
        />
      );
    }
    return shell(<Notice title="Bu alan öğretmenler içindir" text="Öğretmen hesabıyla giriş yaptığında yazılı kağıdı hazırlayabilirsin." />);
  }

  const exams = (await listTeacherExams(access)).sort(
    (a, b) =>
      a.gradeName.localeCompare(b.gradeName, 'tr', { numeric: true }) ||
      a.lessonName.localeCompare(b.lessonName, 'tr') ||
      a.label.localeCompare(b.label, 'tr')
  );

  const hasExplicitExam = Number.isInteger(requested) && requested > 0 && exams.some((e) => e.id === requested);
  const selected = hasExplicitExam ? exams.find((e) => e.id === requested)! : exams[0];

  const [loaded, profileDefaults, initialDraft] = await Promise.all([
    selected ? loadTeacherExam(access, selected.id) : null,
    loadTeacherPaperDefaults(access.user.id),
    selected ? loadPaperDraft(access.user.id, selected.id) : null,
  ]);

  const sidebarExams = exams.map((e) => ({
    id: e.id,
    gradeName: e.gradeName,
    lessonName: e.lessonName,
    label: e.label,
    questionCount: e.questionCount,
    examDate: e.examDate,
  }));

  return shell(
    <>
      <div className={`flex flex-wrap items-center justify-between gap-3 ${hasExplicitExam ? 'hidden lg:flex' : 'flex'}`}>
        <div>
          <p className={r.label}>Öğretmen paneli</p>
          <h1 className={`mt-1 text-2xl font-bold uppercase text-default sm:text-3xl ${r.display}`}>Yazılı hazırla</h1>
        </div>
      </div>

      {!exams.length ? (
        <Notice
          title="Branşında henüz hazır yazılı yok"
          text="Yazılı soruları ders ders ekleniyor. Branşındaki bir yazılı yayımlandığında burada görünecek."
          action={{ href: '/yazili-sorulari', label: 'Yazılı sorularına göz at' }}
        />
      ) : (
        <div className="mt-4 lg:mt-6 lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* Masaüstü: sabit sol sidebar */}
          <div className="hidden lg:block">
            <YaziliSidebar exams={sidebarExams} selectedId={selected?.id ?? null} mode="desktop" />
          </div>

          {/* Mobil: yazılı seçilmediyse önce ders/yazılı listesi */}
          {!hasExplicitExam && (
            <div className="lg:hidden">
              <YaziliSidebar exams={sidebarExams} selectedId={null} mode="mobile" />
            </div>
          )}

          {/* Sağ ana alan: masaüstünde her zaman, mobilde ders seçilince */}
          <div className={`min-w-0 ${hasExplicitExam ? 'block' : 'hidden lg:block'}`}>
            {loaded ? (
              <YaziliBuilder
                key={loaded.item.id}
                backHref="/ogretmen/yazili"
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
                initialDraft={initialDraft}
                profileDefaults={profileDefaults}
              />
            ) : (
              <Notice title="Yazılı yüklenemedi" text="Sayfayı yenileyip tekrar dene." />
            )}
          </div>
        </div>
      )}
    </>
  );
}
