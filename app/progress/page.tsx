'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface Progress {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
}

export default function ProgressPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      
      // Kullanıcı oturumunu kontrol et
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setLoading(false);
        return;
      }

      // İstatistikleri çek
      const { data: statsData } = await supabase
        .from('user_question_stats')
        .select('correct_attempts, wrong_attempts')
        .eq('user_id', session.user.id);

      const stats = statsData || [];
      const totalCorrect = stats.reduce((sum: number, s: any) => sum + (s.correct_attempts || 0), 0);
      const totalWrong = stats.reduce((sum: number, s: any) => sum + (s.wrong_attempts || 0), 0);
      const total = totalCorrect + totalWrong;

      setProgress({
        totalQuestions: total,
        correctAnswers: totalCorrect,
        wrongAnswers: totalWrong,
        accuracy: total > 0 ? Math.round((totalCorrect / total) * 100) : 0
      });
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return <div className="p-8">Yükleniyor...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">İlerleme Takibi</h1>

      {!progress ? (
        <p>Giriş yapmanız gerekiyor.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow border">
            <p className="text-gray-600">Toplam Soru</p>
            <p className="text-4xl font-bold text-indigo-600">{progress.totalQuestions}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow border">
            <p className="text-gray-600">Doğru</p>
            <p className="text-4xl font-bold text-green-600">{progress.correctAnswers}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow border">
            <p className="text-gray-600">Yanlış</p>
            <p className="text-4xl font-bold text-red-600">{progress.wrongAnswers}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow border md:col-span-3">
            <p className="text-gray-600">Başarı Oranı</p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex-1 bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-indigo-600 h-4 rounded-full transition-all"
                  style={{ width: `${progress.accuracy}%` }}
                />
              </div>
              <p className="text-2xl font-bold">%{progress.accuracy}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
