/**
 * Gleitende Auswahl in Umschaltern (.segmented, z. B. 2D/3D, Werkzeuge, Läufer, Annahme/Aufschlag):
 * Die Hervorhebung ist ein eigenes Element („Thumb“) unter den Buttons. Wechselt die Auswahl, gleitet sie mit
 * weicher Kurve zum neuen Button und wird dabei kurz etwas gestaucht/gedehnt (ca. 10 %, „squishy“).
 *
 * Arbeitet direkt auf dem DOM: ein MutationObserver bemerkt neue Umschalter und Klassenwechsel (.selected),
 * ein ResizeObserver hält die Lage bei Größenänderungen aktuell. Ohne Animation bei „Bewegung reduzieren“.
 */

const DURATION = 340
/** Weiche Spline-Kurve: zügig los, sanft auslaufen */
const EASING = 'cubic-bezier(0.45, 0, 0.15, 1)'
const SQUISH = 0.1

interface State {
  thumb: HTMLDivElement
  sel: HTMLElement | null
  ro: ResizeObserver
}

const states = new WeakMap<HTMLElement, State>()
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function rectOf(btn: HTMLElement) {
  return { left: btn.offsetLeft, top: btn.offsetTop, width: btn.offsetWidth, height: btn.offsetHeight }
}

function place(thumb: HTMLDivElement, r: { left: number; top: number; width: number; height: number }) {
  thumb.style.left = `${r.left}px`
  thumb.style.top = `${r.top}px`
  thumb.style.width = `${r.width}px`
  thumb.style.height = `${r.height}px`
}

function update(seg: HTMLElement, animate: boolean) {
  let st = states.get(seg)
  if (!st) {
    const thumb = document.createElement('div')
    thumb.className = 'seg-thumb'
    thumb.setAttribute('aria-hidden', 'true')
    seg.prepend(thumb)
    seg.classList.add('has-thumb')
    const ro = new ResizeObserver(() => update(seg, false))
    ro.observe(seg)
    st = { thumb, sel: null, ro }
    states.set(seg, st)
    animate = false
  }
  const sel = seg.querySelector<HTMLElement>(':scope > button.selected')
  const { thumb } = st
  if (!sel) {
    thumb.style.opacity = '0'
    st.sel = null
    return
  }
  const to = rectOf(sel)
  const prev = st.sel && st.sel.isConnected && st.sel !== sel ? rectOf(st.sel) : null
  const wasHidden = thumb.style.opacity === '0'
  place(thumb, to)
  thumb.style.opacity = '1'
  st.sel = sel
  if (!animate || reduceMotion() || to.width === 0) return
  if (prev) {
    // FLIP: vom alten Button zum neuen, in der Mitte 10 % länger und 10 % flacher
    const dx = prev.left - to.left
    const r = prev.width / to.width
    thumb.animate(
      [
        { transform: `translateX(${dx}px) scaleX(${r})` },
        { transform: `translateX(${dx / 2}px) scaleX(${((r + 1) / 2) * (1 + SQUISH)}) scaleY(${1 - SQUISH})`, offset: 0.5 },
        { transform: 'translateX(0) scaleX(1) scaleY(1)' }
      ],
      { duration: DURATION, easing: EASING }
    )
  } else if (wasHidden) {
    thumb.animate(
      [
        { transform: `scale(${1 - SQUISH})`, opacity: 0 },
        { transform: 'scale(1)', opacity: 1 }
      ],
      { duration: DURATION * 0.7, easing: EASING }
    )
  }
}

function scan(root: ParentNode, animate: boolean) {
  root.querySelectorAll<HTMLElement>('.segmented').forEach((seg) => update(seg, animate))
}

export function installSegmentedThumbs(): void {
  scan(document, false)
  const mo = new MutationObserver((records) => {
    const touched = new Set<HTMLElement>()
    let added = false
    for (const r of records) {
      if (r.type === 'attributes') {
        const seg = (r.target as HTMLElement).closest?.('.segmented') as HTMLElement | null
        if (seg) touched.add(seg)
      } else if (r.addedNodes.length) added = true
      else if (r.removedNodes.length) {
        const seg = (r.target as HTMLElement).closest?.('.segmented') as HTMLElement | null
        if (seg) touched.add(seg)
      }
    }
    if (added) scan(document, true)
    touched.forEach((seg) => update(seg, true))
  })
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
}
