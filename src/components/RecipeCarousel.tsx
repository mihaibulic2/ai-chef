import { CheckIcon } from './Icons'
import { tagTone } from '../defaults/tags'
import type { Chat } from '../storage/chats'
import { cookRecipe, healthiestId, toggleSelected } from '../state/actions'
import { setState } from '../state/store'

export function RecipeCarousel({ chat, recipeIds }: { chat: Chat; recipeIds: string[] }) {
  const recipes = recipeIds.map((id) => chat.ui.recipesById[id]).filter(Boolean)
  const best = healthiestId(chat, recipeIds)
  const selected = chat.ui.selectedIds.filter((id) => chat.ui.recipesById[id])
  return (
    <div data-testid="carousel">
      <div className="carousel">
        {recipes.map((r) => {
          const j = chat.ui.judgeById[r.id]
          const judging = !j && !chat.ui.judgeFailed[r.id]
          const isSel = chat.ui.selectedIds.includes(r.id)
          const tags = [`${r.timeMin} min`, `${r.servings} servings`, ...r.tags, ...(j?.tags ?? []).slice(0, 3)]
          return (
            <div key={r.id} className={`card rcard${isSel ? ' selected' : ''}${best === r.id ? ' recommended' : ''}`} onClick={() => toggleSelected(r.id)} data-testid={`recipe-${r.id}`} role="button" aria-pressed={isSel}>
              {best === r.id && <span className="chip green" style={{ alignSelf: 'flex-start' }}><span className="dot" />Recommended</span>}
              <h3>{r.title}</h3>
              <p>{r.pitch}</p>
              <div className="tags">
                {tags.map((t, i) => <span key={i} className={`tag ${tagTone(t)}`}>{t}</span>)}
                {r.missing.map((m, i) => <span key={`m${i}`} className="tag bad">missing: {m}</span>)}
                {judging && [0, 1, 2].map((i) => <span key={`p${i}`} className="tag placeholder" style={{ width: 52 + i * 14 }} aria-label="loading" />)}
              </div>
              <div className="foot">
                <button className="btn small" onClick={(e) => { e.stopPropagation(); void cookRecipe(r.id, { healthiest: best === r.id }) }}>Cook this</button>
                <span className="check">{isSel && <CheckIcon />}</span>
              </div>
            </div>
          )
        })}
      </div>
      {selected.length > 0 && (
        <div className="carousel-actions">
          <button className="btn primary" style={{ flex: 1 }} onClick={() => setState({ view: 'grid' })} data-testid="compare">Compare ({selected.length})</button>
        </div>
      )}
    </div>
  )
}
