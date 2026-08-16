// app/ders/alt-baslik-test/page.tsx
// Eski ?sectionId= tabanlı URL için geriye dönük uyumluluk: section'ın ait olduğu
// sınıf/ders/ünite/konu slug'larını bulup yeni SEO uyumlu
// /[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/kavrama-testi/[sectionSlug]
// adresine kalıcı olarak yönlendirir.

import { permanentRedirect, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { slugifyHeading } from '@/app/src/lib/site';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

type SectionRow = { id: number; heading: string; topic_content_id: number };
type TopicContentRow = { id: number; topic_id: number };
type TopicRow = { id: number; slug: string | null; unit_id: number };
type UnitRow = { id: number; slug: string | null; lesson_id: number; grade_id: number };
type LessonRow = { id: number; slug: string | null };
type GradeRow = { id: number; slug: string | null };

export default async function LegacyAltBaslikTestRedirectPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawSectionId = Array.isArray(sp.sectionId) ? sp.sectionId[0] : sp.sectionId;
  const sectionId = Number(rawSectionId);

  if (!Number.isFinite(sectionId)) {
    redirect('/');
  }

  const supabase = await createClient();

  const { data: sectionData } = await supabase
    .from('topic_content_sections')
    .select('id, heading, topic_content_id')
    .eq('id', sectionId)
    .maybeSingle();
  const section = sectionData as SectionRow | null;
  if (!section) redirect('/');

  const { data: topicContentData } = await supabase
    .from('topic_contents')
    .select('id, topic_id')
    .eq('id', section.topic_content_id)
    .maybeSingle();
  const topicContent = topicContentData as TopicContentRow | null;
  if (!topicContent) redirect('/');

  const { data: topicData } = await supabase
    .from('topics')
    .select('id, slug, unit_id')
    .eq('id', topicContent.topic_id)
    .maybeSingle();
  const topic = topicData as TopicRow | null;
  if (!topic?.slug) redirect('/');

  const { data: unitData } = await supabase
    .from('units')
    .select('id, slug, lesson_id, grade_id')
    .eq('id', topic.unit_id)
    .maybeSingle();
  const unit = unitData as UnitRow | null;
  if (!unit?.slug) redirect('/');

  const [{ data: lessonData }, { data: gradeData }] = await Promise.all([
    supabase.from('lessons').select('id, slug').eq('id', unit.lesson_id).maybeSingle(),
    supabase.from('grades').select('id, slug').eq('id', unit.grade_id).maybeSingle(),
  ]);
  const lesson = lessonData as LessonRow | null;
  const grade = gradeData as GradeRow | null;
  if (!lesson?.slug || !grade?.slug) redirect('/');

  const canonicalSlug = `${section.id}-${slugifyHeading(section.heading) || 'test'}`;
  permanentRedirect(`/${grade.slug}/${lesson.slug}/${unit.slug}/${topic.slug}/kavrama-testi/${canonicalSlug}`);
}
