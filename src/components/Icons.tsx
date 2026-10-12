const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const GearIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
)
export const PlusIcon = () => <svg {...base}><path d="M12 5v14M5 12h14" /></svg>
export const BackIcon = () => <svg {...base}><path d="M15 18l-6-6 6-6" /></svg>
export const CloseIcon = () => <svg {...base}><path d="M18 6L6 18M6 6l12 12" /></svg>
export const SendIcon = () => <svg {...base}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
export const CheckIcon = () => <svg {...base} width={14} height={14} strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>
export const CameraIcon = () => <svg {...base}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
export const PlayIcon = () => <svg {...base} width={16} height={16}><path d="M5 3l14 9-14 9V3z" /></svg>
export const PauseIcon = () => <svg {...base} width={16} height={16}><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
export const RestartIcon = () => <svg {...base} width={16} height={16}><path d="M1 4v6h6M3.5 15a9 9 0 1 0 .5-6" /></svg>
export const MicIcon = () => <svg {...base}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" /></svg>
