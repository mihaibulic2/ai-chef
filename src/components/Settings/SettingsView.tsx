import { useEffect, useRef, useState } from 'react'
import { BackIcon, CameraIcon } from '../Icons'
import { CALL_NAMES, isMockMode } from '../../ai/client'
import type { CallName } from '../../ai/types'
import { ai, deleteChat, resetClient, switchChat } from '../../state/actions'
import { resetState, setState, useAppState } from '../../state/store'
import { clearAll, usedBytes } from '../../storage/local'
import { DEFAULT_SETTINGS, type Settings } from '../../storage/settings'
import { fileToImageInput } from './imageResize'

type Tab = 'have' | 'profile' | 'about' | 'storage'
type CheckState = { state: 'idle' | 'running' | 'ok' | 'fail'; error?: string }

const CALL_LABELS: Record<CallName, string> = { chat: 'Chat (Opus)', judge: 'Recipe judge (Sonnet)', pantry_vision: 'Photo to pantry (Opus)', wrapup: 'Wrap-up (Opus)' }

export function SettingsView() {
  const s = useAppState()
  const [draft, setDraft] = useState<Settings>(s.settings)
  const [tab, setTab] = useState<Tab>('have')
  const [saved, setSaved] = useState(false)
  const [checks, setChecks] = useState<Record<CallName, CheckState>>(() => Object.fromEntries(CALL_NAMES.map((n) => [n, { state: 'idle' }])) as Record<CallName, CheckState>)
  const [photoBusy, setPhotoBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.settings)

  const goBack = () => {
    if (dirty && !confirm('Discard unsaved changes?')) return
    setState({ view: 'chat' })
  }

  useEffect(() => { if (saved) { const t = setTimeout(() => setSaved(false), 1800); return () => clearTimeout(t) } }, [saved])

  const save = () => {
    const keyChanged = draft.apiKey !== s.settings.apiKey
    setState({ settings: draft })
    resetClient()
    setSaved(true)
    if (keyChanged && draft.apiKey) void runChecks()
  }

  const runChecks = async () => {
    setChecks(Object.fromEntries(CALL_NAMES.map((n) => [n, { state: 'running' }])) as Record<CallName, CheckState>)
    await Promise.all(CALL_NAMES.map(async (name) => {
      try {
        await ai().check(name)
        setChecks((c) => ({ ...c, [name]: { state: 'ok' } }))
      } catch (err) {
        setChecks((c) => ({ ...c, [name]: { state: 'fail', error: err instanceof Error ? err.message : String(err) } }))
      }
    }))
  }

  const onPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const found: string[] = []
    for (let i = 0; i < files.length; i++) {
      setPhotoBusy(`Reading photo ${i + 1} of ${files.length}…`)
      try {
        const img = await fileToImageInput(files[i])
        found.push(...(await ai().pantryVision(img)))
      } catch (err) {
        setPhotoBusy(err instanceof Error ? err.message : 'Photo failed')
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
    setPhotoBusy(null)
    if (found.length) {
      // Append to whatever the user has typed meanwhile, and save everything.
      const next = { ...draftRef.current, pantryText: [draftRef.current.pantryText.trim(), ...found].filter(Boolean).join('\n') }
      setDraft(next)
      setState({ settings: next })
      resetClient()
      setSaved(true)
    } else {
      setPhotoBusy('No products found in those photos')
      setTimeout(() => setPhotoBusy(null), 2500)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const field = (key: keyof Settings, label: string, help: string, rows?: number) => (
    <div className="field">
      <label>{label}</label>
      <div className="help">{help}</div>
      <textarea value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} rows={rows} data-testid={`field-${key}`} />
    </div>
  )

  return (
    <div className="screen" data-testid="settings">
      <div className="header">
        <button className="icon-btn" onClick={goBack} aria-label="Back" data-testid="settings-back"><BackIcon /></button>
        <h1>Settings</h1>
        <span style={{ width: 40 }} />
      </div>
      <div className="scroll">
        <div className="settings-body">
          <div className="field">
            <label>Anthropic API key</label>
            <div className="row">
              <input className="grow" type="password" value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder="sk-ant-…" autoCapitalize="off" autoCorrect="off" data-testid="api-key" />
              <button className="btn small" onClick={() => void runChecks()} disabled={!s.settings.apiKey && !isMockMode()}>Run checks</button>
            </div>
            {isMockMode() && <div className="help" style={{ marginTop: 6 }}>Mock mode: no key needed, canned answers.</div>}
            <div className="checks" style={{ marginTop: 8 }} data-testid="checks">
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

          <div className="tabs" style={{ padding: 0 }}>
            {([['have', 'What I have'], ['profile', 'My profile'], ['about', 'About me'], ['storage', 'Storage']] as [Tab, string][]).map(([t, l]) => (
              <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} data-testid={`tab-${t}`}>{l}</button>
            ))}
          </div>

          {tab === 'have' && (
            <>
              {field('pantryText', 'Products at home', 'One product per line, the way it reads on a receipt or label. Or snap photos of your fridge, pantry, and receipts.', 14)}
              <div className="row">
                <button className="btn" onClick={() => fileRef.current?.click()} disabled={!!photoBusy}><CameraIcon /> {photoBusy ?? 'Add from photos'}</button>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onPhotos(e.target.files)} data-testid="photo-input" />
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
                <button className="btn ghost" onClick={() => { if (!confirm('Reset pantry, profile, and about-me to the defaults? Your API key is kept.')) return; const next = { ...DEFAULT_SETTINGS, apiKey: draft.apiKey }; setDraft(next); setState({ settings: next }); setSaved(true) }}>Reset defaults</button>
              </div>
            </>
          )}

          {tab !== 'storage' && (
            <div className="row">
              <button className="btn primary" onClick={save} disabled={!dirty} data-testid="save">Save</button>
              {saved && <span className="saved-note">Saved</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
