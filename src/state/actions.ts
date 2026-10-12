// All app actions that touch the AI client or mutate chat state live here so components stay thin.
import type Anthropic from '@anthropic-ai/sdk'
import { AiError, createAiClient, type AiClient } from '../ai/client'
import type { CookPlan, Recipe, Wrapup } from '../ai/types'
import { newChat, type Chat, type UiMessage } from '../storage/chats'
import { profileOf } from '../storage/settings'
import { activeChat, getState, setState, updateChat } from './store'
import { restartTimer, startTimer, toggleTimer } from './timers'

const uid = () => `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

let client: AiClient | null = null
let clientKey = ''

export function ai(): AiClient {
  const key = getState().settings.apiKey
  if (!client || clientKey !== key) {
    client = createAiClient(key)
    clientKey = key
  }
  return client
}

export function resetClient(): void {
  client = null
}

/** In-flight state that does not belong in storage. */
export const busy = {
  chatSending: false,
  /** Keys are `${chatId}:${recipeId}`. */
  judging: new Set<string>(),
  wrapup: false,
  wrapupError: null as string | null,
  /** Non-null while the confetti overlay plays. */
  celebration: null as { text: string; key: number } | null,
  listeners: new Set<() => void>(),
  notify() {
    this.listeners.forEach((l) => l())
  },
}

function pushUi(chatId: string, m: UiMessage): void {
  updateChat(chatId, (c) => ({ ...c, ui: { ...c.ui, messages: [...c.ui.messages, m] } }))
}

function patchUiMessage(chatId: string, id: string, fn: (m: UiMessage) => UiMessage): void {
  updateChat(chatId, (c) => ({ ...c, ui: { ...c.ui, messages: c.ui.messages.map((m) => (m.id === id ? fn(m) : m)) } }))
}

export function errorMessage(err: unknown): UiMessage {
  const text = err instanceof AiError ? err.message : err instanceof Error ? err.message : 'Something went wrong.'
  return { id: uid(), role: 'system', text, error: true }
}

// Sends are serialised: a message sent while a reply streams waits for it instead of being dropped.
let inflight: Promise<void> = Promise.resolve()

export function celebrate(text: string): void {
  busy.celebration = { text, key: Date.now() }
  busy.notify()
  window.setTimeout(() => {
    busy.celebration = null
    busy.notify()
  }, 2800)
}

export interface SendOpts {
  visibleText?: string
  /** Rendered as a "Selection" card instead of a plain bubble. */
  kind?: 'selection' | 'swap'
  tone?: 'good' | 'neutral'
}

export function sendUserMessage(text: string, opts: SendOpts = {}): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return Promise.resolve()
  const run = inflight.then(() => runTurn(trimmed, opts))
  inflight = run.catch(() => undefined)
  return run
}

async function runTurn(trimmed: string, opts: SendOpts): Promise<void> {
  const chat = activeChat()
  const chatId = chat.id
  busy.chatSending = true
  busy.notify()

  pushUi(chatId, { id: uid(), role: 'user', text: opts.visibleText ?? trimmed, kind: opts.kind, tone: opts.tone })
  const userMsg: Anthropic.MessageParam = { role: 'user', content: trimmed }
  updateChat(chatId, (c) => ({
    ...c,
    title: c.api.length === 0 ? (opts.visibleText ?? trimmed).slice(0, 48) : c.title,
    api: [...c.api, userMsg],
  }))

  let currentAssistantId: string | null = null
  const ensureAssistant = () => {
    if (!currentAssistantId) {
      currentAssistantId = uid()
      pushUi(chatId, { id: currentAssistantId, role: 'assistant', text: '' })
    }
    return currentAssistantId
  }
  const dropEmptyBubbles = () =>
    updateChat(chatId, (c) => ({ ...c, ui: { ...c.ui, messages: c.ui.messages.filter((m) => !(m.role === 'assistant' && m.text === '' && !m.recipeIds)) } }))

  try {
    const appended = await ai().chat([...activeChat().api], profileOf(getState().settings), {
      onText: (delta) => {
        const id = ensureAssistant()
        patchUiMessage(chatId, id, (m) => ({ ...m, text: m.text + delta }))
      },
      onTool: async (name, input) => {
        const result = handleTool(chatId, name, input)
        // A tool call ends the current streamed bubble; the next text starts a new one.
        currentAssistantId = null
        return result
      },
    })
    updateChat(chatId, (c) => ({ ...c, api: [...c.api, ...appended] }))
    dropEmptyBubbles()
  } catch (err) {
    const partial = err instanceof AiError ? err.partial : undefined
    if (partial && partial.length) {
      // Completed tool rounds already changed the UI; keep their history so the model remembers them.
      updateChat(chatId, (c) => ({ ...c, api: [...c.api, ...partial] }))
    } else {
      // Nothing happened: drop the user turn so history stays consistent.
      updateChat(chatId, (c) => ({ ...c, api: c.api.length && c.api[c.api.length - 1] === userMsg ? c.api.slice(0, -1) : c.api }))
    }
    dropEmptyBubbles()
    pushUi(chatId, errorMessage(err))
  } finally {
    busy.chatSending = false
    busy.notify()
  }
}

/** Keep the model's id on the newest recipe; older recipes with the same id move aside so old cards keep rendering. */
function reconcileRecipeIds(chat: Chat, incoming: Recipe[]): Chat {
  let ui = chat.ui
  for (const r of incoming) {
    const old = ui.recipesById[r.id]
    if (!old) continue
    const moved = `${r.id}~${Date.now().toString(36)}`
    const { [r.id]: _r, ...restRecipes } = ui.recipesById
    const { [r.id]: oldJudge, ...restJudge } = ui.judgeById
    const { [r.id]: oldFail, ...restFail } = ui.judgeFailed
    ui = {
      ...ui,
      recipesById: { ...restRecipes, [moved]: { ...old, id: moved } },
      judgeById: oldJudge ? { ...restJudge, [moved]: oldJudge } : restJudge,
      judgeFailed: oldFail ? { ...restFail, [moved]: true } : restFail,
      selectedIds: ui.selectedIds.map((id) => (id === r.id ? moved : id)),
      messages: ui.messages.map((m) => (m.recipeIds ? { ...m, recipeIds: m.recipeIds.map((id) => (id === r.id ? moved : id)) } : m)),
    }
  }
  return { ...chat, ui }
}

function handleTool(chatId: string, name: string, input: unknown): string {
  switch (name) {
    case 'show_recipes': {
      const recipes = (input as { recipes: Recipe[] }).recipes
      const byId: Record<string, Recipe> = {}
      recipes.forEach((r) => (byId[r.id] = r))
      updateChat(chatId, (c0) => {
        const c = reconcileRecipeIds(c0, recipes)
        return {
          ...c,
          ui: {
            ...c.ui,
            recipesById: { ...c.ui.recipesById, ...byId },
            // All new cards start selected so Compare is obvious; tapping a card deselects it.
            selectedIds: recipes.map((r) => r.id),
            messages: [...c.ui.messages, { id: uid(), role: 'assistant', text: '', recipeIds: recipes.map((r) => r.id) }],
          },
        }
      })
      recipes.forEach((r) => void judgeRecipe(chatId, r))
      return 'Shown to the user as cards. Health assessments are computed by the app. The user can select cards to compare, or tap "Cook this".'
    }
    case 'set_mood': {
      const p = Math.max(0.2, Math.min(1, Number((input as { positivity: number }).positivity) || 0.3))
      updateChat(chatId, (c) => ({ ...c, ui: { ...c.ui, mood: p } }))
      return 'ok'
    }
    case 'show_cooking': {
      const plan = input as CookPlan
      updateChat(chatId, (c) => {
        const isUpdate = c.ui.cookPlan?.recipeId === plan.recipeId
        const current = c.ui.currentStepKey
        const keepKey = isUpdate && current && (current === '__wrapup' || current === INGREDIENTS_KEY || plan.steps.some((s) => s.key === current)) ? current : INGREDIENTS_KEY
        return {
          ...c,
          ui: {
            ...c.ui,
            cookPlan: plan,
            currentStepKey: keepKey,
            timers: isUpdate ? c.ui.timers.filter((t) => plan.steps.some((s) => s.key === t.stepKey)) : [],
            wrapup: isUpdate ? c.ui.wrapup : undefined,
            swapsDone: isUpdate ? (c.ui.swapsDone ?? []).filter((id) => (plan.swaps ?? []).some((sw) => sw.id === id)) : [],
          },
        }
      })
      if (getState().activeChatId === chatId) setState({ view: 'cook' })
      return "Cooking view is open on the user's screen."
    }
    default:
      throw new Error(`Unknown tool ${name}`)
  }
}

export async function judgeRecipe(chatId: string, recipe: Recipe): Promise<void> {
  const key = `${chatId}:${recipe.id}`
  if (busy.judging.has(key)) return
  busy.judging.add(key)
  busy.notify()
  updateChat(chatId, (c) => {
    const { [recipe.id]: _drop, ...rest } = c.ui.judgeFailed
    return { ...c, ui: { ...c.ui, judgeFailed: rest } }
  })
  try {
    const j = await ai().judge(recipe, profileOf(getState().settings))
    updateChat(chatId, (c) => {
      // The id may have been handed to a newer recipe meanwhile; only write if it is still ours.
      if (c.ui.recipesById[recipe.id]?.title !== recipe.title) return c
      return { ...c, ui: { ...c.ui, judgeById: { ...c.ui.judgeById, [recipe.id]: j } } }
    })
  } catch {
    updateChat(chatId, (c) => ({ ...c, ui: { ...c.ui, judgeFailed: { ...c.ui.judgeFailed, [recipe.id]: true } } }))
  } finally {
    busy.judging.delete(key)
    busy.notify()
  }
}

export function isJudging(chatId: string, recipeId: string): boolean {
  return busy.judging.has(`${chatId}:${recipeId}`)
}

/** Re-fire judges for any recipe in the active chat that has no result (e.g. after a reload). */
export function judgeMissing(): void {
  const chat = activeChat()
  Object.values(chat.ui.recipesById).forEach((r) => {
    if (!chat.ui.judgeById[r.id] && !chat.ui.judgeFailed[r.id]) void judgeRecipe(chat.id, r)
  })
}

export function toggleSelected(recipeId: string): void {
  const chat = activeChat()
  const sel = chat.ui.selectedIds.includes(recipeId) ? chat.ui.selectedIds.filter((i) => i !== recipeId) : [...chat.ui.selectedIds, recipeId]
  updateChat(chat.id, (c) => ({ ...c, ui: { ...c.ui, selectedIds: sel } }))
}

/** The healthiest among `ids`, only once every one of them has a judgement (never on partial data). */
export function healthiestId(chat: Chat, ids: string[]): string | null {
  const valid = ids.filter((id) => chat.ui.recipesById[id])
  if (valid.length < 2 || !valid.every((id) => chat.ui.judgeById[id])) return null
  return valid.reduce((best, id) => (chat.ui.judgeById[id].healthScore > chat.ui.judgeById[best].healthScore ? id : best))
}

export function cookRecipe(recipeId: string, opts: { healthiest?: boolean } = {}): Promise<void> {
  const chat = activeChat()
  const r = chat.ui.recipesById[recipeId]
  if (!r) return Promise.resolve()
  setState({ view: 'chat' })
  // Immediate feedback: the orb takes the recipe's positivity now, before the model replies.
  const fromRecipe = Number.isFinite(r.positivity) ? r.positivity : (chat.ui.judgeById[r.id]?.healthScore ?? 50) / 100
  const mood = Math.max(0.2, Math.min(1, opts.healthiest ? Math.max(fromRecipe, 0.9) : fromRecipe))
  updateChat(chat.id, (c) => ({ ...c, ui: { ...c.ui, mood } }))
  if (opts.healthiest) celebrate('Healthiest pick. Nice.')
  const modelId = r.id.split('~')[0]
  return sendUserMessage(`[User tapped "Cook this" on "${r.title}" (id ${modelId}), ${r.servings} servings.] Please open the cooking steps with show_cooking.`, {
    visibleText: r.title,
    kind: 'selection',
    tone: opts.healthiest ? 'good' : 'neutral',
  })
}

export const INGREDIENTS_KEY = '__ingredients'

/** The user applied a healthier swap: remember it, celebrate, nudge the mood, and tell the chat without leaving cook mode. */
export function applySwap(swapId: string): Promise<void> {
  const chat = activeChat()
  const swap = chat.ui.cookPlan?.swaps?.find((sw) => sw.id === swapId)
  if (!swap || (chat.ui.swapsDone ?? []).includes(swapId)) return Promise.resolve()
  updateChat(chat.id, (c) => ({ ...c, ui: { ...c.ui, swapsDone: [...(c.ui.swapsDone ?? []), swapId], mood: Math.min(1, c.ui.mood + 0.25) } }))
  celebrate('Healthier swap. Nice.')
  return sendUserMessage(`[Action] I made a healthier swap: ${swap.title}. ${swap.change}`, {
    visibleText: `Swapped: ${swap.title}`,
    kind: 'swap',
    tone: 'good',
  })
}

export function setCurrentStep(key: string): void {
  const chat = activeChat()
  updateChat(chat.id, (c) => ({ ...c, ui: { ...c.ui, currentStepKey: key } }))
}

export function timerStart(stepKey: string, minutes: number): void {
  const chat = activeChat()
  updateChat(chat.id, (c) => ({ ...c, ui: { ...c.ui, timers: [...c.ui.timers.filter((t) => t.stepKey !== stepKey), startTimer(stepKey, minutes)] } }))
}

export function timerToggle(stepKey: string): void {
  const chat = activeChat()
  updateChat(chat.id, (c) => ({ ...c, ui: { ...c.ui, timers: c.ui.timers.map((t) => (t.stepKey === stepKey ? toggleTimer(t) : t)) } }))
}

export function timerRestart(stepKey: string): void {
  const chat = activeChat()
  updateChat(chat.id, (c) => ({ ...c, ui: { ...c.ui, timers: c.ui.timers.map((t) => (t.stepKey === stepKey ? restartTimer(t) : t)) } }))
}

export function timerRemove(stepKey: string): void {
  const chat = activeChat()
  updateChat(chat.id, (c) => ({ ...c, ui: { ...c.ui, timers: c.ui.timers.filter((t) => t.stepKey !== stepKey) } }))
}

export async function loadWrapup(): Promise<void> {
  const chat = activeChat()
  const plan = chat.ui.cookPlan
  if (!plan || chat.ui.wrapup || busy.wrapup) return
  busy.wrapup = true
  busy.wrapupError = null
  busy.notify()
  try {
    const w: Wrapup = await ai().wrapup(plan, chat.ui.judgeById[plan.recipeId] ?? null, profileOf(getState().settings))
    // Only keep it if the user is still cooking the same recipe.
    updateChat(chat.id, (c) => (c.ui.cookPlan?.recipeId === plan.recipeId ? { ...c, ui: { ...c.ui, wrapup: w } } : c))
  } catch (err) {
    busy.wrapupError = err instanceof Error ? err.message : 'Could not load the wrap-up.'
  } finally {
    busy.wrapup = false
    busy.notify()
  }
}

export function startNewChat(): void {
  const c = newChat()
  setState((s) => ({ chats: [c, ...s.chats], activeChatId: c.id, view: 'chat' }))
}

export function switchChat(id: string): void {
  setState({ activeChatId: id, view: 'chat' })
}

export function deleteChat(id: string): void {
  setState((s) => {
    const chats = s.chats.filter((c) => c.id !== id)
    if (chats.length === 0) {
      const c = newChat()
      return { chats: [c], activeChatId: c.id }
    }
    return { chats, activeChatId: s.activeChatId === id ? chats[0].id : s.activeChatId }
  })
}
