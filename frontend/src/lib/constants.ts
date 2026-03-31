// ─── TOKENS ───────────────────────────────────────────────────────────────────
export const TOKENS_PER_GAME = 2;
export const MAX_CUSTOM_SURVEYS = 40;

// ─── TOKEN BUNDLES ────────────────────────────────────────────────────────────
// Mock data — replace with GET /api/tokens/bundles in Phase 7.
// Frontend responsibilities:
//   - Filter to is_active = true
//   - Sort by base_price ASC
//   - Compute isBestValue: lowest current_price/tokens ratio
//   - isMostPopular: rendered as-is from DB value
export const TOKEN_BUNDLES = [
  { id: "try_it",     name: "Try It",         tokens: 4,  base_price: 0.99, current_price: 0.99, stripe_price_id: "price_REPLACE_try_it",     is_most_popular: false, is_active: true },
  { id: "game_night", name: "Game Night",     tokens: 10, base_price: 1.99, current_price: 1.99, stripe_price_id: "price_REPLACE_game_night",  is_most_popular: false, is_active: true },
  { id: "party_pack", name: "Party Pack",     tokens: 30, base_price: 4.99, current_price: 4.99, stripe_price_id: "price_REPLACE_party_pack",  is_most_popular: false, is_active: true },
  { id: "arcade_cab", name: "Arcade Cabinet", tokens: 62, base_price: 9.99, current_price: 9.99, stripe_price_id: "price_REPLACE_arcade_cab",  is_most_popular: true,  is_active: true },
];

// ─── SURVEY PACKS ─────────────────────────────────────────────────────────────
// Phase 6: replace static arrays with GET /api/survey-showdown/packs (see
// frontend/src/lib/api/survey-showdown/packs.ts for response types).
// In-app Pack: { id, name, description, rounds: Round[] }
// API list: free items include rounds plus is_free, is_active, created_at; premium items omit rounds until GET .../packs/:id/rounds.
// Round: { question: string, answers: { text: string, points: number }[] }
// All content is original and free of any IP, trademark, or copyright concerns.

export type Answer = { text: string; points: number };
export type Round = { question: string; answers: Answer[] };
export type Pack = { id: string; name: string; description: string; rounds: Round[] };
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

const DEFAULT_ROUNDS: Round[] = [
  { question: "Name something people do to relax after work.", answers: [{ text: "Watch TV", points: 38 }, { text: "Take a bath or shower", points: 22 }, { text: "Read a book", points: 14 }, { text: "Exercise", points: 10 }, { text: "Drink alcohol", points: 8 }, { text: "Listen to music", points: 5 }, { text: "Cook", points: 3 }] },
  { question: "Name something you always find in a doctor's waiting room.", answers: [{ text: "Magazines", points: 42 }, { text: "Chairs or seats", points: 25 }, { text: "Other sick people", points: 12 }, { text: "Receptionist", points: 9 }, { text: "Fish tank", points: 7 }, { text: "TV", points: 5 }] },
  { question: "Name a reason someone might be late to work.", answers: [{ text: "Traffic", points: 40 }, { text: "Oversleeping", points: 28 }, { text: "Car trouble", points: 12 }, { text: "Weather", points: 8 }, { text: "Kids", points: 7 }, { text: "Public transit delay", points: 5 }] },
  { question: "Name something people buy at a gas station besides gas.", answers: [{ text: "Snacks or chips", points: 35 }, { text: "Coffee or drinks", points: 27 }, { text: "Cigarettes", points: 18 }, { text: "Lottery tickets", points: 10 }, { text: "Gum or candy", points: 7 }, { text: "Car supplies", points: 3 }] },
  { question: "Name something a person does first thing in the morning.", answers: [{ text: "Use the bathroom", points: 34 }, { text: "Brush teeth", points: 24 }, { text: "Check phone", points: 18 }, { text: "Make coffee", points: 12 }, { text: "Shower", points: 8 }, { text: "Eat breakfast", points: 4 }] },
];

export const FREE_PACKS: Pack[] = [
  { id: "free_classic", name: "Classic", description: "Everyday favorites", rounds: DEFAULT_ROUNDS.slice(0, 3) },
];

