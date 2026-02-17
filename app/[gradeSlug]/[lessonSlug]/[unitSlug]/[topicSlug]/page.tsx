import { createPublicClient } from '@/utils/supabase/public';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { 
  ChevronRight, 
  Home, 
  GraduationCap, 
  BookOpen, 
  FileText,
  PlayCircle,
  CheckCircle
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// Statik export için tüm grade+lesson+unit+topic kombinasyonlarını önceden belirle
export async function generateStaticParams() {
  const supabase = createPublicClient();
  
  // Aktif topic'leri çek
  const { data: topics } = await supabase
    .from('topics')
    .select('id, slug, unit_id')
    .eq('is_active', true)
    .eq('order_status', 'approved');
  
  if (!topics || topics.length === 0) {
    return [];
  }
  
  const unitIds = [...new Set(topics.map(t => t.unit_id))];
  
  // Unit bilgilerini çek
  const { data: units } = await supabase
    .from('units')
    .select('id, slug, lesson_id')
    .in('id', unitIds)
    .eq('is_active', true);
  
  // Unit grade ilişkilerini çek
  const { data: unitGrades } = await supabase
    .from('unit_grades')
    .select('unit_id, grade_id')
    .in('unit_id', unitIds);
  
  const gradeIds = [...new Set((unitGrades || []).map(ug => ug.grade_id))];
  const lessonIds = [...new Set((units || []).map(u => u.lesson_id))];
  
  // Grade slugsını çek
  const { data: grades } = await supabase
    .from('grades')
    .select('id, slug')
    .in('id', gradeIds);
  
  // Lesson slugsını çek
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, slug')
    .in('id', lessonIds);
  
  const gradeMap = new Map((grades || []).map(g => [g.id, g.slug]));
  const lessonMap = new Map((lessons || []).map(l => [l.id, l.slug]));
  const unitMap = new Map((units || []).map(u => [u.id, { slug: u.slug, lesson_id: u.lesson_id }]));
  
  // unit_id -> grade_id mapping (ilk eşleşmeyi al)
  const unitGradeMap = new Map<number, number>();
  for (const ug of (unitGrades || [])) {
    if (!unitGradeMap.has(ug.unit_id)) {
      unitGradeMap.set(ug.unit_id, ug.grade_id);
    }
  }
  
  const params: { gradeSlug: string; lessonSlug: string; unitSlug: string; topicSlug: string }[] = [];
  
  for (const topic of topics) {
    const unit = unitMap.get(topic.unit_id);
    const gradeId = unitGradeMap.get(topic.unit_id);
    const gradeSlug = gradeId ? gradeMap.get(gradeId) : undefined;
    const lessonSlug = unit ? lessonMap.get(unit.lesson_id) : undefined;
    
    if (unit?.slug && gradeSlug && lessonSlug && topic.slug) {
      params.push({
        gradeSlug: gradeSlug,
        lessonSlug: lessonSlug,
        unitSlug: unit.slug,
        topicSlug: topic.slug,
      });
    }
  }
  
  return params;
}

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug: string;
}

interface GradeRow {
  id: number;
  name: string;
  slug: string;
}

interface LessonRow {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}

interface UnitRow {
  id: number;
  title: string;
  slug: string;
  lesson_id: number;
}

interface TopicRow {
  id: number;
  title: string;
  slug: string;
  unit_id: number;
}

interface ContentRow {
  id: number;
  title: string;
  content: string;
  order_no: number;
}

interface OutcomeRow {
  id: number;
  description: string;
}

export async function generateMetadata({ params }: { params: Params }) {
  const supabase = createPublicClient();
  
  const [{ data: grade }, { data: lesson }, { data: unit }, { data: topic }] = await Promise.all([
    supabase.from('grades').select('name').eq('slug', params.gradeSlug).single(),
    supabase.from('lessons').select('name').eq('slug', params.lessonSlug).single(),
    supabase.from('units').select('title').eq('slug', params.unitSlug).single(),
    supabase.from('topics').select('title').eq('slug', params.topicSlug).single(),
  ]);
  
  return {
    title: grade && lesson && unit && topic 
      ? `${topic.title} - ${grade.name} ${lesson.name} | Ders Takip` 
      : 'Ders Takip',
    description: topic ? `${grade?.name} ${lesson?.name} ${unit?.title} ${topic.title} konusu` : undefined,
  };
}

