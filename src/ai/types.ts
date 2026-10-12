export type Verdict = 'good' | 'neutral' | 'bad'

export interface Ingredient {
  name: string
  quantity: string
}

export interface Recipe {
  id: string
  title: string
  pitch: string
  timeMin: number
  servings: number
  ingredients: Ingredient[]
  missing: string[]
  tags: string[]
  /** Same scale as set_mood: how the assistant would feel if the user picked this one (0.2 to 1). */
  positivity: number
}

export interface NutritionPerServing {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  saturatedFat_g: number
  sugar_g: number
  addedSugar_g: number
  fiber_g: number
  sodium_mg: number
}

export interface Judgement {
  nutritionPerServing: NutritionPerServing
  concerns: { name: string; verdict: Verdict; note: string }[]
  allergens: { name: string; present: boolean; note: string }[]
  watchlist: { name: string; present: boolean; note: string }[]
  ingredients: { name: string; quantity: string; verdict: Verdict; significance: number; note: string }[]
  healthScore: number
  summary: string
  tags: string[]
}

export interface CookStep {
  key: string
  title: string
  instruction: string
  durationMin: number | null
  tip: string | null
}

export interface Swap {
  id: string
  title: string
  /** What to buy or change, with quantities. */
  change: string
  /** Step this applies to, or null when it is only a shopping change. */
  stepKey: string | null
  /** One-line payoff, e.g. "about 180 fewer kcal per serving". */
  payoff: string
  /** Same scale as set_mood: the mood to move to if the user accepts this hack. */
  positivity: number
}

export interface CookPlan {
  recipeId: string
  title: string
  servings: number
  ingredients: Ingredient[]
  steps: CookStep[]
  swaps: Swap[]
}

export interface Wrapup {
  verdict: 'congrats' | 'do_better'
  headline: string
  highlights: string[]
  stats: { label: string; value: string }[]
  streak: string
  tip: string
}

export interface Profile {
  pantryText: string
  watchlistText: string
  allergensText: string
  concernsText: string
  aboutMe: string
}

export interface CallConfig {
  model: 'opus' | 'sonnet'
  effort: 'low' | 'medium' | 'high'
  max_tokens: number
}

export type CallName = 'chat' | 'judge' | 'pantry_vision' | 'pantry_merge' | 'wrapup'

export interface ChatTurnHandlers {
  onText: (delta: string) => void
  /** Called for each tool call; returns the tool_result text. */
  onTool: (name: string, input: unknown) => Promise<string>
}

export interface ImageInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  base64: string
}
