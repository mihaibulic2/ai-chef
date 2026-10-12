import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from './models'
import { chatTools, judgementSchema, pantryVisionSchema, wrapupSchema } from './schemas'
import type { CallConfig, CallName, ChatTurnHandlers, CookPlan, ImageInput, Judgement, Profile, Recipe, Wrapup } from './types'
import chatConfig from './calls/chat/config.json'
import judgeConfig from './calls/judge/config.json'
import visionConfig from './calls/pantry_vision/config.json'
import mergeConfig from './calls/pantry_merge/config.json'
import wrapupConfig from './calls/wrapup/config.json'
import chatPrompt from './calls/chat/prompt.md?raw'
import judgePrompt from './calls/judge/prompt.md?raw'
import visionPrompt from './calls/pantry_vision/prompt.md?raw'
import mergePrompt from './calls/pantry_merge/prompt.md?raw'
import wrapupPrompt from './calls/wrapup/prompt.md?raw'
import { MockAiClient } from './mock'

export const CALLS: Record<CallName, { config: CallConfig; prompt: string }> = {
  chat: { config: chatConfig as CallConfig, prompt: chatPrompt },
  judge: { config: judgeConfig as CallConfig, prompt: judgePrompt },
  pantry_vision: { config: visionConfig as CallConfig, prompt: visionPrompt },
  pantry_merge: { config: mergeConfig as CallConfig, prompt: mergePrompt },
  wrapup: { config: wrapupConfig as CallConfig, prompt: wrapupPrompt },
}

export const CALL_NAMES = Object.keys(CALLS) as CallName[]

export interface AiClient {
  /** Runs one assistant turn (including tool calls) and returns the messages to append to history. */
  chat(history: Anthropic.MessageParam[], profile: Profile, handlers: ChatTurnHandlers): Promise<Anthropic.MessageParam[]>
  judge(recipe: Recipe, profile: Profile): Promise<Judgement>
  /** Products visible in the photo that are not already in `currentPantry` (one per line). */
  pantryVision(image: ImageInput, currentPantry: string): Promise<string[]>
  /** Dedupe and clean a list of spotted products against the current pantry. */
  pantryMerge(items: string[], currentPantry: string): Promise<string[]>
  wrapup(plan: CookPlan, judgement: Judgement | null, profile: Profile): Promise<Wrapup>
  /** Fires a tiny request with the real model/tools/schema but a throwaway prompt. Resolves on success. */
  check(call: CallName): Promise<void>
}

export type AiErrorKind = 'no_key' | 'auth' | 'network' | 'refusal' | 'format' | 'other'

export class AiError extends Error {
  readonly kind: AiErrorKind
  /** For chat turns: history from completed tool rounds, ending in a valid user tool_result message. */
  partial?: Anthropic.MessageParam[]
  constructor(message: string, kind: AiErrorKind) {
    super(message)
    this.kind = kind
  }
}

const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean)
const listOrNone = (text: string) => (lines(text).length ? lines(text).map((l) => `- ${l}`).join('\n') : '(none)')

export function renderChatSystem(profile: Profile): string {
  const fill: Record<string, string> = {
    aboutMe: profile.aboutMe.trim() || '(nothing provided)',
    pantry: listOrNone(profile.pantryText),
    watchlist: listOrNone(profile.watchlistText),
    allergens: listOrNone(profile.allergensText),
    concerns: listOrNone(profile.concernsText),
  }
  // Function replacer: user text may contain `$` patterns that a string replacement would interpret.
  return CALLS.chat.prompt.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => fill[key] ?? '')
}

export function profileBlock(profile: Profile): string {
  return [
    `Watch-list ingredients:\n${listOrNone(profile.watchlistText)}`,
    `Allergens:\n${listOrNone(profile.allergensText)}`,
    `Health concerns:\n${listOrNone(profile.concernsText)}`,
  ].join('\n\n')
}

function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err
  if (err instanceof Anthropic.AuthenticationError) return new AiError('API key was rejected. Check it in Settings.', 'auth')
  if (err instanceof Anthropic.APIConnectionError) return new AiError('Could not reach the AI service. Check your connection.', 'network')
  if (err instanceof Anthropic.APIError) return new AiError(`AI request failed (${err.status}): ${err.message}`, 'other')
  return new AiError(err instanceof Error ? err.message : String(err), 'other')
}

export class RealAiClient implements AiClient {
  private client: Anthropic