export const PREMIUM_PACKS: Pack[] = [
  {
    id: "prem_home", name: "Home Life", description: "All things domestic", rounds: [
      { question: "Name something people do right after waking up.", answers: [{ text: "Check phone", points: 36 }, { text: "Use the bathroom", points: 26 }, { text: "Brush teeth", points: 16 }, { text: "Make coffee", points: 12 }, { text: "Stretch or exercise", points: 7 }, { text: "Look out the window", points: 3 }] },
      { question: "Name something you might lose at home.", answers: [{ text: "TV remote", points: 38 }, { text: "Keys", points: 27 }, { text: "Phone", points: 18 }, { text: "Glasses", points: 9 }, { text: "Wallet", points: 5 }, { text: "Charger", points: 3 }] },
      { question: "Name something people argue about at home.", answers: [{ text: "Money", points: 32 }, { text: "Chores", points: 28 }, { text: "TV or remote", points: 18 }, { text: "Leaving lights on", points: 10 }, { text: "Food choices", points: 7 }, { text: "Noise level", points: 5 }] },
      { question: "Name something you do before having guests over.", answers: [{ text: "Clean the house", points: 44 }, { text: "Cook or prepare food", points: 24 }, { text: "Buy groceries", points: 14 }, { text: "Set the table", points: 9 }, { text: "Light candles", points: 5 }, { text: "Hide clutter", points: 4 }] },
      { question: "Name something people keep on their nightstand.", answers: [{ text: "Phone or charger", points: 36 }, { text: "Lamp", points: 28 }, { text: "Water glass", points: 16 }, { text: "Alarm clock", points: 11 }, { text: "Book", points: 6 }, { text: "Glasses", points: 3 }] },
    ]
  },
  {
    id: "prem_out", name: "Out & About", description: "Life beyond your front door", rounds: [
      { question: "Name something you see at a farmers market.", answers: [{ text: "Fresh vegetables", points: 36 }, { text: "Fruit", points: 28 }, { text: "Flowers", points: 16 }, { text: "Baked goods", points: 11 }, { text: "Honey", points: 5 }, { text: "Cheese", points: 4 }] },
      { question: "Name something people do at the beach.", answers: [{ text: "Swim", points: 38 }, { text: "Sunbathe", points: 26 }, { text: "Build sandcastles", points: 16 }, { text: "Play volleyball", points: 10 }, { text: "Eat snacks", points: 7 }, { text: "Walk or jog", points: 3 }] },
      { question: "Name a reason someone might be pulled over.", answers: [{ text: "Speeding", points: 48 }, { text: "Running a red light", points: 24 }, { text: "Broken tail light", points: 12 }, { text: "Expired registration", points: 8 }, { text: "Reckless driving", points: 5 }, { text: "No seatbelt", points: 3 }] },
      { question: "Name something people buy at a hardware store.", answers: [{ text: "Screws or nails", points: 30 }, { text: "Paint", points: 26 }, { text: "Tools", points: 22 }, { text: "Lumber or wood", points: 12 }, { text: "Light bulbs", points: 6 }, { text: "Tape", points: 4 }] },
      { question: "Name something you'd find at a park.", answers: [{ text: "Benches", points: 34 }, { text: "Trees", points: 28 }, { text: "Playground", points: 20 }, { text: "Walking paths", points: 10 }, { text: "Picnic tables", points: 5 }, { text: "Fountain", points: 3 }] },
    ]
  },
  {
    id: "prem_food", name: "Food & Drink", description: "For the foodies", rounds: [
      { question: "Name something people put on a burger.", answers: [{ text: "Ketchup", points: 34 }, { text: "Cheese", points: 28 }, { text: "Lettuce", points: 16 }, { text: "Pickles", points: 10 }, { text: "Mustard", points: 8 }, { text: "Onions", points: 4 }] },
      { question: "Name something people add to their coffee.", answers: [{ text: "Sugar", points: 36 }, { text: "Cream or milk", points: 32 }, { text: "Flavored syrup", points: 16 }, { text: "Cinnamon", points: 8 }, { text: "Honey", points: 5 }, { text: "Cocoa powder", points: 3 }] },
      { question: "Name something you'd find at a backyard barbecue.", answers: [{ text: "Burgers or hot dogs", points: 38 }, { text: "Coleslaw or salad", points: 22 }, { text: "Corn on the cob", points: 18 }, { text: "Potato chips", points: 11 }, { text: "Watermelon", points: 7 }, { text: "Cold drinks", points: 4 }] },
      { question: "Name a popular pizza topping.", answers: [{ text: "Pepperoni", points: 40 }, { text: "Mushrooms", points: 22 }, { text: "Extra cheese", points: 18 }, { text: "Onions", points: 9 }, { text: "Bell peppers", points: 7 }, { text: "Olives", points: 4 }] },
      { question: "Name something people eat when they're sick.", answers: [{ text: "Chicken soup", points: 44 }, { text: "Toast", points: 26 }, { text: "Tea and honey", points: 14 }, { text: "Orange juice", points: 8 }, { text: "Crackers", points: 5 }, { text: "Applesauce", points: 3 }] },
      { question: "Name a food that most kids refuse to eat.", answers: [{ text: "Vegetables or broccoli", points: 40 }, { text: "Fish", points: 22 }, { text: "Mushrooms", points: 16 }, { text: "Liver", points: 11 }, { text: "Onions", points: 7 }, { text: "Spicy food", points: 4 }] },
    ]
  },
  {
    id: "prem_work", name: "Work Life", description: "The daily grind", rounds: [
      { question: "Name something you find on an office desk.", answers: [{ text: "Computer or laptop", points: 36 }, { text: "Coffee mug", points: 28 }, { text: "Phone", points: 16 }, { text: "Stapler", points: 10 }, { text: "Pens or pencils", points: 7 }, { text: "Sticky notes", points: 3 }] },
      { question: "Name a reason someone might call in sick to work.", answers: [{ text: "Cold or flu", points: 40 }, { text: "Stomach ache", points: 24 }, { text: "Headache", points: 16 }, { text: "Family emergency", points: 10 }, { text: "Back pain", points: 6 }, { text: "Mental health day", points: 4 }] },
      { question: "Name something people do during a boring meeting.", answers: [{ text: "Check their phone", points: 42 }, { text: "Doodle", points: 24 }, { text: "Daydream", points: 16 }, { text: "Pass notes", points: 9 }, { text: "Check the time", points: 6 }, { text: "Eat snacks", points: 3 }] },
      { question: "Name something you'd find in an office break room.", answers: [{ text: "Coffee maker", points: 42 }, { text: "Microwave", points: 28 }, { text: "Refrigerator", points: 16 }, { text: "Vending machine", points: 8 }, { text: "Table and chairs", points: 4 }, { text: "Toaster", points: 2 }] },
      { question: "Name something people put on a resume.", answers: [{ text: "Work experience", points: 40 }, { text: "Education", points: 28 }, { text: "Skills", points: 16 }, { text: "Contact information", points: 10 }, { text: "References", points: 4 }, { text: "Hobbies", points: 2 }] },
      { question: "Name something a boss might say on a Monday morning.", answers: [{ text: "Good morning", points: 30 }, { text: "Big week ahead", points: 26 }, { text: "Check your emails", points: 20 }, { text: "Deadlines coming up", points: 12 }, { text: "Let's have a meeting", points: 8 }, { text: "How was your weekend", points: 4 }] },
    ]
  },
  {
    id: "prem_games", name: "Game Night", description: "For the players", rounds: [
      { question: "Name something you find at a board game night.", answers: [{ text: "Cards or board games", points: 36 }, { text: "Snacks", points: 28 }, { text: "Drinks", points: 18 }, { text: "Dice", points: 10 }, { text: "Score pad", points: 5 }, { text: "Game instructions", points: 3 }] },
      { question: "Name something a bad loser might do.", answers: [{ text: "Argue or complain", points: 38 }, { text: "Flip the board", points: 26 }, { text: "Storm off", points: 18 }, { text: "Make excuses", points: 10 }, { text: "Sulk", points: 5 }, { text: "Refuse to play again", points: 3 }] },
      { question: "Name a type of game people play outdoors.", answers: [{ text: "Frisbee", points: 30 }, { text: "Tag", points: 26 }, { text: "Volleyball", points: 20 }, { text: "Horseshoes", points: 13 }, { text: "Badminton", points: 7 }, { text: "Cornhole", points: 4 }] },
      { question: "Name something people say when they win a game.", answers: [{ text: "Yes! or Yesss!", points: 36 }, { text: "I win!", points: 28 }, { text: "Did you see that?", points: 16 }, { text: "I'm the best!", points: 12 }, { text: "Rematch?", points: 5 }, { text: "Too easy", points: 3 }] },
      { question: "Name something people eat while playing games.", answers: [{ text: "Chips", points: 40 }, { text: "Pizza", points: 26 }, { text: "Popcorn", points: 18 }, { text: "Candy", points: 9 }, { text: "Pretzels", points: 5 }, { text: "Nuts", points: 2 }] },
      { question: "Name something that makes a trivia night more fun.", answers: [{ text: "Good teammates", points: 34 }, { text: "Prizes", points: 26 }, { text: "Food and drinks", points: 20 }, { text: "Challenging questions", points: 12 }, { text: "Music", points: 5 }, { text: "Good host", points: 3 }] },
    ]
  },
];

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

