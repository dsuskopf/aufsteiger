import { TRAJECTORY_LABELS } from '@shared/types'
import { solveAttack } from '@renderer/core/physics/attack'
import { DEFAULT_COLOR } from '@renderer/theme/defaultColor'
import { luminance } from '@shared/teamColors'
import { NET_PRESETS } from '@renderer/core/geometry/court'
import { usePlay } from '@renderer/store/playStore'
import { useTeams } from '@renderer/store/teamsStore'
import { useUi } from '@renderer/store/settingsStore'
import { visibleTrajectories } from '@renderer/store/selectors'
import { snapshotNet, snapshotsThree, snapshotTop } from './snapshots'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const m = (v: number) => `${v.toFixed(2).replace('.', ',')} m`

/**
 * Baut den PDF-Bericht als eigenständiges HTML (A4 quer):
 * Seite 1 Titel, Kürzel, Eckdaten, Draufsicht und Netzansicht; Seite 2 vier 3D-Ansichten und die Flugbahn-Werte.
 */
export async function buildReport(code: string, title: string): Promise<string> {
  const top = await snapshotTop()
  const net = await snapshotNet()
  const three = snapshotsThree()
  const play = usePlay.getState()
  const ui = useUi.getState()
  const teams = useTeams.getState().teams
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? '—'
  const preset = ui.netPreset === 'custom' ? 'Frei' : NET_PRESETS[ui.netPreset].label
  const list = visibleTrajectories(play.trajectories, play.display)
  const date = new Date().toLocaleDateString('de-DE', { dateStyle: 'long' })

  const rows = list
    .map(({ type, input, sol }) => {
      const speed = Math.round(Math.hypot(sol.vH, sol.vZ0) * 3.6)
      return `<tr><td><b>${TRAJECTORY_LABELS[type]}</b></td><td>${m(input.start.h)}</td><td>${m(sol.apexH)}</td><td>${m(input.hitH)}</td><td>${m(sol.D)}</td><td>${sol.tHit.toFixed(2).replace('.', ',')} s</td><td>${speed} km/h</td></tr>`
    })
    .join('')
    + (play.schlag
      ? (() => {
          const s = solveAttack(play.schlag)
          const d = Math.hypot(s.landing.x - play.schlag.start.x, s.landing.y - play.schlag.start.y)
          return `<tr><td><b>Schlag</b></td><td>${m(play.schlag.start.h)}</td><td>${m(s.apexH)}</td><td>${m(play.schlag.endH)}</td><td>${m(d)}</td><td>${s.tHit.toFixed(2).replace('.', ',')} s</td><td>${Math.round(play.schlag.speed * 3.6)} km/h</td></tr>`
        })()
      : '')

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(code)}</title><style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 10pt/1.4 'Segoe UI', system-ui, sans-serif; color: #1b1b1f; }
  .page { page-break-after: always; height: 188mm; display: flex; flex-direction: column; gap: 4mm; }
  .page:last-child { page-break-after: auto; }
  header { display: flex; align-items: baseline; gap: 6mm; border-bottom: 1.5pt solid ${luminance(DEFAULT_COLOR) > 0.7 ? "#9a9aa2" : DEFAULT_COLOR}; padding-bottom: 2mm; }
  .code { font-size: 20pt; font-weight: 700; }
  h1 { flex: 1; margin: 0; font-size: 15pt; font-weight: 600; }
  .meta { color: #66666e; font-size: 9pt; text-align: right; }
  .facts { display: flex; gap: 8mm; color: #3a3a40; font-size: 9pt; }
  .facts b { color: #1b1b1f; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 1mm; min-height: 0; }
  figcaption { font-size: 8.5pt; font-weight: 600; color: #66666e; text-transform: uppercase; letter-spacing: 0.04em; }
  .img { flex: 1; min-height: 0; border-radius: 3mm; background: #0c0c0e; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .img img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
  .row { flex: 1; display: grid; grid-template-columns: 1.15fr 1fr; gap: 4mm; min-height: 0; }
  .grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 3mm; min-height: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th, td { text-align: left; padding: 1.2mm 2mm; border-bottom: 0.5pt solid #d8d8de; }
  th { color: #66666e; font-weight: 600; }
  .empty { color: #66666e; }
  </style></head><body>
  <section class="page">
    <header><span class="code">${esc(code)}</span><h1>${esc(title)}</h1><span class="meta">Volleyball Playbook<br>${date}</span></header>
    <div class="facts">
      <span>Seite A: <b>${esc(teamName(play.sides.A.teamId))}</b></span>
      <span>Seite B: <b>${esc(teamName(play.sides.B.teamId))}</b></span>
      <span>Netzhöhe: <b>${preset} · ${m(ui.netHeight)}</b></span>
    </div>
    <div class="row">
      <figure><figcaption>Draufsicht</figcaption><div class="img"><img src="${top}"></div></figure>
      <figure><figcaption>Netzansicht · Blick von ${ui.netViewFrom}${ui.netAngle ? ` · ${ui.netAngle}°` : ''}</figcaption><div class="img"><img src="${net}"></div></figure>
    </div>
    ${
      rows
        ? `<table><thead><tr><th>Flugbahn</th><th>Start (Annahme/Zuspiel)</th><th>Höchster Punkt</th><th>Ende (Zuspiel/Schlagpunkt)</th><th>Distanz</th><th>Flugzeit</th><th>Abflug</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="empty">Keine Flugbahnen eingezeichnet.</p>'
    }
  </section>
  <section class="page">
    <header><span class="code">${esc(code)}</span><h1>3D-Ansichten</h1></header>
    <div class="grid">
      ${three.map((t) => `<figure><figcaption>${esc(t.label)}</figcaption><div class="img"><img src="${t.url}"></div></figure>`).join('')}
    </div>
  </section>
  </body></html>`
}
