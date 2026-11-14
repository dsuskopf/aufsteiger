import type { BallEvent } from '@renderer/core/physics/rally'

/**
 * Geräusche der Ballkontakte – ohne Sounddateien, direkt erzeugt (Web Audio):
 * kurzer Rauschimpuls (das „Klatschen“ auf Leder) plus ein tiefer, abfallender Ton (der „Bums“ des Balls),
 * je Kontaktart anders abgestimmt. Ein leiser Nachhall lässt es nach Halle klingen.
 */

let ctx: AudioContext | null = null
let out: GainNode | null = null
let noise: AudioBuffer | null = null

function setup(): AudioContext | null {
  if (ctx) return ctx
  try {
    ctx = new AudioContext()
  } catch {
    return null
  }
  out = ctx.createGain()
  out.connect(ctx.destination)
  // Hall: zwei kurze, gedämpfte Echos
  for (const [time, gain] of [
    [0.09, 0.2],
    [0.21, 0.11]
  ]) {
    const delay = ctx.createDelay(0.5)
    delay.delayTime.value = time
    const damp = ctx.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = 1400
    const g = ctx.createGain()
    g.gain.value = gain
    out.connect(delay).connect(damp).connect(g).connect(ctx.destination)
  }
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

interface Voice {
  /** Tiefer Ton: Start- und Endfrequenz (Hz), Dauer (s), Lautstärke */
  thump?: [number, number, number, number]
  /** Rauschen: Filter (Hz), Güte, Dauer (s), Lautstärke, Art */
  slap?: [number, number, number, number, BiquadFilterType]
}

function voice(kind: BallEvent['kind'], hard: number): Voice {
  switch (kind) {
    case 'annahme':
      // Bagger: dumpf auf den Unterarmen
      return { thump: [190, 95, 0.11, 0.55], slap: [900, 0.8, 0.05, 0.25, 'lowpass'] }
    case 'zuspiel':
      // Pritschen: weich und kurz
      return { thump: [320, 210, 0.05, 0.16], slap: [1800, 1, 0.03, 0.1, 'bandpass'] }
    case 'schlag':
      return { thump: [240 - 60 * hard, 80, 0.12, 0.5 + 0.5 * hard], slap: [2600 + 1800 * hard, 0.7, 0.06, 0.5 + 0.7 * hard, 'bandpass'] }
    case 'block':
      return { thump: [170, 70, 0.14, 0.6 + 0.4 * hard], slap: [1500, 0.9, 0.07, 0.5 + 0.4 * hard, 'bandpass'] }
    case 'boden':
      return { thump: [150 - 40 * hard, 52, 0.2, 0.35 + 0.75 * hard], slap: [700, 0.7, 0.05, 0.12 + 0.3 * hard, 'lowpass'] }
    case 'netz':
      // Netz: langes, weiches Rauschen
      return { slap: [2400, 0.6, 0.28, 0.2 + 0.5 * hard, 'bandpass'] }
    case 'netzkante':
      return { thump: [260, 180, 0.05, 0.2], slap: [3000, 1.2, 0.09, 0.22, 'bandpass'] }
    case 'antenne':
      // Antenne: hell und federnd (Glasfaserstab)
      return { thump: [1250, 820, 0.12, 0.35], slap: [4200, 2, 0.06, 0.25, 'bandpass'] }
  }
}

/**
 * Spielt das Geräusch eines Ballkontakts. hard = Härte 0–1, volume = Lautstärke 0–1,
 * rate = Abspieltempo (in Zeitlupe klingt es tiefer und länger).
 */
export function playSfx(kind: BallEvent['kind'], hard: number, volume: number, rate = 1): void {
  if (volume <= 0) return
  const ac = setup()
  if (!ac || !out || !noise) return
  if (ac.state === 'suspended') void ac.resume().catch(() => {})
  const v = voice(kind, Math.min(1, Math.max(0, hard)))
  const stretch = 1 / Math.min(2, Math.max(0.5, Math.sqrt(rate)))
  const pitch = Math.min(1.3, Math.max(0.7, Math.sqrt(rate)))
  const now = ac.currentTime + 0.005
  if (v.thump) {
    const [f0, f1, dur, gain] = v.thump
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f0 * pitch, now)
    osc.frequency.exponentialRampToValueAtTime(f1 * pitch, now + dur * stretch)
    const g = ac.createGain()
    g.gain.setValueAtTime(gain * volume, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + dur * stretch * 1.3)
    osc.connect(g).connect(out)
    osc.start(now)
    osc.stop(now + dur * stretch * 1.4)
  }
  if (v.slap) {
    const [freq, q, dur, gain, type] = v.slap
    const src = ac.createBufferSource()
    src.buffer = noise
    src.playbackRate.value = pitch
    const filter = ac.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq * pitch
    filter.Q.value = q
    const g = ac.createGain()
    g.gain.setValueAtTime(gain * volume, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + dur * stretch)
    src.connect(filter).connect(g).connect(out)
    src.start(now, Math.random() * 0.2)
    src.stop(now + dur * stretch + 0.02)
  }
}
