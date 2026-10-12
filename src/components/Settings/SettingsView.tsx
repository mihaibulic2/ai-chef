import { useEffect, useState } from 'react'
import { BackIcon } from '../Icons'
import { CALL_NAMES, isMockMode } from '../../ai/client'
import type { CallName } from '../../ai/types'
import { ai, deleteChat, resetClient, switchChat } from '../../state/actions'
import { resetState, setState, useAppState } from '../../state/store'
import { clearAll, usedBytes } from '../../storage/local'
import { DEFAULT_SETTINGS, TEXT_FIELDS, type Settings } from '../../storage/settings'
import { PhotoPanel } from './PhotoPanel'

type Tab = 'have' | 'profile' | 'about' | 'storage' | 'api'
type CheckState = { state: 'idle' | 'running' | 'ok' | 'fail'; error?: string }

const CALL_LABELS: Record<CallName, string> = { chat: 'Chat (Opus)', judge: 'Recipe judge (Sonnet)', pantry_vision: 'Photo to pantry (Opus)', pantry_merge: 'Pantry tidy-up (Sonnet)', wrapup: 'Wrap-up (Opus)' }
const TABS: [Tab, string][] = [['have', 'What I have'], ['profile', 'Profile'], ['about', 'About me'], ['storage', 'Storage'], ['api', 'API key']]

