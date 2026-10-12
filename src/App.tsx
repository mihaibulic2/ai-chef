import { ChatView } from './components/ChatView'
import { CookMode } from './components/CookMode'
import { HealthGrid } from './components/HealthGrid'
import { SettingsView } from './components/Settings/SettingsView'
import { useEffect } from 'react'
import { useAppState } from './state/store'
import { startTimerWatch } from './state/timerPing'

export default function App() {
  const s = useAppState()
  useEffect(() => startTimerWatch(), [])
  return (
    <div className="app">
      {s.view === 'chat' && <ChatView />}
      {s.view === 'grid' && <HealthGrid />}
      {s.view === 'settings' && <SettingsView />}
      {s.view === 'cook' && <CookMode />}
    </div>
  )
}
