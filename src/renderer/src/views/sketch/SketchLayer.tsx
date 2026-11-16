import { memo } from 'react'
import { Circle, Layer, Line } from 'react-konva'
import type { SketchStroke } from '@shared/types'
import { worldToTop, type TopViewport } from '@renderer/core/geometry/transform'
import { COLORS } from '@renderer/theme/colors'
import { ERASER_PX, type LiveSketch } from './useSketchInput'

/** Ein Strich; ein einzelner Tipp wird ein Punkt */
function Stroke({ stroke, vp, smooth }: { stroke: SketchStroke; vp: TopViewport; smooth: boolean }) {
  const color = COLORS.sketch[stroke.color]
  const width = Math.max(1.5, stroke.width * vp.scale)
  const px: number[] = []
  for (let i = 0; i + 1 < stroke.points.length; i += 2) {
    const p = worldToTop(vp, stroke.points[i], stroke.points[i + 1])
    px.push(p.px, p.py)
  }
  if (px.length === 2) return <Circle x={px[0]} y={px[1]} radius={width / 2} fill={color} />
  return <Line points={px} stroke={color} strokeWidth={width} lineCap="round" lineJoin="round" tension={smooth ? 0.3 : 0} />
}

const sameVp = (a: TopViewport, b: TopViewport) => a.scale === b.scale && a.originX === b.originX && a.originY === b.originY && a.angle === b.angle

/** Die fertigen Striche: eigene Ebene, die beim Zeichnen eines neuen Strichs nicht neu gezeichnet wird */
export const SketchLayer = memo(
  function SketchLayer({ sketch, vp, smooth = true }: { sketch: SketchStroke[]; vp: TopViewport; smooth?: boolean }) {
    return (
      <Layer listening={false}>
        {sketch.map((s, i) => (
          <Stroke key={i} stroke={s} vp={vp} smooth={smooth} />
        ))}
      </Layer>
    )
  },
  (a, b) => a.sketch === b.sketch && a.smooth === b.smooth && sameVp(a.vp, b.vp)
)

/** Der Strich unter dem Stift und der Kreis des Radierers */
export function LiveSketchLayer({ live, vp, smooth = true }: { live: LiveSketch; vp: TopViewport; smooth?: boolean }) {
  const e = live.eraser ? worldToTop(vp, live.eraser.x, live.eraser.y) : null
  return (
    <Layer listening={false}>
      {live.stroke && <Stroke stroke={live.stroke} vp={vp} smooth={smooth} />}
      {e && <Circle x={e.px} y={e.py} radius={ERASER_PX} stroke={COLORS.text} strokeWidth={1.5} dash={[4, 3]} />}
    </Layer>
  )
}
