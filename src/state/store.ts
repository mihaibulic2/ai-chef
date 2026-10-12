// Minimal external store: one object, subscribe/set, persisted to localStorage.
import { useSyncExternalStore } from 'react'
import { loadActiveChatId, loadChats, newChat, saveActiveChatId, saveChats, type Chat } from '../storage/chats'
import { loadSettings, saveSettings, type Settings } from '../storage/settings'

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
    const c = newChat()
    chats = [c, ...chats]
    activeChatId = c.id
  }
  return { settings: loadSettings(), chats, activeChatId, view: 'chat' }
}

let state: AppState = initial()
const listeners = new Set<() => void>()

export function getState(): AppState {
  return state
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...next }
  if (next.settings) saveSettings(state.settings)
  if (next.chats) saveChats(state.chats)
  if (next.activeChatId !== undefined) saveActiveChatId(state.activeChatId)
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
