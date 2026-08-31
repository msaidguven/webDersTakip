import type { SupabaseClient } from '@supabase/supabase-js';
import { embedQuestion, generateGroundedAnswer, generateBuddyAnswer } from './gemini';

const MATCH_COUNT = 5;

type MatchedChunk = { id: number; document_id: number; content: string; similarity: number };

export type AnswerQuestionResult = {
  answer: string;
  model: string;
  matchedChunkIds: number[];
};

// @hocam ve @kanka aynı kitap (sınıf+ders) kapsamındaki parçaları arar — ikisi de
// bu fonksiyonu paylaşıyor, sadece bulunanı nasıl kullandıkları (talimat) farklı.
async function searchChunks(supabase: SupabaseClient, gradeId: number, lessonId: number, embedding: number[]): Promise<MatchedChunk[]> {
  const { data, error } = await supabase.rpc('match_rag_chunks', {
    query_embedding: embedding,
    match_grade_id: gradeId,
    match_lesson_id: lessonId,
    match_count: MATCH_COUNT,
  });
  if (error) throw new Error(`Benzerlik araması başarısız: ${error.message}`);
  return (data as MatchedChunk[] | null) || [];
}

// Soru-cevap akışı: soruyu vektöre çevir, pgvector ile SADECE aynı sınıf+ders
// (kitap) kapsamındaki parçalar içinde en alakalıları bul, Gemini'ye "sadece bu
// metne dayan" talimatıyla gönder. Hiç eşleşen parça yoksa modele hiç sormadan
// doğrudan "bu bilgi ders notlarında yok" döndürülür.
// replyContext: bir yoruma/önceki AI cevabına yanıt olarak soruluyorsa o mesajın
// içeriği — hem aramanın hem üretimin bunu bilmesi gerekiyor (bkz. UnitDiscussion).
export async function answerQuestionForBook(
  supabase: SupabaseClient,
  gradeId: number,
  lessonId: number,
  question: string,
  questionContext?: string | null,
  replyContext?: string | null
): Promise<AnswerQuestionResult> {
  // "neden A" / "neden olmaz" gibi bağlamsız kısa sorularda arama tek başına
  // anlamsız kalır — varsa test sorusu ve/veya yanıt verilen mesajı da arama
  // sorgusuna katıyoruz ki doğru parçalar bulunsun.
  const searchQuery = [questionContext, replyContext, question].filter(Boolean).join('\n\n');
  const queryEmbedding = await embedQuestion(searchQuery);
  const matches = await searchChunks(supabase, gradeId, lessonId, queryEmbedding);

  if (matches.length === 0) {
    return { answer: 'Bu bilgi ders notlarında yok.', model: 'none', matchedChunkIds: [] };
  }

  const { answer, model } = await generateGroundedAnswer(
    question,
    matches.map((m) => m.content),
    questionContext,
    replyContext
  );

  return { answer, model, matchedChunkIds: matches.map((m) => m.id) };
}

// "@kanka" modu: aynı ders notu araması yapılır (varsa hangi parçaların alakalı
// olduğunu bilmek için) ama Gemini "sadece bu metne dayan" kısıtı OLMADAN çağrılır
// — ünitenin KONUSUYLA ilgiliyse kitapta yazmasa bile genel bilgisini kullanabilir,
// ama dersle hiç alakasız kişisel/sosyal sorulara girmez (bkz. generateBuddyAnswer).
export async function answerAsBuddy(
  supabase: SupabaseClient,
  gradeId: number,
  lessonId: number,
  unitId: number | null,
  question: string,
  replyContext?: string | null
): Promise<AnswerQuestionResult> {
  const searchQuery = [replyContext, question].filter(Boolean).join('\n\n');
  const [{ data: grade }, { data: lesson }, unitResult, queryEmbedding] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gradeId).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', lessonId).maybeSingle(),
    unitId != null ? supabase.from('units').select('title').eq('id', unitId).maybeSingle() : Promise.resolve({ data: null }),
    embedQuestion(searchQuery),
  ]);
  const unitTitle = (unitResult as { data: { title: string } | null }).data?.title ?? null;

  const matches = await searchChunks(supabase, gradeId, lessonId, queryEmbedding);

  const { answer, model } = await generateBuddyAnswer(
    question,
    grade?.name ?? null,
    lesson?.name ?? null,
    unitTitle,
    matches.map((m) => m.content),
    replyContext
  );
  return { answer, model, matchedChunkIds: matches.map((m) => m.id) };
}
