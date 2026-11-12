import { useMemo } from 'react'
import { Circle, Group, Line, Text } from 'react-konva'
import { worldToTop, type TopViewport } from '@renderer/core/geometry/transform'
import { zoneLayout } from '@renderer/core/geometry/zones'
import { useSettings } from '@renderer/store/appSettings'
import { useUi } from '@renderer/store/settingsStore'
import { COLORS } from '@renderer/theme/colors'

/**
 * Zonen auf dem Feldboden der Draufsicht (nur wenn eingeblendet).
 * Linien liegen fest im Feld; Zahlen und Buchstaben bleiben an ihrer Stelle, werden aber nie mitgedreht,
 * sodass sie in jeder Drehung (auch während der Drehanimation) aufrecht lesbar sind.
 */
export function ZoneMarks({ vp }: { vp: TopViewport }) {
  const show = useUi((s) => s.showZones)
  const style = useSettings((s) => s.settings.zoneStyle)
  const layout = useMemo(() => zoneLayout(style), [style])
  if (!show) return null

  const P = (x: number, y: number) => {
    const p = worldToTop(vp, x, y)
    return [p.px, p.py]
  }
  const lw = Math.max(1, 0.03 * vp.scale)

  return (
    <Group listening={false}>
      {layout.lines.map((l, i) => (
        <Line
          key={i}
          points={[...P(l.a.x, l.a.y), ...P(l.b.x, l.b.y)]}
          stroke={COLORS.line}
          strokeWidth={l.kind === 'zone' ? lw : Math.max(1, lw * 0.7)}
          opacity={l.kind === 'zone' ? 0.5 : 0.28}
          dash={l.kind === 'sub' ? [Math.max(3, 0.15 * vp.scale), Math.max(3, 0.12 * vp.scale)] : undefined}
        />
      ))}
      {layout.labels.map((l, i) => {
        const p = worldToTop(vp, l.x, l.y)
        const fs = Math.max(7, l.size * vp.scale)
        const box = fs * 2
        return (
          <Group key={i} x={p.px} y={p.py}>
            {l.disc && <Circle radius={fs * 0.62} fill={COLORS.courtFloor} stroke={COLORS.line} strokeWidth={Math.max(1, lw * 0.7)} opacity={0.95} />}
            <Text
              x={-box / 2}
              y={-box / 2}
              width={box}
              height={box}
              align="center"
              verticalAlign="middle"
              text={l.text}
              fontSize={fs}
              fontStyle={l.kind === 'zone' ? 'bold' : 'normal'}
              fill={l.kind === 'zone' ? COLORS.text : COLORS.textDim}
              opacity={l.kind === 'zone' ? 0.42 : 0.55}
            />
          </Group>
        )
      })}
    </Group>
  )
}
