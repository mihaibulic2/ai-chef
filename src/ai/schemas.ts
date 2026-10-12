import type Anthropic from '@anthropic-ai/sdk'

const str = { type: 'string' } as const
const num = { type: 'number' } as const
const bool = { type: 'boolean' } as const
const nullable = (t: object) => ({ anyOf: [t, { type: 'null' }] })
const obj = (properties: Record<string, object>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})
const arr = (items: object) => ({ type: 'array', items })
const verdict = { type: 'string', enum: ['good', 'neutral', 'bad'] }

export const ingredientSchema = obj({ name: str, quantity: str })

export const recipeSchema = obj({
  id: { ...str, description: 'Short id, unique across the whole conversation (never reuse an id from an earlier show_recipes call), e.g. "r1", "r2", ... "r7"' },
  title: str,
  pitch: { ...str, description: 'One appetizing sentence, at most 14 words' },
  timeMin: num,
  servings: num,
  ingredients: arr(ingredientSchema),
  missing: { ...arr(str), description: 'Minor items the user does not have' },
  tags: { ...arr(str), description: 'Up to 3 short tags, e.g. "quick", "one-pan", "uses what you have"' },
})

export const cookStepSchema = obj({
  key: { ...str, description: 'Stable identifier for this step, e.g. "boil-water". Keep the same key when re-sending an updated plan.' },
  title: { ...str, description: 'At most 5 words' },
  instruction: { ...str, description: 'One or two sentences with exact quantities' },
  durationMin: { ...nullable(num), description: 'Minutes to wait for this step, if it is a timed step' },
  tip: nullable(str),
})

export const cookPlanSchema = obj({
  recipeId: { ...str, description: 'The id of the recipe from show_recipes when it came from there. Keep the same value when re-sending an updated plan.' },
  title: str,
  servings: num,
  ingredients: arr(ingredientSchema),
  steps: arr(cookStepSchema),
})

export const chatTools: Anthropic.Tool[] = [
  {
    name: 'show_recipes',
    description: 'Show the user a carousel of 3 to 5 recipe ideas. Use this instead of listing recipes in text.',
    strict: true,
    input_schema: obj({ recipes: arr(recipeSchema) }) as Anthropic.Tool['input_schema'],
  },
  {
    name: 'set_mood',
    description: "Set the assistant's mood tint: 0.3 is neutral, up to 1 is very positive; never below 0.2. Call whenever the conversation's direction changes.",
    strict: true,
    input_schema: obj({ positivity: num }) as Anthropic.Tool['input_schema'],
  },
  {
    name: 'show_cooking',
    description: 'Open (or update in place) the full-screen step-by-step cooking view for one recipe.',
    strict: true,
    input_schema: cookPlanSchema as Anthropic.Tool['input_schema'],
  },
]

export const judgementSchema = obj({
  nutritionPerServing: obj({
    calories: num,
    protein_g: num,
    carbs_g: num,
    fat_g: num,
    saturatedFat_g: num,
    sugar_g: num,
    addedSugar_g: num,
    fiber_g: num,
    sodium_mg: num,
  }),
  concerns: arr(obj({ name: str, verdict, note: str })),
  allergens: arr(obj({ name: str, present: bool, note: str })),
  watchlist: arr(obj({ name: str, present: bool, note: str })),
  ingredients: arr(obj({ name: str, quantity: str, verdict, significance: num, note: str })),
  healthScore: num,
  summary: str,
  tags: arr(str),
})

export const pantryVisionSchema = obj({ products: arr(str) })

export const wrapupSchema = obj({
  verdict: { type: 'string', enum: ['congrats', 'do_better'] },
  headline: str,
  highlights: arr(str),
  stats: arr(obj({ label: str, value: str })),
  streak: str,
  tip: str,
})
