import type { CSSProperties } from 'react'
import { teamTint, teamTintOnLight, textOn } from '@shared/teamColors'

/**
 * CSS-Variablen für alles, was ein Team direkt betrifft:
 * --team (Fläche), --team-on (Schrift auf der Fläche), --team-tint (lesbarer Akzent auf dem Grund des Erscheinungsbilds: hell bzw. dunkel),
 * --libero / --libero-on für alles, was den Libero betrifft.
 */
export function teamStyle(team: { color: string; liberoColor: string } | undefined | null): CSSProperties | undefined {
  if (!team) return undefined
  return {
    '--team': team.color,
    '--team-on': textOn(team.color),
    '--team-tint': `light-dark(${teamTintOnLight(team.color)}, ${teamTint(team.color)})`,
    '--libero': team.liberoColor,
    '--libero-on': textOn(team.liberoColor)
  } as CSSProperties
}
