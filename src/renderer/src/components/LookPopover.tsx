import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Player, Team } from '@shared/types'
import {
  BODY_LABELS,
  HAIR_COLORS,
  HAIR_COLOR_NAMES,
  HAIR_STYLES,
  SKIN_TONES,
  resolveLook,
  type Body,
  type Look,
  type ResolvedLook
} from '@shared/looks'
import { useTeams } from '@renderer/store/teamsStore'
import { Icon } from './Icon'

/** Kleiner Kopf als Vorschau: Hautton, Frisur und Haarfarbe, Schultern im Trikot */
export function Avatar({ look, jersey, size = 32 }: { look: ResolvedLook; jersey: string; size?: number }) {
  const h = look.hairColor
  const hair: Record<string, React.ReactNode> = {
    kurz: <path d="M9 13c0-5 3-8 7-8s7 3 7 8c-1-2-3-3.5-7-3.5S10 11 9 13z" fill={h} />,
    raspel: <path d="M9.5 12.5c.5-4.5 3-7 6.5-7s6 2.5 6.5 7c-1.5-1.5-3.5-2.5-6.5-2.5s-5 1-6.5 2.5z" fill={h} opacity={0.85} />,
    locken: (
      <g fill={h}>
        <circle cx="11" cy="9" r="3" />
        <circle cx="16" cy="6.5" r="3.2" />
        <circle cx="21" cy="9" r="3" />
        <circle cx="9.5" cy="13" r="2.2" />
        <circle cx="22.5" cy="13" r="2.2" />
      </g>
    ),
    glatze: null,
    zopf: (
      <g fill={h}>
        <path d="M9 14c0-6 3-9 7-9s7 3 7 9c-1-3-3-4.5-7-4.5S10 11 9 14z" />
        <path d="M22 9c3 1 4 5 3 10l-2-.5c.5-3 0-6-2-7.5z" />
      </g>
    ),
    dutt: (
      <g fill={h}>
        <circle cx="16" cy="4.5" r="3" />
        <path d="M9 14c0-6 3-9 7-9s7 3 7 9c-1-3-3-4.5-7-4.5S10 11 9 14z" />
      </g>
    ),
    bob: <path d="M8 18c-1-8 3-13 8-13s9 5 8 13l-2.5-.5c.5-4-1-7.5-5.5-7.5s-6 3.5-5.5 7.5z" fill={h} />,
    zoepfe: (
      <g fill={h}>
        <path d="M9 14c0-6 3-9 7-9s7 3 7 9c-1-3-3-4.5-7-4.5S10 11 9 14z" />
        <rect x="7.5" y="13" width="2.5" height="8" rx="1.2" />
        <rect x="22" y="13" width="2.5" height="8" rx="1.2" />
      </g>
    )
  }
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d={look.body === 'f' ? 'M7 32c0-6 4-9 9-9s9 3 9 9z' : 'M5 32c0-6 5-9.5 11-9.5S27 26 27 32z'} fill={jersey} />
      <rect x="14" y="18" width="4" height="6" fill={look.skin} />
      <circle cx="16" cy="13" r="7" fill={look.skin} />
      {hair[look.hair]}
    </svg>
  )
}

const rnd = (n: number) => Math.floor(Math.random() * n)

/**
 * Pop-up am Spieler in der Teamverwaltung: Körperbau, Hautton, Frisur und Haarfarbe der 3D-Figur.
 * Nicht Festgelegtes bleibt automatisch (fest-zufällig, Körperbau nach Team).
 */
