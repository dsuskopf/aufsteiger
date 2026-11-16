import { useEffect, useRef } from 'react'
import { Stage } from 'react-konva'
import type Konva from 'konva'
import { SKETCH_COLORS, SKETCH_COLOR_LABELS, SKETCH_WIDTHS } from '@shared/types'
import { ConfirmButton } from '@renderer/components/ConfirmButton'
import { Icon } from '@renderer/components/Icon'
import { ViewControls } from '@renderer/components/ViewControls'
import { NamesButton, ZonesButton } from '@renderer/components/ViewToggles'
import { useElementSize } from '@renderer/components/useElementSize'
import { useSettings } from '@renderer/store/appSettings'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'
import { COLORS } from '@renderer/theme/colors'
import { PlayersLayer, hitsDraggable } from '../top/PlayersLayer'
import { CourtLayer } from '../top/TopView'
import { useCourtViewport } from '../top/useCourtViewport'
import { LiveSketchLayer, SketchLayer } from './SketchLayer'
import { useSketchInput } from './useSketchInput'

/**
 * Skizze: das Feld als Taktiktafel. Frei zeichnen (Stift, Maus, auf Wunsch Finger) und Spieler stellen –
 * ohne Ballwege, Kurvenpunkte, 3D oder Einstellungen. Die Skizze gehört zum Spielzug und wird mit ihm gespeichert.
 */
export function SketchView() {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const stageRef = useRef<Konva.Stage>(null)
  const rotateTop = useUi((s) => s.rotateTop)
  const tool = useUi((s) => s.sketchTool)
  const sketch = usePlay((s) => s.sketch)
  const fingerDraws = useSettings((s) => s.settings.fingerDraws)
  const smooth = useSettings((s) => s.settings.sketchSmooth)
  const { vp, zoomIn, zoomOut, reset } = useCourtViewport(ref, size, {
    // Der Finger verschiebt die Ansicht – außer er zeichnet oder zieht gerade einen Spieler
    shouldIgnore: (e) =>
      (e.pointerType === 'touch' && useSettings.getState().settings.fingerDraws) || hitsDraggable(stageRef.current, e.clientX, e.clientY)
  })
  const live = useSketchInput(ref, stageRef, vp)
  // Nach einer Größenänderung alle Ebenen neu zeichnen
  useEffect(() => {
    const id = requestAnimationFrame(() => stageRef.current?.batchDraw())
    return () => cancelAnimationFrame(id)
  }, [size.width, size.height])

  return (
    <>
      <div className={`canvas-host sketching ${tool}`} ref={ref}>
        {size.width > 0 && (
          <Stage ref={stageRef} width={size.width} height={size.height}>
            <CourtLayer vp={vp} />
            <SketchLayer sketch={sketch} vp={vp} smooth={smooth} />
            <LiveSketchLayer live={live} vp={vp} smooth={smooth} />
            <PlayersLayer vp={vp} board />
          </Stage>
        )}
      </div>
      {sketch.length === 0 && !live.stroke && (
        <div className="pane-hint sketch-hint" role="status">
          {fingerDraws ? 'Mit Stift, Finger oder Maus zeichnen' : 'Mit Stift oder Maus zeichnen · der Finger verschiebt und zoomt'} · Spieler lassen sich ziehen
        </div>
      )}
      <ViewControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset}>
        <NamesButton />
        <button title="Feld um 90° drehen" aria-label="Feld um 90 Grad drehen" onClick={rotateTop}>
          <Icon name="rotate" />
        </button>
        <ZonesButton />
      </ViewControls>
      <SketchBar />
    </>
  )
}

const WIDTH_LABELS = ['Fein', 'Mittel', 'Breit']

/** Werkzeugleiste der Skizze: Stift oder Radierer, Farbe, Strichstärke, alles löschen */
function SketchBar() {
  const tool = useUi((s) => s.sketchTool)
  const color = useUi((s) => s.sketchColor)
  const width = useUi((s) => s.sketchWidth)
  const setSketch = useUi((s) => s.setSketch)
  const empty = usePlay((s) => s.sketch.length === 0)
  const pen = tool === 'pen'
  return (
    <div className="sketch-bar" role="toolbar" aria-label="Skizze">
      <div className="segmented" role="radiogroup" aria-label="Werkzeug">
        <button role="radio" aria-checked={pen} className={pen ? 'selected' : ''} title="Stift" onClick={() => setSketch({ sketchTool: 'pen' })}>
          <Icon name="pencil" size={18} />
          Stift
        </button>
        <button
          role="radio"
          aria-checked={!pen}
          className={pen ? '' : 'selected'}
          title="Radierer: löscht ganze Striche. Die Radierer-Taste am Stift tut dasselbe."
          onClick={() => setSketch({ sketchTool: 'eraser' })}
        >
          <Icon name="eraser" size={18} />
          Radierer
        </button>
      </div>
      <span className="sketch-sep" aria-hidden="true" />
      <div className="sketch-swatches" role="radiogroup" aria-label="Farbe">
        {SKETCH_COLORS.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={pen && color === c}
            className={`sketch-swatch ${pen && color === c ? 'on' : ''}`}
            title={SKETCH_COLOR_LABELS[c]}
            aria-label={SKETCH_COLOR_LABELS[c]}
            // Eine Farbe wählen heißt zeichnen wollen
            onClick={() => setSketch({ sketchColor: c, sketchTool: 'pen' })}
          >
            <span style={{ background: COLORS.sketch[c] }} />
          </button>
        ))}
      </div>
      <span className="sketch-sep" aria-hidden="true" />
      <div className="sketch-widths" role="radiogroup" aria-label="Strichstärke">
        {SKETCH_WIDTHS.map((w, i) => (
          <button
            key={w}
            role="radio"
            aria-checked={width === w}
            className={`sketch-width ${width === w ? 'on' : ''}`}
            title={WIDTH_LABELS[i]}
            aria-label={`Strichstärke ${WIDTH_LABELS[i]}`}
            onClick={() => setSketch({ sketchWidth: w, sketchTool: 'pen' })}
          >
            <span style={{ width: 5 + i * 5, height: 5 + i * 5 }} />
          </button>
        ))}
      </div>
      <span className="sketch-sep" aria-hidden="true" />
      <ConfirmButton label="Skizze löschen" confirmLabel="Alle Striche löschen?" icon="trash" disabled={empty} onConfirm={() => usePlay.getState().clearSketch()} />
    </div>
  )
}
