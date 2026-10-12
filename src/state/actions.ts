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
  judging: new Set<string>(),
  wrapup: false,
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

export async function sendUserMessage(text: string, opts: { visibleText?: string } = {}): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed || busy.chatSending) return
  const chat = activeChat()
  const chatId = chat.id
  busy.chatSending = true
  busy.notify()

  pushUi(chatId, { id: uid(), role: 'user', text: opts.visibleText ?? trimmed })
  const userMsg: Anthropic.MessageParam = { role: 'user', content: trimmed }
  updateChat(chatId, (c) => ({
    ...c,
    title: c.api.length === 0 ? trimmed.slice(0, 48) : c.title,
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
    // Drop an empty assistant bubble (e.g. only tool calls).
    updateChat(chatId, (c) => ({ ...c, ui: { ...c.ui, messages: c.ui.messages.filter((m) => !(m.role === 'assistant' && m.text === '' && !m.recipeIds)) } }))
  } catch (err) {
    // Keep the API history consistent: drop the user turn we could not complete.
    updateChat(chatId, (c) => ({ ...c, api: c.api.length && c.api[c.api.length - 1] === userMsg ? c.api.slice(0, -1) : c.api }))
    pushUi(chatId, errorMessage(err))
  } finally {
    busy.chatSending = false
    busy.notify()
  }
}

function handleTool(chatId: string, name: string, input: unknown): string {
  switch (name) {
    case 'show_recipes': {
      const recipes = (input as { recipes: Recipe[] }).recipes
      const byId: Record<string, Recipe> = {}
      recipes.forEach((r) => (byId[r.id] = r))
      updateChat(chatId, (c) => ({
        ...c,
        ui: {
          ...c.ui,
          recipesById: { ...c.ui.recipesById, ...byId },
          selectedIds: [],
          messages: [...c.ui.messages, { id: uid(), role: 'assistant', text: '', recipeIds: recipes.map((r) => r.id) }],
        },
      }))
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
        const keepKey = c.ui.currentStepKey && plan.steps.some((s) => s.key === c.ui.currentStepKey) ? c.ui.currentStepKey : plan.steps[0]?.key
        const isUpdate = c.ui.cookPlan?.recipeId === plan.recipeId
        return {
          ...c,
          ui: {
            ...c.ui,
            cookPlan: plan,
            currentStepKey: keepKey,
            timers: isUpdate ? c.ui.timers.filter((t) => plan.steps.some((s) => s.key === t.stepKey)) : [],
            wrapup: isUpdate ? c.ui.wrapup : undefined,
          },
        }
      })
      setState({ view: 'cook' })
      return 'Cooking view is open on the user\'s screen.'
    }
    default:
      throw new Error(`Unknown tool ${name}`)
  }
}

export async function judgeRecipe(chatId: string, recipe: Recipe): Promise<void> {
  if (busy.judging.has(recipe.id)) return
  busy.judging.add(recipe.id)
  busy.notify()
  updateChat(chatId, (c) => {
    const { [recipe.id]: _drop, ...rest } = c.ui.judgeFailed
    return { ...c, ui: { ...c.ui, judgeFailed: rest } }
  })
  try {
    const j = await ai().judge(recipe, profileOf(getState().settings))
    updateChat(chatId, (c) => ({ ...c, ui: { ...c.ui, judgeById: { ...c.ui.judgeById, [recipe.id]: j } } }))
  } catch {
    updateChat(chatId, (c) => ({ ...c, ui: { ...c.ui, judgeFailed: { ...c.ui.judgeFailed, [recipe.id]: true } } }))
  } finally {
    busy.judging.delete(recipe.id)
    busy.notify()
  }
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

export function healthiestId(chat: Chat, ids?: string[]): string | null {
  const candidates = (ids ?? Object.keys(chat.ui.recipesById)).filter((id) => chat.ui.judgeById[id])
  if (!candidates.length) return null
  return candidates.reduce((best, id) => (chat.ui.judgeById[id].healthScore > chat.ui.judgeById[best].healthScore ? id : best))
}

export function cookRecipe(recipeId: string): Promise<void> {
  const chat = activeChat()
  const r = chat.ui.recipesById[recipeId]
  if (!r) return Promise.resolve()
  setState({ view: 'chat' })
  return sendUserMessage(`[User tapped "Cook this" on "${r.title}" (id ${r.id}), ${r.servings} servings.] Please open the cooking steps with show_cooking.`, {
    visibleText: `Let's make ${r.title}.`,
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
  if (!chat.ui.cookPlan || chat.ui.wrapup || busy.wrapup) return
  busy.wrapup = true
  busy.notify()
  try {
    const plan = chat.ui.cookPlan
    const w: Wrapup = await ai().wrapup(plan, chat.ui.judgeById[plan.recipeId] ?? null, profileOf(getState().settings))
    updateChat(chat.id, (c) => ({ ...c, ui: { ...c.ui, wrapup: w } }))
  } catch (err) {
    pushUi(chat.id, errorMessage(err))
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
