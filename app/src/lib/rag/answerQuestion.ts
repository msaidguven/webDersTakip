import type { SupabaseClient } from '@supabase/supabase-js';
import { embedQuestion, generateGroundedAnswer } from './gemini';

const MATCH_COUNT = 5;

type MatchedChunk = { id: number; document_id: number; content: string; similarity: number };

export type AnswerQuestionResult = {
  answer: string;
  model: string;
  matchedChunkIds: number[];
};

// Soru-cevap akışı: soruyu vektöre çevir, pgvector ile en alakalı parçaları bul,
// Gemini'ye "sadece bu metne dayan" talimatıyla gönder. Hiç eşleşen parça yoksa
// modele hiç sormadan doğrudan "bu bilgi ders notlarında yok" döndürülür.
export async function answerQuestionFromTopic(
  supabase: SupabaseClient,
  topicId: number,
  question: string
): Promise<AnswerQuestionResult> {
  const queryEmbedding = await embedQuestion(question);

  const { data, error } = await supabase.rpc('match_rag_chunks', {
    query_embedding: queryEmbedding,
    match_topic_id: topicId,
    match_count: MATCH_COUNT,
  });
  if (error) throw new Error(`Benzerlik araması başarısız: ${error.message}`);

  const matches = (data as MatchedChunk[] | null) || [];

  if (matches.length === 0) {
    return { answer: 'Bu bilgi ders notlarında yok.', model: 'none', matchedChunkIds: [] };
  }

  const { answer, model } = await generateGroundedAnswer(
    question,
    matches.map((m) => m.content)
  );

  return { answer, model, matchedChunkIds: matches.map((m) => m.id) };
}
