import { Group, Rect, Text } from 'react-konva'
import { COLORS } from '@renderer/theme/colors'

/**
 * Läufer-Abzeichen am Bezugs-Steller: kleines Schild „L2“ (Läufer = Position des Stellers), mittig bei (x, y).
 * Steht der Libero für den Steller, ist das Schild nur umrandet.
 */
export function LaeuferBadge({ x, y, n, standIn, h = 16 }: { x: number; y: number; n: number; standIn: boolean; h?: number }) {
  const w = h * 1.7
  return (
    <Group x={x} y={y} listening={false}>
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        cornerRadius={h / 2}
        fill={standIn ? COLORS.bgDeep : COLORS.accent}
        stroke={COLORS.accent}
        strokeWidth={1.5}
        shadowColor="#000"
        shadowBlur={4}
        shadowOpacity={0.6}
      />
      <Text
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        align="center"
        verticalAlign="middle"
        text={`L${n}`}
        fontSize={h * 0.68}
        fontStyle="bold"
        fill={standIn ? COLORS.accent : COLORS.bgDeep}
      />
    </Group>
  )
}