  constructor(apiKey: string) {
    if (!apiKey) throw new AiError('Add your API key in Settings to start.', 'no_key')
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })
  }

  private base(call: CallName) {
    const { config } = CALLS[call]
    return {
      model: MODELS[config.model],
      max_tokens: config.max_tokens,
      output_config: { effort: config.effort } as { effort: CallConfig['effort'] },
    }
  }

  private async structured<T>(call: CallName, schema: object, content: Anthropic.MessageParam['content'], systemOverride?: string): Promise<T> {
    try {
      const res = await this.client.messages.create({
        ...this.base(call),
        system: systemOverride ?? CALLS[call].prompt,
        messages: [{ role: 'user', content }],
        output_config: { ...this.base(call).output_config, format: { type: 'json_schema', schema } as never },
      })
      if (res.stop_reason === 'refusal') throw new AiError('The AI declined this request.', 'refusal')
      if (res.stop_reason === 'max_tokens') throw new AiError('The reply was cut off. Try again.', 'format')
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
      try {
        return JSON.parse(text) as T
      } catch {
        throw new AiError('The AI returned something unreadable.', 'format')
      }
    } catch (err) {
      throw toAiError(err)
    }
  }

  async chat(history: Anthropic.MessageParam[], profile: Profile, handlers: ChatTurnHandlers): Promise<Anthropic.MessageParam[]> {
    const appended: Anthropic.MessageParam[] = []
    const messages = [...history]
    /** Index into `appended` after the last complete tool round (assistant + tool_result). */
    let committed = 0
    try {
      for (let round = 0; round < 6; round++) {
        const stream = this.client.messages.stream({
          ...this.base('chat'),
          system: renderChatSystem(profile),
          tools: chatTools,
          messages,
        })
        stream.on('text', handlers.onText)
        const message = await stream.finalMessage()
        const assistant: Anthropic.MessageParam = { role: 'assistant', content: message.content }
        messages.push(assistant)
        appended.push(assistant)
        if (message.stop_reason === 'refusal') throw new AiError('The AI declined this request.', 'refusal')
        if (message.stop_reason === 'max_tokens') throw new AiError('The reply was cut off. Try again.', 'other')
        const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        if (message.stop_reason !== 'tool_use' || toolUses.length === 0) break
        const results: Anthropic.ToolResultBlockParam[] = []
        for (const tu of toolUses) {
          let content: string
          let is_error = false
          try {
            content = await handlers.onTool(tu.name, tu.input)
          } catch (e) {
            content = e instanceof Error ? e.message : String(e)
            is_error = true
          }
          results.push({ type: 'tool_result', tool_use_id: tu.id, content, is_error })
        }
        const user: Anthropic.MessageParam = { role: 'user', content: results }
        messages.push(user)
        appended.push(user)
        committed = appended.length
      }
      return appended
    } catch (err) {
      const e = toAiError(err)
      e.partial = appended.slice(0, committed)
      throw e
    }
  }

  judge(recipe: Recipe, profile: Profile): Promise<Judgement> {
    const content = `Recipe: ${recipe.title}\nServings: ${recipe.servings}\nIngredients:\n${recipe.ingredients
      .map((i) => `- ${i.name}: ${i.quantity}`)
      .join('\n')}\n\n${profileBlock(profile)}`
    return this.structured<Judgement>('judge', judgementSchema, content)
  }

  async pantryVision(image: ImageInput, currentPantry: string): Promise<string[]> {
    const out = await this.structured<{ products: string[] }>('pantry_vision', pantryVisionSchema, [
      { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
      { type: 'text', text: `Products already at home:\n${listOrNone(currentPantry)}\n\nList only the food products in this photo that are not already on that list.` },
    ])
    return out.products
  }

  async pantryMerge(items: string[], currentPantry: string): Promise<string[]> {
    const out = await this.structured<{ products: string[] }>('pantry_merge', pantryVisionSchema, `Spotted in photos:\n${listOrNone(items.join('\n'))}\n\nAlready at home:\n${listOrNone(currentPantry)}`)
    return out.products
  }

  wrapup(plan: CookPlan, judgement: Judgement | null, profile: Profile): Promise<Wrapup> {
    const content = `Recipe: ${plan.title} (${plan.servings} servings)\nIngredients:\n${plan.ingredients
      .map((i) => `- ${i.name}: ${i.quantity}`)
      .join('\n')}\n\nAssessment:\n${judgement ? JSON.stringify(judgement) : '(not available)'}\n\n${profileBlock(profile)}`
    return this.structured<Wrapup>('wrapup', wrapupSchema, content)
  }

  async check(call: CallName): Promise<void> {
    const system = 'This is a connectivity test. Reply with the answer to 2+2.'
    const user = 'What is 2+2? Keep it minimal.'
    try {
      if (call === 'chat') {
        await this.client.messages.create({ ...this.base('chat'), max_tokens: 500, system, tools: chatTools, messages: [{ role: 'user', content: user }] })
        return
      }
      const schema = call === 'judge' ? judgementSchema : call === 'pantry_vision' || call === 'pantry_merge' ? pantryVisionSchema : wrapupSchema
      await this.structured(call, schema, user, system)
    } catch (err) {
      throw toAiError(err)
    }
  }
}

export function isMockMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('mock') === '1'
  } catch {
    return false
  }
}

export function createAiClient(apiKey: string): AiClient {
  if (isMockMode()) return new MockAiClient()
  return new RealAiClient(apiKey)
}
