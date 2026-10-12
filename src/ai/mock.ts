// Fake AI used when the URL has ?mock=1: same answers every time, no network, no cost.
import type Anthropic from '@anthropic-ai/sdk'
import type { AiClient } from './client'
import type { CallName, ChatTurnHandlers, CookPlan, ImageInput, Judgement, Profile, Recipe, Wrapup } from './types'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const MOCK_RECIPES: Recipe[] = [
  {
    id: 'r1',
    title: 'Garlic Tomato Spaghetti with Spinach',
    pitch: 'Bright, garlicky, done in 15 minutes.',
    timeMin: 15,
    servings: 2,
    ingredients: [
      { name: 'Barilla spaghetti', quantity: '200 g' },
      { name: 'olive oil', quantity: '1 tbsp' },
      { name: 'garlic', quantity: '3 cloves' },
      { name: 'crushed tomatoes', quantity: '1 can (400 g)' },
      { name: 'baby spinach', quantity: '3 big handfuls' },
      { name: 'parmesan', quantity: '2 tbsp, grated' },
      { name: 'salt', quantity: '1/2 tsp' },
    ],
    missing: [],
    tags: ['quick', 'uses what you have'],
  },
  {
    id: 'r2',
    title: 'Creamy Kielbasa Pasta',
    pitch: 'Smoky sausage, sour cream, and dill. Comfort in a bowl.',
    timeMin: 20,
    servings: 2,
    ingredients: [
      { name: 'penne', quantity: '200 g' },
      { name: 'kielbasa', quantity: '150 g, sliced' },
      { name: 'yellow onion', quantity: '1, diced' },
      { name: 'sour cream', quantity: '1/2 cup' },
      { name: 'butter', quantity: '1 tbsp' },
      { name: 'dill', quantity: '2 tbsp, chopped' },
    ],
    missing: [],
    tags: ['comfort', 'one-pan'],
  },
  {
    id: 'r3',
    title: 'Lemon Chicken Orzo',
    pitch: 'Lean chicken, lemon, and herbs over quick orzo.',
    timeMin: 25,
    servings: 2,
    ingredients: [
      { name: 'orzo', quantity: '180 g' },
      { name: 'chicken thighs', quantity: '300 g, diced' },
      { name: 'lemon', quantity: '1' },
      { name: 'olive oil', quantity: '1 tbsp' },
      { name: 'frozen peas', quantity: '1 cup' },
      { name: 'parsley', quantity: 'a handful' },
    ],
    missing: ['orzo'],
    tags: ['high protein', 'missing: orzo'],
  },
]

const judgement = (score: number, tags: string[], ingredients: Judgement['ingredients'], satFat: 'good' | 'neutral' | 'bad'): Judgement => ({
  nutritionPerServing: { calories: 520, protein_g: 18, carbs_g: 78, fat_g: 14, saturatedFat_g: 4, sugar_g: 9, addedSugar_g: 0, fiber_g: 6, sodium_mg: 540 },
  concerns: [
    { name: 'high saturated fat', verdict: satFat, note: satFat === 'good' ? 'Mostly olive oil' : 'Sour cream and butter' },
    { name: 'high added sugar', verdict: 'good', note: 'No added sugar' },
  ],
  allergens: [{ name: 'nuts', present: false, note: 'None' }],
  watchlist: [{ name: 'seed oils', present: false, note: 'None' }],
  ingredients,
  healthScore: score,
  summary: 'A solid weeknight plate.',
  tags,
})

export const MOCK_JUDGEMENTS: Record<string, Judgement> = {
  r1: judgement(84, ['low sat fat', 'high fiber', 'nut-free'], [
    { name: 'Barilla spaghetti', quantity: '200 g', verdict: 'neutral', significance: 0.8, note: 'Refined grain' },
    { name: 'olive oil', quantity: '1 tbsp', verdict: 'good', significance: 0.3, note: 'Healthy fat' },
    { name: 'garlic', quantity: '3 cloves', verdict: 'good', significance: 0.2, note: '' },
    { name: 'crushed tomatoes', quantity: '1 can (400 g)', verdict: 'good', significance: 0.9, note: 'Lycopene, fiber' },
    { name: 'baby spinach', quantity: '3 big handfuls', verdict: 'good', significance: 0.8, note: 'Iron, fiber' },
    { name: 'parmesan', quantity: '2 tbsp, grated', verdict: 'neutral', significance: 0.2, note: '' },
    { name: 'salt', quantity: '1/2 tsp', verdict: 'bad', significance: 0.3, note: 'Sodium' },
  ], 'good'),
  r2: judgement(48, ['high sat fat', 'high sodium', 'nut-free'], [
    { name: 'penne', quantity: '200 g', verdict: 'neutral', significance: 0.8, note: '' },
    { name: 'kielbasa', quantity: '150 g, sliced', verdict: 'bad', significance: 0.9, note: 'Processed meat' },
    { name: 'yellow onion', quantity: '1, diced', verdict: 'good', significance: 0.4, note: '' },
    { name: 'sour cream', quantity: '1/2 cup', verdict: 'bad', significance: 0.7, note: 'Saturated fat' },
    { name: 'butter', quantity: '1 tbsp', verdict: 'bad', significance: 0.3, note: 'Saturated fat' },
    { name: 'dill', quantity: '2 tbsp, chopped', verdict: 'good', significance: 0.1, note: '' },
  ], 'bad'),
  r3: judgement(78, ['high protein', 'low sat fat', 'nut-free'], [
    { name: 'orzo', quantity: '180 g', verdict: 'neutral', significance: 0.8, note: '' },
    { name: 'chicken thighs', quantity: '300 g, diced', verdict: 'good', significance: 0.9, note: 'Protein' },
    { name: 'lemon', quantity: '1', verdict: 'good', significance: 0.2, note: '' },
    { name: 'olive oil', quantity: '1 tbsp', verdict: 'good', significance: 0.3, note: '' },
    { name: 'frozen peas', quantity: '1 cup', verdict: 'good', significance: 0.7, note: 'Fiber' },
    { name: 'parsley', quantity: 'a handful', verdict: 'good', significance: 0.1, note: '' },
  ], 'good'),
}

