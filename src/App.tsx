import { ChatView } from './components/ChatView'
import { CookMode } from './components/CookMode'
import { HealthGrid } from './components/HealthGrid'
import { SettingsView } from './components/Settings/SettingsView'
import { useAppState } from './state/store'

export default function App() {
  const s = useAppState()
  return (
    <div className="app">
      {s.view === 'chat' && <ChatView />}
      {s.view === 'grid' && <HealthGrid />}
      {s.view === 'settings' && <SettingsView />}
      {s.view === 'cook' && <CookMode />}
    </div>
  )
}
