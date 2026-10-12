import type Anthropic from '@anthropic-ai/sdk'
import type { CookPlan, Judgement, Recipe, Wrapup } from '../ai/types'
import { readJson, writeJson } from './local'

export interface Timer {
  stepKey: string
  totalSec: number
  /** Seconds remaining at `updatedAt` (wall-clock ms). While running, actual remaining = remainingSec - elapsed. */
  remainingSec: number
  running: boolean
  updatedAt: number
}

export interface UiMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  /** Set when this message carries a recipe carousel. */
  recipeIds?: string[]
  error?: boolean
  kind?: 'selection' | 'swap'
  tone?: 'good' | 'neutral'
}

export interface ChatUi {
  messages: UiMessage[]
  recipesById: Record<string, Recipe>
  judgeById: Record<string, Judgement>
  judgeFailed: Record<string, true>
  selectedIds: string[]
  mood: number
  cookPlan?: CookPlan
  currentStepKey?: string
  timers: Timer[]
  /** Ids of swaps the user said they applied. */
  swapsDone?: string[]
  /** Mood before each applied swap, so switching back can revert it. */
  swapMoodBefore?: Record<string, number>
  wrapup?: Wrapup
}

export interface Chat {
  id: string
  title: string
  createdAt: number
  api: Anthropic.MessageParam[]
  ui: ChatUi
}

export function newChat(): Chat {
  return {
    id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: 'New chat',
    createdAt: Date.now(),
    api: [],
    ui: { messages: [], recipesById: {}, judgeById: {}, judgeFailed: {}, selectedIds: [], mood: 0.3, timers: [] },
  }
}

export function loadChats(): Chat[] {
  return readJson<Chat[]>('chats', [])
}

export function saveChats(chats: Chat[]): void {
  writeJson('chats', chats)
}

export function loadActiveChatId(): string | null {
  return readJson<string | null>('activeChatId', null)
}

export function saveActiveChatId(id: string | null): void {
  writeJson('activeChatId', id)
}
