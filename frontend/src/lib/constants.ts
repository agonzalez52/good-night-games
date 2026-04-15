import { customSurveyAnswerId, postJudge } from "@/lib/api/survey-showdown/judge";

// ─── TOKENS ───────────────────────────────────────────────────────────────────
export const TOKENS_PER_GAME = 2;
export const MAX_CUSTOM_SURVEYS = 40;
/** Must match backend `judgeSchema` (`input` max length). */
export const SURVEY_SHOWDOWN_ANSWER_INPUT_MAX_LENGTH = 200;
/** Must match backend `feedbackSchema` (`message` max length). */
export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

// ─── SURVEY PACKS ─────────────────────────────────────────────────────────────
// Catalog + questions come from GET /api/survey-showdown/packs and mergeSurveyPacksForGame
// (see frontend/src/lib/api/survey-showdown/survey-packs.ts). Premium questions load via GET .../packs/:id/questions.
// Answer.id is su_survey_answers.id or custom QA hash; SurveyQuestion.id is su_survey_questions.id or client-generated for custom/import.

export type Answer = { id: string; answer: string; points: number };
export interface SurveyQuestion {
  id: string
  question: string
  answers: Answer[]
}

export type Pack = { id: string; name: string; description: string; questions: SurveyQuestion[] };
/** Mirrors `su_survey_packs` rows for bundled content; `is_free` matches the DB column. */
export interface SurveyPack extends Pack {
  is_free: boolean;
}
export type CustomSurvey = { id: string; name: string; collectionId: string | null; questions: { id: string; question: string; answers: Answer[] }[] };
export type CustomCollection = { id: string; name: string };
export type CurrentUser = {
  id: string;
  email: string;
  username: string;
  tokenBalance: number;
  emailVerified: boolean;
  referralsClaimed: number;
};
export type GameHistoryRecord = {
  id: string | number;
  timestamp: Date;
  team1: string;
  team2: string;
  rounds: number;
  pack: string;
  winner: string;
  score1: number;
  score2: number;
};

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

function newSurveyQuestionClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `q-${Math.random().toString(36).slice(2, 12)}`
}

export function customSurveyToQuestions(survey: CustomSurvey): SurveyQuestion[] {
  return survey.questions.map((q) => ({
    id: q.id?.trim() || newSurveyQuestionClientId(),
    question: q.question,
    answers: q.answers.map((a) => ({
      id: a.id?.trim() || customSurveyAnswerId(q.question, a.answer),
      answer: a.answer,
      points: a.points,
    })),
  }))
}