export const MOCK_PLAN: CookPlan = {
  recipeId: 'r1',
  title: 'Garlic Tomato Spaghetti with Spinach',
  servings: 2,
  ingredients: MOCK_RECIPES[0].ingredients,
  steps: [
    { key: 'boil-water', title: 'Boil the water', instruction: 'Bring a large pot of water to a boil with 1 tbsp of salt.', durationMin: null, tip: null },
    { key: 'cook-pasta', title: 'Cook the spaghetti', instruction: 'Add 200 g spaghetti and cook until just al dente.', durationMin: 9, tip: 'Save a mug of pasta water before draining.' },
    { key: 'garlic', title: 'Sizzle the garlic', instruction: 'In a wide pan, warm 1 tbsp olive oil and 3 sliced garlic cloves over medium heat until fragrant.', durationMin: 2, tip: null },
    { key: 'sauce', title: 'Simmer the sauce', instruction: 'Add the can of crushed tomatoes and 1/2 tsp salt. Simmer gently.', durationMin: 6, tip: null },
    { key: 'spinach', title: 'Wilt the spinach', instruction: 'Stir in 3 handfuls of spinach until wilted, about a minute.', durationMin: null, tip: null },
    { key: 'toss', title: 'Toss and serve', instruction: 'Add the drained pasta, a splash of pasta water, and 2 tbsp parmesan. Toss and serve.', durationMin: null, tip: null },
  ],
}

export const MOCK_WRAPUP: Wrapup = {
  verdict: 'congrats',
  headline: 'Weeknight pasta, done right.',
  highlights: ['Three handfuls of spinach', 'No added sugar', 'Olive oil instead of butter'],
  stats: [
    { label: 'Fiber', value: '6 g per serving' },
    { label: 'vs. creamy pasta', value: 'about half the sat fat' },
    { label: 'Sodium', value: '540 mg' },
  ],
  streak: '3 home-cooked dinners this week',
  tip: 'Next time swap half the spaghetti for whole wheat to add fiber without changing the taste much.',
}

let idCounter = 0
const tid = () => `toolu_mock_${++idCounter}`

export class MockAiClient implements AiClient {
  async chat(history: Anthropic.MessageParam[], _profile: Profile, handlers: ChatTurnHandlers): Promise<Anthropic.MessageParam[]> {
    const last = history[history.length - 1]
    const lastText = typeof last?.content === 'string' ? last.content : ''
    const lower = lastText.toLowerCase()
    const appended: Anthropic.MessageParam[] = []

    const say = async (text: string) => {
      for (const word of text.split(' ')) {
        handlers.onText(word + ' ')
        await wait(25)
      }
    }
    const callTool = async (name: string, input: unknown, text: string) => {
      await say(text)
      const id = tid()
      appended.push({ role: 'assistant', content: [{ type: 'text', text }, { type: 'tool_use', id, name, input }] })
      const result = await handlers.onTool(name, input)
      appended.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: result }] })
    }

    await wait(600)
    if (lower.includes('cook this') || lower.includes("let's make") || lower.includes('lets make') || lower.includes('cook ')) {
      await callTool('set_mood', { positivity: 0.95 }, '')
      await callTool('show_cooking', MOCK_PLAN, 'Great pick. Here we go, step by step.')
    } else if (history.length <= 1 || lower.includes('pasta') || lower.includes('idea')) {
      await callTool('set_mood', { positivity: 0.5 }, '')
      await callTool('show_recipes', { recipes: MOCK_RECIPES }, 'For two, in about 15 minutes, here are three ideas from what you have.')
    } else {
      const text = 'Sure. Tell me what you are in the mood for, and I will suggest something from what you have.'
      await say(text)
      appended.push({ role: 'assistant', content: [{ type: 'text', text }] })
    }
    return appended
  }

  async judge(recipe: Recipe): Promise<Judgement> {
    await wait(1200)
    const j = MOCK_JUDGEMENTS[recipe.id]
    if (!j) throw new Error('mock: no judgement fixture')
    return j
  }

  async pantryVision(_image: ImageInput): Promise<string[]> {
    await wait(800)
    return ['Barilla spaghetti 1 lb', 'Kerrygold salted butter 8 oz', 'yellow onions, 3', 'baby spinach, 5 oz bag']
  }

  async wrapup(): Promise<Wrapup> {
    await wait(900)
    return MOCK_WRAPUP
  }

  async check(_call: CallName): Promise<void> {
    await wait(500)
  }
}
