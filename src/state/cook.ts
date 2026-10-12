import type { CookPlan, Swap } from '../ai/types'

/** Swaps that apply at a given step (by key). */
export function swapsForStep(plan: Pick<CookPlan, 'swaps'>, stepKey: string): Swap[] {
  return (plan.swaps ?? []).filter((sw) => sw.stepKey === stepKey)
}

/** Swaps that have no step or whose step key does not exist in the plan (shown only on the ingredients page). */
export function unanchoredSwaps(plan: Pick<CookPlan, 'swaps' | 'steps'>): Swap[] {
  return (plan.swaps ?? []).filter((sw) => !sw.stepKey || !plan.steps.some((st) => st.key === sw.stepKey))
}
