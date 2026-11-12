export const QUESTION_COUNT = 5
export const DIFFICULTIES = ['Fácil', 'Média', 'Difícil'] as const
export const CATEGORIES = ['Matemática básica', 'Frações', 'Porcentagem', 'Geometria', 'Estatística', 'Probabilidade', 'Raciocínio lógico'] as const
export type Difficulty = typeof DIFFICULTIES[number]
export type Category = typeof CATEGORIES[number]
export type Question = { id: string; prompt: string; options: string[]; correct: number; explanation: string; difficulty: Difficulty; category: Category; active: boolean }
export type PublicQuestion = Omit<Question, 'correct' | 'explanation' | 'active'>
export type Answer = { choice: number; correct: number; explanation: string }
export type Decision = 0 | 1
export type Drop = { id: string; path: Decision[]; bin: number; points: number }
export type Stage = 'quiz' | 'machine' | 'complete'
export type Game = {
  id: string; nickname: string; stage: Stage; index: number; correct: number; tokens: number;
  points: number; question: PublicQuestion | null; answer: Answer | null; completedAt: number | null;
}
export type Ranking = { id: string; nickname: string; correct: number; points: number; completedAt: number }
export type Rules = { maxAttempts: number; blockedWords: string[] }
export type PublicStats = { participants: number; games: number }
export type Stats = PublicStats & { completed: number; correct: number; wrong: number; points: number; spent: number; bins: number[] }
export type Activity = { id: string; message: string; at: number }
export type AdminGame = Pick<Game, 'id' | 'nickname' | 'correct' | 'tokens' | 'points'> & { stage: Stage | 'expired' }
export type Participant = { id: string; nickname: string; attempts: number; lastPlayedAt: number }
export type AdminData = { stats: Stats; questions: Question[]; rules: Rules; games: AdminGame[]; participants: Participant[]; activity: Activity[] }
export const DEFAULT_RULES: Rules = { maxAttempts: 3, blockedWords: ['merda', 'porra', 'caralho', 'puta', 'idiota', 'imbecil', 'babaca'] }
export const EMPTY_STATS: Stats = { participants: 0, games: 0, completed: 0, correct: 0, wrong: 0, points: 0, spent: 0, bins: [0, 0, 0, 0, 0] }

export const BINS = [
  { points: 0, probability: 1 / 16 },
  { points: 10, probability: 4 / 16 },
  { points: 25, probability: 6 / 16 },
  { points: 50, probability: 4 / 16 },
  { points: 100, probability: 1 / 16 },
] as const

export function draw(randomBit: () => Decision): Omit<Drop, 'id'> {
  const path = Array.from({ length: 4 }, randomBit)
  const bin = path.reduce<number>((sum, bit) => sum + bit, 0)
  return { path, bin, points: BINS[bin].points }
}
export function compareRanking(a: Ranking, b: Ranking) {
  return b.points - a.points || b.correct - a.correct || a.completedAt - b.completedAt || (a.id < b.id ? -1 : Number(a.id !== b.id))
}
export function publicQuestion(question: Question): PublicQuestion {
  const { id, prompt, options, difficulty, category } = question
  return { id, prompt, options, difficulty, category }
}
export const number = (n: number) => n.toLocaleString('pt-BR')
export const percent = (ratio: number) => number(Number((ratio * 100).toFixed(2))) + '%'