export function SettingsView() {
  const s = useAppState()
  const [draft, setDraft] = useState<Settings>(s.settings)
  const needsKey = !s.settings.apiKeyVerified && !isMockMode()
  const [tab, setTab] = useState<Tab>(needsKey ? 'api' : 'have')
  const [saved, setSaved] = useState(false)
  const [checks, setChecks] = useState<Record<CallName, CheckState>>(() => Object.fromEntries(CALL_NAMES.map((n) => [n, { state: 'idle' }])) as Record<CallName, CheckState>)
  const [checking, setChecking] = useState(false)
  const textDirty = TEXT_FIELDS.some((k) => draft[k] !== s.settings[k])
  const keyDirty = draft.apiKey !== s.settings.apiKey

  useEffect(() => { if (saved) { const t = setTimeout(() => setSaved(false), 1800); return () => clearTimeout(t) } }, [saved])

  const goBack = () => {
    if ((textDirty || keyDirty) && !confirm('Discard unsaved changes?')) return
    setState({ view: 'chat' })
  }

  const saveText = () => {
    setState((st) => ({ settings: { ...st.settings, ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, draft[k]])) } }))
    setSaved(true)
  }

  /** Save the key, then verify it with one tiny request per AI call. Verified only when all pass. */
  const saveKey = async () => {
    const key = draft.apiKey.trim()
    setState((st) => ({ settings: { ...st.settings, apiKey: key, apiKeyVerified: false } }))
    setDraft((d) => ({ ...d, apiKey: key, apiKeyVerified: false }))
    resetClient()
    if (!key && !isMockMode()) return
    setChecking(true)
    setChecks(Object.fromEntries(CALL_NAMES.map((n) => [n, { state: 'running' }])) as Record<CallName, CheckState>)
    const results = await Promise.all(CALL_NAMES.map(async (name) => {
      try {
        await ai().check(name)
        setChecks((c) => ({ ...c, [name]: { state: 'ok' } }))
        return true
      } catch (err) {
        setChecks((c) => ({ ...c, [name]: { state: 'fail', error: err instanceof Error ? err.message : String(err) } }))
        return false
      }
    }))
    setChecking(false)
    if (results.every(Boolean)) {
      setState((st) => ({ settings: { ...st.settings, apiKeyVerified: true } }))
      setDraft((d) => ({ ...d, apiKeyVerified: true }))
    }
  }

  const addPantryLines = (lines: string[]) => {
    const pantryText = [draft.pantryText.trim(), ...lines].filter(Boolean).join('\n')
    setDraft((d) => ({ ...d, pantryText }))
    setState((st) => ({ settings: { ...st.settings, pantryText } }))
    setSaved(true)
  }

  const field = (key: keyof Settings, label: string, help: string, rows?: number) => (
    <div className="field">
      <label>{label}</label>
      <div className="help">{help}</div>
      <textarea value={String(draft[key])} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} rows={rows} data-testid={`field-${key}`} />
    </div>
  )

  return (
    <div className="screen" data-testid="settings">
      <div className="header">
        <button className="icon-btn" onClick={goBack} aria-label="Back" data-testid="settings-back"><BackIcon /></button>
        <h1>Settings</h1>
        <span style={{ width: 40 }} />
      </div>
      <div className="tabs">
        {TABS.map(([t, l]) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}${t === 'api' && needsKey ? ' alert' : ''}`} onClick={() => setTab(t)} data-testid={`tab-${t}`}>{l}</button>
        ))}
      </div>
      <div className="scroll">
        <div className="settings-body">
          {tab === 'have' && (
            <>
              {field('pantryText', 'Products at home', 'One product per line, the way it reads on a receipt or label.', 14)}
              <div className="field">
                <label>Add from photos</label>
                <div className="help">Snap your fridge, pantry, cupboard, or receipts. Only new items get added.</div>
                <PhotoPanel currentPantry={draft.pantryText} onAdd={addPantryLines} />
              </div>
            </>
          )}
          {tab === 'profile' && (
            <>
              {field('watchlistText', 'Ingredients to avoid', 'One per line. Additives and ingredients you want flagged when they show up.', 10)}
              {field('allergensText', 'Allergens', 'One per line. Recipes never include these.', 3)}
              {field('concernsText', 'Health concerns', 'One per line, for example "high sodium" or "low protein".', 4)}
            </>
          )}
          {tab === 'about' && field('aboutMe', 'About me', 'Anything the chef should assume unless you say otherwise: who you cook for, your goals, what you like.', 7)}
          {tab === 'storage' && (
            <>
              <div className="field">
                <label>Chats</label>
                <div className="help">Everything is stored on this device only. About {(usedBytes() / 1024).toFixed(0)} KB used.</div>
                <div className="checks">
                  {s.chats.map((c) => (
                    <div key={c.id} className="card chat-row" data-testid={`chat-row-${c.id}`}>
                      <button className="meta" onClick={() => switchChat(c.id)} style={{ textAlign: 'left' }}>
                        <div className="t">{c.title}{c.id === s.activeChatId ? ' · current' : ''}</div>
                        <div className="d">{new Date(c.createdAt).toLocaleString()} · {c.ui.messages.length} messages</div>
                      </button>
                      <button className="del" onClick={() => { if (confirm(`Delete "${c.title}"?`)) deleteChat(c.id) }} aria-label={`Delete ${c.title}`}>Delete</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="row">
                <button className="btn" onClick={() => { if (confirm('Clear all chats and settings on this device?')) { clearAll(); setState({ settings: DEFAULT_SETTINGS }); setDraft(DEFAULT_SETTINGS); resetState() } }} data-testid="clear-all">Clear all</button>
                <button className="btn ghost" onClick={() => { if (!confirm('Reset pantry, profile, and about-me to the defaults? Your API key is kept.')) return; const next = { ...DEFAULT_SETTINGS, apiKey: draft.apiKey, apiKeyVerified: draft.apiKeyVerified }; setDraft(next); setState({ settings: next }); setSaved(true) }}>Reset defaults</button>
              </div>
            </>
          )}
          {tab === 'api' && (
            <div className="field">
              <label>Anthropic API key</label>
              <div className="help">{needsKey ? 'Paste your key and tap Save. It is checked once against every model the app uses, then remembered on this device.' : 'Your key is verified. Paste a new one and tap Save to change it.'}</div>
              <input className={needsKey ? 'alert' : ''} type="password" value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder="sk-ant-…" autoCapitalize="off" autoCorrect="off" data-testid="api-key" />
              {isMockMode() && <div className="help" style={{ marginTop: 6 }}>Mock mode: no key needed, canned answers.</div>}
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn primary" onClick={() => void saveKey()} disabled={checking || (!keyDirty && s.settings.apiKeyVerified) || (!draft.apiKey.trim() && !isMockMode())} data-testid="save-key">Save</button>
                {s.settings.apiKeyVerified && !keyDirty && <span className="saved-note">Verified</span>}
              </div>
              <div className="checks" style={{ marginTop: 12 }} data-testid="checks">
                {CALL_NAMES.map((name) => {
                  const c = checks[name]
                  return (
                    <div key={name} className={`card check-row${c.error ? ' wrapline' : ''}`} data-check={c.state}>
                      <span className="name">{CALL_LABELS[name]}</span>
                      <span className="state">
                        {c.state === 'running' && <span className="spinner" />}
                        {c.state === 'ok' && <span className="ok">✓</span>}
                        {c.state === 'fail' && <span className="fail">✗</span>}
                        {c.state === 'idle' && <span className="dim">·</span>}
                      </span>
                      {c.error && <span className="err">{c.error}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(tab === 'have' || tab === 'profile' || tab === 'about') && (
            <div className="row">
              <button className="btn primary" onClick={saveText} disabled={!textDirty} data-testid="save">Save</button>
              {saved && <span className="saved-note">Saved</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
