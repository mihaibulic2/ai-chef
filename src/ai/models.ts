// Single place to change which model does what. Call configs reference these keys.
export const MODELS = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
} as const

export type ModelKey = keyof typeof MODELS