export default async function TopicDetailPage({ params }: { params: Params }) {
  const supabase = createPublicClient();
  
  // Grade'i slug ile çek
  const { data: gradeRow, error: gradeError } = await supabase
    .from('grades')
    .select('id, name, slug')
    .eq('slug', params.gradeSlug)
    .single();

  if (gradeError || !gradeRow) {
    console.error('[TopicDetailPage] Grade bulunamadi:', gradeError);
    notFound();
  }
  const grade = gradeRow as unknown as GradeRow;

  // Lesson'ı slug ile çek
  const { data: lessonRow, error: lessonError } = await supabase
    .from('lessons')
    .select('id, name, slug, icon')
    .eq('slug', params.lessonSlug)
    .single();

  if (lessonError || !lessonRow) {
    console.error('[TopicDetailPage] Lesson bulunamadi:', lessonError);
    notFound();
  }
  const lesson = lessonRow as unknown as LessonRow;

  // Unit'i slug ile çek
  const { data: unitRow, error: unitError } = await supabase
    .from('units')
    .select('id, title, slug, lesson_id')
    .eq('slug', params.unitSlug)
    .eq('lesson_id', lesson.id)
    .single();

  if (unitError || !unitRow) {
    console.error('[TopicDetailPage] Unit bulunamadi:', unitError);
    notFound();
  }
  const unit = unitRow as unknown as UnitRow;

  // Topic'i slug ile çek
  const { data: topicRow, error: topicError } = await supabase
    .from('topics')
    .select('id, title, slug, unit_id')
    .eq('slug', params.topicSlug)
    .eq('unit_id', unit.id)
    .single();

  if (topicError || !topicRow) {
    console.error('[TopicDetailPage] Topic bulunamadi:', topicError);
    notFound();
  }
  const topic = topicRow as unknown as TopicRow;

  // Konu içeriklerini çek
  const { data: contentsData, error: contentsError } = await supabase
    .from('topic_contents')
    .select('id, title, content, order_no')
    .eq('topic_id', topic.id)
    .order('order_no');

  if (contentsError) {
    console.error('[TopicDetailPage] Contents sorgu hatasi:', contentsError);
  }
  const contents = (contentsData as ContentRow[]) || [];

  // Kazanımları çek
  const { data: outcomesData, error: outcomesError } = await supabase
    .from('outcomes')
    .select('id, description')
    .eq('topic_id', topic.id)
    .order('order_index');

  if (outcomesError) {
    console.error('[TopicDetailPage] Outcomes sorgu hatasi:', outcomesError);
  }
  const outcomes = (outcomesData as OutcomeRow[]) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-2xl">{lesson.icon || '📘'}</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{topic.title}</h1>
              <p className="text-indigo-100 text-sm">{grade.name} • {lesson.name} • {unit.title}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-default">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted flex-wrap">
            <Link href="/" className="hover:text-default transition-colors flex items-center gap-1">
              <Home className="w-4 h-4" />
              Anasayfa
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/${params.gradeSlug}`} className="hover:text-default transition-colors">
              {grade.name}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/${params.gradeSlug}/${params.lessonSlug}`} className="hover:text-default transition-colors">
              {lesson.name}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/${params.gradeSlug}/${params.lessonSlug}/${params.unitSlug}`} className="hover:text-default transition-colors">
              {unit.title}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-default font-medium">{topic.title}</span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Kazanımlar */}
        {outcomes.length > 0 && (
          <div className="mb-8 bg-surface-elevated rounded-xl border border-default p-6">
            <h2 className="text-lg font-semibold text-default mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Kazanımlar
            </h2>
            <ul className="space-y-3">
              {outcomes.map((outcome) => (
                <li key={outcome.id} className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></span>
                  <span className="text-default">{outcome.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Konu İçerikleri */}
        <div className="space-y-6">
          {contents.length === 0 ? (
            <div className="text-center py-12 bg-surface-elevated rounded-xl border border-default">
              <FileText className="w-12 h-12 text-muted mx-auto mb-4" />
              <p className="text-muted">Bu konuda henüz içerik bulunmuyor.</p>
            </div>
          ) : (
            contents.map((content, index) => (
              <article key={content.id} className="bg-surface-elevated rounded-xl border border-default overflow-hidden">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-default mb-4 flex items-center gap-2">
                    <PlayCircle className="w-5 h-5 text-indigo-500" />
                    {content.title}
                  </h2>
                  <div 
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: content.content }}
                  />
                </div>
              </article>
            ))
          )}
        </div>

        {/* Navigation */}
        <div className="mt-8 pt-6 border-t border-default flex flex-wrap items-center gap-4">
          <Link 
            href={`/${params.gradeSlug}/${params.lessonSlug}/${params.unitSlug}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-default transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Ünite Konularına Dön
          </Link>
          <Link 
            href={`/${params.gradeSlug}/${params.lessonSlug}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-default transition-colors"
          >
            <GraduationCap className="w-4 h-4" />
            Ders Ünitelerine Dön
          </Link>
        </div>
      </main>
    </div>
  );
}
