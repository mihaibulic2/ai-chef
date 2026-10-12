import { useEffect, useRef, useState } from 'react'
import { CameraIcon, CloseIcon } from '../Icons'
import { ai } from '../../state/actions'
import { fileToImageInput } from './imageResize'

interface Photo { id: string; file: File; url: string }

interface Props {
  /** The pantry text the analysis should compare against (the current draft). */
  currentPantry: string
  /** Called with the lines the user chose to add. */
  onAdd: (lines: string[]) => void
}

/** Add photos of the fridge, pantry, or receipts; analyze them; pick what to add. */
export function PhotoPanel({ currentPantry, onAdd }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [proposed, setProposed] = useState<{ line: string; checked: boolean }[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = status !== null

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos])

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const next: Photo[] = Array.from(files).map((file) => ({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, file, url: URL.createObjectURL(file) }))
    setPhotos((p) => [...p, ...next])
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const remove = (id: string) => setPhotos((p) => p.filter((x) => x.id !== id))

  const analyze = async () => {
    setError(null)
    const found: string[] = []
    const failures: string[] = []
    try {
      for (let i = 0; i < photos.length; i++) {
        setStatus(`Looking at photo ${i + 1} of ${photos.length}…`)
        try {
          const img = await fileToImageInput(photos[i].file)
          found.push(...(await ai().pantryVision(img, currentPantry)))
        } catch (err) {
          failures.push(err instanceof Error ? err.message : 'Photo failed')
        }
      }
      if (failures.length === photos.length) {
        setError(failures[0])
        return
      }
      let lines: string[] = []
      if (found.length > 0) {
        setStatus('Tidying the list…')
        try {
          lines = await ai().pantryMerge(found, currentPantry)
        } catch {
          lines = [...new Set(found)]
        }
      }
      // Always show the sheet, even when empty, so the outcome is clear.
      setProposed(lines.map((line) => ({ line, checked: true })))
    } finally {
      setStatus(null)
    }
  }

  const confirm = () => {
    const lines = (proposed ?? []).filter((p) => p.checked).map((p) => p.line)
    setProposed(null)
    setPhotos([])
    if (lines.length) onAdd(lines)
  }

  return (
    <div className="photo-panel">
      <div className="photo-strip">
        <button className="photo-add" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="photo-add">
          <CameraIcon />
          <span>Add a photo</span>
        </button>
        {photos.map((p) => (
          <div key={p.id} className="photo-thumb" data-testid="photo-thumb">
            <img src={p.url} alt="" />
            <button className="photo-x" aria-label="Remove photo" onClick={() => remove(p.id)}><CloseIcon /></button>
          </div>
        ))}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} data-testid="photo-input" />
      </div>
      {photos.length > 0 && (
        <button className="btn primary" onClick={() => void analyze()} disabled={busy} data-testid="analyze-photos">
          {busy ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> {status}</> : `Analyze ${photos.length === 1 ? 'photo' : `${photos.length} photos`}`}
        </button>
      )}
      {error && <div className="help" style={{ color: 'var(--pink)' }}>{error}</div>}
      {proposed && (() => {
        const selected = proposed.filter((p) => p.checked).length
        const allChecked = proposed.length > 0 && selected === proposed.length
        return (
          <div className="sheet-backdrop" onClick={() => setProposed(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()} data-testid="photo-results">
              <h3>Add to what I have</h3>
              {proposed.length === 0 ? (
                <div className="sheet-empty" data-testid="photo-results-empty">Nothing new to add. Everything we spotted is already on your list.</div>
              ) : (
                <>
                  <label className="check-item all">
                    <input type="checkbox" checked={allChecked} onChange={(e) => setProposed(proposed.map((x) => ({ ...x, checked: e.target.checked })))} data-testid="photo-select-all" />
                    <span>Select all</span>
                    <span className="dim" style={{ marginLeft: 'auto' }}>{selected} of {proposed.length}</span>
                  </label>
                  <div className="check-list">
                    {proposed.map((p, i) => (
                      <label key={i} className="check-item">
                        <input type="checkbox" checked={p.checked} onChange={(e) => setProposed(proposed.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))} />
                        <span>{p.line}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              <div className="sheet-actions">
                {proposed.length === 0 ? (
                  <button className="btn primary grow" onClick={() => setProposed(null)}>OK</button>
                ) : (
                  <>
                    <button className="btn ghost" onClick={() => setProposed(null)}>Close</button>
                    <button className="btn primary grow" onClick={confirm} disabled={selected === 0} data-testid="photo-add-confirm">Add selected</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