export function customSurveyToRounds(survey: CustomSurvey): Round[] {
  return survey.questions.map(q => ({ question: q.question, answers: q.answers }));
}

export function resolvePackRounds(
  packId: string,
  customSurveys: CustomSurvey[],
  customCollections: CustomCollection[]
): Round[] {
  const allCustom = customSurveys.flatMap(customSurveyToRounds);
  if (packId === "random") {
    const base = [...FREE_PACKS.flatMap(p => p.rounds), ...PREMIUM_PACKS.flatMap(p => p.rounds)];
    return allCustom.length ? [...allCustom, ...base] : base;
  }
  if (packId === "custom_all") return allCustom.length ? allCustom : FREE_PACKS[0].rounds;
  const fp = FREE_PACKS.find(p => p.id === packId); if (fp) return fp.rounds;
  const pp = PREMIUM_PACKS.find(p => p.id === packId); if (pp) return pp.rounds;
  const coll = customCollections.find(c => c.id === packId);
  if (coll) {
    const r = customSurveys.filter(s => s.collectionId === coll.id).flatMap(customSurveyToRounds);
    return r.length ? r : FREE_PACKS[0].rounds;
  }
  return FREE_PACKS[0].rounds;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

export function checkAnswerFast(input: string, answers: Answer[], revealedIndices: number[]): number | null {
  const norm = normalize(input);
  if (!norm) return null;
  for (let i = 0; i < answers.length; i++) {
    if (revealedIndices.includes(i)) continue;
    const target = normalize(answers[i].text);
    if (norm === target) return i;
    if (target.includes(norm) || norm.includes(target)) return i;
    const iw = norm.split(" ").filter(w => w.length > 2);
    const tw = target.split(" ").filter(w => w.length > 2);
    const overlap = iw.filter(w => tw.some(t => t.includes(w) || w.includes(t)));
    if (overlap.length > 0 && overlap.length >= Math.min(iw.length, tw.length) * 0.6) return i;
    if (target.length <= 20 && levenshtein(norm, target) <= 3) return i;
  }
  return null;
}

export function parseCustomData(text: string): Round[] | null {
  try {
    const d = JSON.parse(text);
    if (Array.isArray(d)) return d;
    if (d.rounds) return d.rounds;
    return null;
  } catch { return null; }
}

// Phase 8: replace this function body with fetch('POST /api/survey-showdown/judge', ...)
// The backend handles caching and rate limiting. Remove apiKey param entirely at that point.
export async function judgeAnswer(
  input: string,
  answers: Answer[],
  revealedIndices: number[],
  apiKey: string
): Promise<number | null> {
  if (!input.trim()) return null;
  const fast = checkAnswerFast(input, answers, revealedIndices);
  if (fast !== null) return fast;
  if (!apiKey) return null;
  const candidates = answers.map((a, i) => ({ i, text: a.text })).filter(({ i }) => !revealedIndices.includes(i));
  if (candidates.length === 0) return null;
  const candidateList = candidates.map(({ i, text }) => `${i}: "${text}"`).join("\n");
  const prompt = `You are judging a Survey Showdown game. The player answered: "${input}"\n\nThe survey answers on the board are:\n${candidateList}\n\nDoes the player's answer match any of the survey answers in meaning? Consider synonyms, common phrases, and reasonable equivalents.\n\nReply with ONLY the number of the matching answer index, or "none" if there is no match. No explanation.`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 10, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const reply = (data.content?.[0]?.text || "").trim().toLowerCase();
    if (reply === "none" || reply === "") return null;
    const idx = parseInt(reply, 10);
    if (!isNaN(idx) && candidates.some(c => c.i === idx)) return idx;
  } catch (e) { console.warn("AI judge failed:", e); }
  return null;
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
