import { ChatView } from './components/ChatView'
import { CookMode } from './components/CookMode'
import { HealthGrid } from './components/HealthGrid'
import { SettingsView } from './components/Settings/SettingsView'
import { useEffect } from 'react'
import { useAppState } from './state/store'
import { startTimerWatch } from './state/timerPing'
import { busy } from './state/actions'
import { useBusy } from './components/useBusy'
import { Celebrate } from './components/Celebrate'

export default function App() {
  const s = useAppState()
  useEffect(() => startTimerWatch(), [])
  useBusy()
  return (
    <div className="app">
      {s.view === 'chat' && <ChatView />}
      {s.view === 'grid' && <HealthGrid />}
      {s.view === 'settings' && <SettingsView />}
      {s.view === 'cook' && <CookMode />}
      {busy.celebration && <Celebrate key={busy.celebration.key} text={busy.celebration.text} />}
    </div>
  )
}