export function resolvePackQuestions(
  packId: string,
  customSurveys: CustomSurvey[],
  customCollections: CustomCollection[],
  surveyPacks: SurveyPack[]
): SurveyQuestion[] {
  const FREE_PACKS = surveyPacks.filter(p => p.is_free);
  const PREMIUM_PACKS = surveyPacks.filter(p => !p.is_free);
  const fallbackQuestions = FREE_PACKS[0]?.questions ?? [];
  const allCustom = customSurveys.flatMap(customSurveyToQuestions);
  if (packId === "random") {
    const base = [...FREE_PACKS.flatMap(p => p.questions), ...PREMIUM_PACKS.flatMap(p => p.questions)];
    return allCustom.length ? [...allCustom, ...base] : base;
  }
  if (packId === "custom_all") return allCustom.length ? allCustom : fallbackQuestions;
  const fp = FREE_PACKS.find(p => p.id === packId); if (fp) return fp.questions;
  const pp = PREMIUM_PACKS.find(p => p.id === packId); if (pp) return pp.questions;
  const coll = customCollections.find(c => c.id === packId);
  if (coll) {
    const r = customSurveys.filter(s => s.collectionId === coll.id).flatMap(customSurveyToQuestions);
    return r.length ? r : fallbackQuestions;
  }
  return fallbackQuestions;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalize(str: string | null | undefined): string {
  if (str == null) return "";
  return String(str).toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Normalized string equality only — used for signed-in (before AI) and signed-out matching. */
export function checkAnswerExact(input: string, answers: Answer[], revealedIndices: number[]): number | null {
  const norm = normalize(input);
  if (!norm) return null;
  for (let i = 0; i < answers.length; i++) {
    if (revealedIndices.includes(i)) continue;
    const answerText = answers[i]?.answer;
    if (answerText == null || answerText === '') continue;
    const target = normalize(answerText);
    if (norm === target) return i;
  }
  return null;
}

function coerceParsedQuestion(r: { id?: unknown; question?: unknown; answers?: unknown }): SurveyQuestion {
  const questionText = String(r.question ?? '')
  const answersIn = Array.isArray(r.answers) ? r.answers : []
  const idRaw = r.id
  const id = typeof idRaw === 'string' && idRaw.trim() ? idRaw.trim() : newSurveyQuestionClientId()
  return {
    id,
    question: questionText,
    answers: answersIn.map((a: { id?: unknown; answer?: unknown; points?: unknown }) => {
      const answer = String((a as { answer?: unknown }).answer ?? '')
      const answerIdRaw = (a as { id?: unknown }).id
      const answerId = typeof answerIdRaw === 'string' && answerIdRaw.trim() ? answerIdRaw.trim() : customSurveyAnswerId(questionText, answer)
      return {
        id: answerId,
        answer,
        points: typeof a.points === 'number' ? a.points : Number(a.points) || 0,
      }
    }),
  }
}

export function parseCustomData(text: string): SurveyQuestion[] | null {
  try {
    const d = JSON.parse(text);
    const raw = Array.isArray(d) ? d : d.questions && Array.isArray(d.questions) ? d.questions : null;
    if (!raw) return null;
    return raw.map((r: { id?: unknown; question?: unknown; answers?: unknown }) => coerceParsedQuestion(r));
  } catch { return null; }
}

/**
 * Signed in: exact normalized match, else POST /api/survey-showdown/judge.
 * Signed out: exact normalized match only (no AI).
 */
export async function judgeAnswer(
  input: string,
  answers: Answer[],
  revealedIndices: number[],
  getAccessToken: () => Promise<string | null>
): Promise<number | null> {
  if (!input?.trim()) return null;
  const exact = checkAnswerExact(input, answers, revealedIndices);
  if (exact !== null) return exact;
  const token = await getAccessToken();
  if (!token) return null;
  const answerIds = answers.map(a => a.id?.trim()).filter(Boolean) as string[];
  if (answerIds.length !== answers.length) return null;
  return postJudge(token, input.trim(), answerIds, answers, revealedIndices);
}

// ─── SOUNDS ───────────────────────────────────────────────────────────────────
function audioCtx() { return new (window.AudioContext || (window as any).webkitAudioContext)(); }

export function playBuzz() {
  try { const c = audioCtx(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = 120; g.gain.setValueAtTime(0.5, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6); o.start(); o.stop(c.currentTime + 0.6); } catch (_) { }
}
export function playReveal() {
  try { const c = audioCtx(); [523, 659, 784, 1047].forEach((freq, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = freq; o.type = "triangle"; g.gain.setValueAtTime(0.3, c.currentTime + i * 0.08); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.08 + 0.25); o.start(c.currentTime + i * 0.08); o.stop(c.currentTime + i * 0.08 + 0.3); }); } catch (_) { }
}
export function playBuzzerIn() {
  try { const c = audioCtx(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "square"; o.frequency.value = 440; g.gain.setValueAtTime(0.4, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2); o.start(); o.stop(c.currentTime + 0.2); } catch (_) { }
}
export function playTick() {
  try { const c = audioCtx(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = 1200; g.gain.setValueAtTime(0.15, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06); o.start(); o.stop(c.currentTime + 0.08); } catch (_) { }
}
export function playTimerExpire() {
  try { const c = audioCtx(); [300, 240, 180].forEach((freq, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = freq; g.gain.setValueAtTime(0.35, c.currentTime + i * 0.18); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.18 + 0.35); o.start(c.currentTime + i * 0.18); o.stop(c.currentTime + i * 0.18 + 0.4); }); } catch (_) { }
}
export function playCoinCollect(count = 8) {
  try {
    const c = audioCtx();
    Array.from({ length: count }, (_, i) => {
      const freq = 880 + i * 60;
      const t = c.currentTime + (i * 0.07);
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    });
    setTimeout(() => c.close(), 3000);
  } catch (_) { }
}
