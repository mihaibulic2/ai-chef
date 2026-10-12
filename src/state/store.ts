// Minimal external store: one object, subscribe/set, persisted to localStorage.
import { useSyncExternalStore } from 'react'
import { loadActiveChatId, loadChats, newChat, saveActiveChatId, saveChats, type Chat } from '../storage/chats'
import { loadSettings, saveSettings, type Settings } from '../storage/settings'
import { readJson, writeJson } from '../storage/local'

export type View = 'chat' | 'grid' | 'cook' | 'settings'

export interface AppState {
  settings: Settings
  chats: Chat[]
  activeChatId: string
  view: View
}

function initial(): AppState {
  let chats = loadChats()
  let activeChatId = loadActiveChatId() ?? ''
  if (!chats.some((c) => c.id === activeChatId)) {
    // No remembered chat: reopen the most recent one, or start fresh.
    if (chats.length > 0) {
      activeChatId = chats[0].id
    } else {
      const c = newChat()
      chats = [c]
      activeChatId = c.id
      saveChats(chats)
    }
    saveActiveChatId(activeChatId)
  }
  // Reopen cook mode if that is where the user was; every other screen starts back at the chat.
  const active = chats.find((c) => c.id === activeChatId)
  const view: View = readJson<View>('view', 'chat') === 'cook' && active?.ui.cookPlan ? 'cook' : 'chat'
  return { settings: loadSettings(), chats, activeChatId, view }
}

let state: AppState = initial()
const listeners = new Set<() => void>()

export function getState(): AppState {
  return state
}

// Chats change on every streamed token, so their write to localStorage is coalesced.
let chatsDirty = false
let flushTimer: number | null = null

export function flushChats(): void {
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
  if (chatsDirty) {
    chatsDirty = false
    saveChats(state.chats)
  }
}

function scheduleChatsFlush(): void {
  chatsDirty = true
  if (flushTimer === null) flushTimer = window.setTimeout(flushChats, 400)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushChats)
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushChats() })
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...next }
  if (next.settings) saveSettings(state.settings)
  if (next.chats) scheduleChatsFlush()
  if (next.activeChatId !== undefined) saveActiveChatId(state.activeChatId)
  if (next.view) writeJson('view', state.view)
  listeners.forEach((l) => l())
}

export function updateChat(id: string, fn: (c: Chat) => Chat): void {
  setState((s) => ({ chats: s.chats.map((c) => (c.id === id ? fn(c) : c)) }))
}

export function activeChat(s: AppState = state): Chat {
  return s.chats.find((c) => c.id === s.activeChatId) ?? s.chats[0]
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getState,
    getState,
  )
}

/** Test/support hook: replace the whole state (used after "clear all"). */
export function resetState(): void {
  const c = newChat()
  setState({ chats: [c], activeChatId: c.id, view: 'chat' })
}
