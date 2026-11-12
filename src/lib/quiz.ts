// Habersiz quiz: hoca tarafı veri işlemleri ve sonuç hesabı.
import { supabase } from './supabase'
import { parcaliCek } from './veri'
import type { Quiz, QuizCevap, QuizDeneme, QuizSoruBagi } from './quizHesap'

export * from './quizHesap'

const QUIZ_ALANLARI = 'id, course_id, baslik, kod, sure_dk, sonuc_ogrenciye, durum, basladi, kapandi'

export async function quizleriGetir(dersId: string): Promise<Quiz[]> {
  const { data, error } = await supabase.from('quizzes').select(QUIZ_ALANLARI).eq('course_id', dersId).order('basladi', { ascending: false })
  if (error) throw error
  return data as Quiz[]
}

export function quizDenemeleri(quizIdleri: string[]): Promise<QuizDeneme[]> {
  return parcaliCek<QuizDeneme>(quizIdleri, (parca, bas) =>
    supabase.from('quiz_attempts').select('id, quiz_id, student_id, basladi, bitti').in('quiz_id', parca).order('quiz_id').order('student_id').range(bas, bas + 999),
  )
}

export function quizCevaplari(quizIdleri: string[]): Promise<QuizCevap[]> {
  return parcaliCek<QuizCevap>(quizIdleri, (parca, bas) =>
    supabase
      .from('quiz_answers')
      .select('quiz_id, student_id, question_id, dogru')
      .in('quiz_id', parca)
      .order('quiz_id')
      .order('attempt_id')
      .order('question_id')
      .range(bas, bas + 999),
  )
}

export function quizSoruBaglari(quizIdleri: string[]): Promise<QuizSoruBagi[]> {
  return parcaliCek<QuizSoruBagi>(quizIdleri, (parca, bas) =>
    supabase.from('quiz_questions').select('quiz_id, question_id').in('quiz_id', parca).order('quiz_id').order('question_id').range(bas, bas + 999),
  )
}

/** Quiz açar; dönen kod öğrencilere gösterilir. */
export async function quizOlustur(dersId: string, baslik: string, sureDk: number, soruIdleri: string[], sonucOgrenciye: boolean): Promise<{ id: string; kod: string }> {
  const { data, error } = await supabase.rpc('quiz_olustur', {
    p_course: dersId,
    p_baslik: baslik,
    p_sure_dk: sureDk,
    p_sorular: soruIdleri,
    p_sonuc_ogrenciye: sonucOgrenciye,
  })
  if (error) throw error
  return data as { id: string; kod: string }
}

export async function quizKapat(id: string): Promise<void> {
  const { error } = await supabase.rpc('quiz_kapat', { p_quiz: id })
  if (error) throw error
}

export async function quizSil(id: string): Promise<void> {
  const { error } = await supabase.from('quizzes').delete().eq('id', id)
  if (error) throw error
}

/** Öğrencinin denemesini siler: o öğrenci quizi (açıksa) yeniden çözebilir. */
export async function denemeSil(id: string): Promise<void> {
  const { error } = await supabase.from('quiz_attempts').delete().eq('id', id)
  if (error) throw error
}

