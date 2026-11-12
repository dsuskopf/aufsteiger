import { Toolbar } from './components/Toolbar'
import { TopView } from './views/top/TopView'
import { SideView } from './views/side/SideView'
import { ThreeView } from './views/three/ThreeView'
import { useUi } from './store/settingsStore'

export function App() {
  const viewMode = useUi((s) => s.viewMode)
  const showTop = viewMode === 'split' || viewMode === 'top'
  const showSide = viewMode === 'split' || viewMode === 'side'
  const show3d = viewMode === '3d'

  return (
    <div className="app">
      <Toolbar />
      <main className="views">
        {showTop && (
          <section className="pane">
            <div className="pane-title">Draufsicht</div>
            <TopView />
          </section>
        )}
        {showSide && (
          <section className="pane">
            <div className="pane-title">Seitenansicht</div>
            <SideView />
          </section>
        )}
        {show3d && (
          <section className="pane">
            <div className="pane-title">3D</div>
            <div className="pane-hint">Ziehen = drehen · Zwei Finger / Rad = zoomen · Rechts / zwei Finger = verschieben</div>
            <ThreeView />
          </section>
        )}
      </main>
    </div>
  )
}
