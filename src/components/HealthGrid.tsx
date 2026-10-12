import { BackIcon } from './Icons'
import { dotStyle } from './dotColor'
import type { Judgement, NutritionPerServing } from '../ai/types'
import { cookRecipe, healthiestId, isJudging, judgeRecipe } from '../state/actions'
import { activeChat, setState, useAppState } from '../state/store'
import { useBusy } from './useBusy'

const NUTRITION_ROWS: { key: keyof NutritionPerServing; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
  { key: 'saturatedFat_g', label: 'Saturated fat', unit: 'g' },
  { key: 'sugar_g', label: 'Sugar', unit: 'g' },
  { key: 'addedSugar_g', label: 'Added sugar', unit: 'g' },
  { key: 'fiber_g', label: 'Fiber', unit: 'g' },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg' },
]

const lines = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean)

function Loading() {
  return <span className="dot loading" aria-label="loading" />
}

export function HealthGrid() {
  const s = useAppState()
  const chat = activeChat(s)
  useBusy()
  const ids = chat.ui.selectedIds.filter((id) => chat.ui.recipesById[id])
  const recipes = ids.map((id) => chat.ui.recipesById[id])
  const best = healthiestId(chat, ids)
  const concernNames = lines(s.settings.concernsText)
  const allergenNames = lines(s.settings.allergensText)
  const watchNames = lines(s.settings.watchlistText)

  const status = (id: string): { j?: Judgement; loading: boolean; failed: boolean } => ({ j: chat.ui.judgeById[id], loading: isJudging(chat.id, id), failed: !!chat.ui.judgeFailed[id] })

  const cell = (id: string, render: (j: Judgement) => React.ReactNode) => {
    const st = status(id)
    if (st.j) return render(st.j)
    if (st.failed) return <button className="dim" onClick={() => void judgeRecipe(chat.id, chat.ui.recipesById[id])}>Unavailable. Tap to retry</button>
    return <Loading />
  }

  // Exact name first, then one name containing the other; never a first-word guess.
  const findBy = <T extends { name: string }>(list: T[], name: string): T | undefined => {
    const n = name.toLowerCase().trim()
    return list.find((x) => x.name.toLowerCase().trim() === n) ?? list.find((x) => { const xn = x.name.toLowerCase().trim(); return xn.includes(n) || n.includes(xn) })
  }

  const onCook = (id: string) => void cookRecipe(id, { healthiest: id === best })

  if (recipes.length === 0) {
    return (
      <div className="screen">
        <div className="header"><button className="icon-btn" onClick={() => setState({ view: 'chat' })} aria-label="Back"><BackIcon /></button><h1>Compare</h1><span /></div>
        <div className="center">Select one or more recipes in the chat to compare them here.</div>
      </div>
    )
  }

  return (
    <div className="screen" data-testid="grid">
      <div className="header">
        <button className="icon-btn" onClick={() => setState({ view: 'chat' })} aria-label="Back" data-testid="grid-back"><BackIcon /></button>
        <h1>Compare</h1>
        <span style={{ width: 40 }} />
      </div>
      <div className="grid-wrap">
        <table className="hgrid">
          <thead>
            <tr>
              <th className="label">Per serving</th>
              {recipes.map((r) => (
                <th key={r.id} className={`col${best === r.id ? ' recommended' : ''}`}>
                  {r.title}
                  {best === r.id && <div><span className="chip green"><span className="dot" />Recommended</span></div>}
                  {chat.ui.judgeById[r.id] && <div className="cell-note">Health score {Math.round(chat.ui.judgeById[r.id].healthScore)}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="label" />
              {recipes.map((r) => (
                <td key={r.id} className="col">
                  <button className={`btn small ${best === r.id ? 'green' : ''}`} onClick={() => onCook(r.id)} data-testid={`cook-${r.id}`}>Cook this</button>
                </td>
              ))}
            </tr>
            <tr className="group"><td colSpan={recipes.length + 1}>Nutrition</td></tr>
            {NUTRITION_ROWS.map((row) => (
              <tr key={row.key}>
                <td className="label">{row.label}</td>
                {recipes.map((r) => <td key={r.id} className="col">{cell(r.id, (j) => `${Math.round(j.nutritionPerServing[row.key])} ${row.unit}`)}</td>)}
              </tr>
            ))}
            {concernNames.length > 0 && <tr className="group"><td colSpan={recipes.length + 1}>Your concerns</td></tr>}
            {concernNames.map((name) => (
              <tr key={name}>
                <td className="label">{name}</td>
                {recipes.map((r) => (
                  <td key={r.id} className="col">
                    {cell(r.id, (j) => {
                      const c = findBy(j.concerns, name)
                      if (!c) return <span className="dim">—</span>
                      return <><span className={`verdict-${c.verdict}`}>{c.verdict === 'good' ? 'Good' : c.verdict === 'bad' ? 'Watch' : 'OK'}</span>{c.note && <div className="cell-note">{c.note}</div>}</>
                    })}
                  </td>
                ))}
              </tr>
            ))}
            {allergenNames.length > 0 && <tr className="group"><td colSpan={recipes.length + 1}>Allergens</td></tr>}
            {allergenNames.map((name) => (
              <tr key={name}>
                <td className="label">{name}</td>
                {recipes.map((r) => (
                  <td key={r.id} className="col">
                    {cell(r.id, (j) => {
                      const a = findBy(j.allergens, name)
                      if (!a) return <span className="dim">—</span>
                      return <><span className={a.present ? 'verdict-bad' : 'verdict-good'}>{a.present ? 'Contains' : 'Free'}</span>{a.note && <div className="cell-note">{a.note}</div>}</>
                    })}
                  </td>
                ))}
              </tr>
            ))}
            {watchNames.length > 0 && <tr className="group"><td colSpan={recipes.length + 1}>Watch-list</td></tr>}
            {watchNames.map((name) => (
              <tr key={name}>
                <td className="label">{name}</td>
                {recipes.map((r) => (
                  <td key={r.id} className="col">
                    {cell(r.id, (j) => {
                      const w = findBy(j.watchlist, name)
                      if (!w) return <span className="dim">—</span>
                      return <><span className={w.present ? 'verdict-bad' : 'verdict-good'}>{w.present ? 'Present' : 'None'}</span>{w.note && <div className="cell-note">{w.note}</div>}</>
                    })}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="group"><td colSpan={recipes.length + 1}>Ingredients</td></tr>
            <tr>
              <td className="label">Amounts and impact</td>
              {recipes.map((r) => {
                const st = status(r.id)
                return (
                  <td key={r.id} className="col" data-testid={`ingredients-${r.id}`}>
                    {r.ingredients.map((ing, i) => {
                      // Match by name; fall back to position only when the judge returned the same count.
                      const judged = st.j ? (findBy(st.j.ingredients, ing.name) ?? (st.j.ingredients.length === r.ingredients.length ? st.j.ingredients[i] : undefined)) : undefined
                      return (
                        <div key={i} className="ingr">
                          <span className="dot-col">
                            {judged ? (
                              <span className="dot" style={dotStyle(judged.verdict, judged.significance)} title={judged.note} data-verdict={judged.verdict} />
                            ) : st.failed || st.j ? (
                              <span className="dot hidden" />
                            ) : (
                              <Loading />
                            )}
                          </span>
                          <span>
                            {ing.name}
                            <div className="cell-note">{ing.quantity}{judged?.note ? ` · ${judged.note}` : ''}</div>
                          </span>
                        </div>
                      )
                    })}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