export function LookPopover({ team, player, anchor, onClose }: { team: Team; player: Player; anchor: HTMLElement | null; onClose: () => void }) {
  const setPlayerLook = useTeams((s) => s.setPlayerLook)
  const ref = useRef<HTMLDivElement>(null)
  // Fest im Fenster neben dem Gesicht – passt immer ganz hinein (die Liste darunter scrollt)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const a = anchor?.getBoundingClientRect()
    const el = ref.current
    if (!a || !el) return
    const h = el.offsetHeight
    const w = el.offsetWidth
    const top = Math.max(12, Math.min(window.innerHeight - h - 12, a.top - 8))
    const left = Math.max(12, Math.min(window.innerWidth - w - 12, a.right + 10))
    setPos({ left, top })
  }, [anchor])
  const look: Look = player.look ?? {}
  const resolved = resolveLook(team.gender, player.id, player.look)
  const set = (patch: Partial<Look>) => {
    const next: Look = { ...look, ...patch }
    for (const k of Object.keys(next) as (keyof Look)[]) if (next[k] === undefined) delete next[k]
    // Andere Frisuren gehören zum anderen Körperbau
    if (patch.body && next.hair && !HAIR_STYLES[patch.body].some((s) => s.id === next.hair)) delete next.hair
    setPlayerLook(team.id, player.id, next)
  }

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (!ref.current?.contains(t) && !t.closest('[data-look-trigger]')) onClose()
    }
    // Esc schließt nur das Pop-up, nicht die ganze Teamverwaltung
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  const bodies: (Body | undefined)[] = [undefined, 'm', 'f']
  return (
    <div
      className="color-popover look-popover"
      ref={ref}
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      role="dialog" aria-label={`Aussehen von ${player.name || 'Spieler ' + player.number}`}>
      <div className="row">
        <Avatar look={resolved} jersey={team.color} size={48} />
        <span className="grow look-title">
          #{player.number} {player.name}
          <span className="caption block">{player.look ? 'Eigenes Aussehen' : 'Automatisch (zufällig)'}</span>
        </span>
      </div>
      <div className="look-group">
        <span className="section-title">Körperbau</span>
        <div className="segmented small fill" role="radiogroup" aria-label="Körperbau">
          {bodies.map((b) => (
            <button key={b ?? 'team'} role="radio" aria-checked={look.body === b} className={look.body === b ? 'selected' : ''} onClick={() => set({ body: b })}>
              {b ? BODY_LABELS[b] : 'Wie Team'}
            </button>
          ))}
        </div>
      </div>
      <div className="look-group">
        <span className="section-title">Hautton</span>
        <div className="look-swatches" role="radiogroup" aria-label="Hautton">
          {SKIN_TONES.map((c, i) => (
            <button key={c} role="radio" aria-checked={resolved.skin === c} aria-label={`Hautton ${i + 1}`} className={`swatch ${resolved.skin === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => set({ skin: i })} />
          ))}
        </div>
      </div>
      <div className="look-group">
        <span className="section-title">Frisur</span>
        <div className="chips" role="radiogroup" aria-label="Frisur">
          {HAIR_STYLES[resolved.body].map((s) => (
            <button key={s.id} role="radio" aria-checked={resolved.hair === s.id} className={`chip ${resolved.hair === s.id ? 'selected' : ''}`} onClick={() => set({ hair: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="look-group">
        <span className="section-title">Haarfarbe</span>
        <div className="look-swatches" role="radiogroup" aria-label="Haarfarbe">
          {HAIR_COLORS.map((c, i) => (
            <button key={c} role="radio" aria-checked={resolved.hairColor === c} aria-label={HAIR_COLOR_NAMES[i]} title={HAIR_COLOR_NAMES[i]} className={`swatch ${resolved.hairColor === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => set({ hairColor: i })} />
          ))}
        </div>
      </div>
      <div className="row">
        <button
          className="small grow"
          title="Neues zufälliges Aussehen (Körperbau bleibt)"
          onClick={() => {
            const body = resolved.body
            const styles = HAIR_STYLES[body]
            set({ skin: rnd(SKIN_TONES.length), hair: styles[rnd(styles.length)].id, hairColor: rnd(HAIR_COLORS.length - 1) })
          }}
        >
          <Icon name="loop" size={16} />
          Neu würfeln
        </button>
        <button className="small plain" disabled={!player.look} title="Eigene Angaben verwerfen" onClick={() => setPlayerLook(team.id, player.id, null)}>
          Automatisch
        </button>
      </div>
    </div>
  )
}
