import type { SupabaseClient } from '@supabase/supabase-js';
import { embedQuestion, generateGroundedAnswer, generateBuddyAnswer } from './gemini';

const MATCH_COUNT = 5;

type MatchedChunk = { id: number; document_id: number; content: string; similarity: number };

export type AnswerQuestionResult = {
  answer: string;
  model: string;
  matchedChunkIds: number[];
};

// Soru-cevap akışı: soruyu vektöre çevir, pgvector ile SADECE aynı sınıf+ders
// (kitap) kapsamındaki parçalar içinde en alakalıları bul, Gemini'ye "sadece bu
// metne dayan" talimatıyla gönder. Hiç eşleşen parça yoksa modele hiç sormadan
// doğrudan "bu bilgi ders notlarında yok" döndürülür.
export async function answerQuestionForBook(
  supabase: SupabaseClient,
  gradeId: number,
  lessonId: number,
  question: string,
  questionContext?: string | null
): Promise<AnswerQuestionResult> {
  // "neden A" gibi bağlamsız kısa sorularda arama tek başına anlamsız kalır — varsa
  // aktif test sorusunu da arama sorgusuna katıyoruz ki doğru parçalar bulunsun.
  const searchQuery = questionContext ? `${questionContext}\n\nÖğrenci sorusu: ${question}` : question;
  const queryEmbedding = await embedQuestion(searchQuery);

  const { data, error } = await supabase.rpc('match_rag_chunks', {
    query_embedding: queryEmbedding,
    match_grade_id: gradeId,
    match_lesson_id: lessonId,
    match_count: MATCH_COUNT,
  });
  if (error) throw new Error(`Benzerlik araması başarısız: ${error.message}`);

  const matches = (data as MatchedChunk[] | null) || [];

  if (matches.length === 0) {
    return { answer: 'Bu bilgi ders notlarında yok.', model: 'none', matchedChunkIds: [] };
  }

  const { answer, model } = await generateGroundedAnswer(
    question,
    matches.map((m) => m.content),
    questionContext
  );

  return { answer, model, matchedChunkIds: matches.map((m) => m.id) };
}

// "@kanka" modu: ders notu araması hiç yapılmaz (kitaba bağlı kalmadığı için
// gerek yok), doğrudan Gemini'ye yaş/sınıf seviyesine uygun bir "arkadaş"
// personasıyla sorulur.
export async function answerAsBuddy(
  supabase: SupabaseClient,
  gradeId: number,
  lessonId: number,
  question: string
): Promise<AnswerQuestionResult> {
  const [{ data: grade }, { data: lesson }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gradeId).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', lessonId).maybeSingle(),
  ]);

  const { answer, model } = await generateBuddyAnswer(question, grade?.name ?? null, lesson?.name ?? null);
  return { answer, model, matchedChunkIds: [] };
}
