"""Erzeugt die Master-SVGs des Volleyball-Playbook-Logos (V-Ball).

Aufruf: python build_logo.py <ausgabeordner>
Alles ist Geometrie: Symbol aus einem V (60°-Schenkel) und einem Ball, Schriftzug als eigene
Linienschrift mit runden Enden (keine Schriftdatei, kein <text>).
"""
import math
import os
import sys

INK = "#18181B"
BALL = "#E5484D"
INK_DARK = "#F4F4F5"

S60 = math.sin(math.radians(60))
C60 = math.cos(math.radians(60))


# ---------------------------------------------------------------- Symbol
def symbol_parts(stroke=36, ball_r=30, gap=10, length=162, dx=-6, dy=0):
    """V mit Spitze bei (128,200); linker Schenkel 140 hoch, rechter Schenkel endet im Ball."""
    bx, by = 128 + dx, 200 + dy
    left = (bx - 140 / math.tan(math.radians(60)), by - 140)
    ball = (bx + C60 * length, by - S60 * length)
    end_d = length - ball_r - gap - stroke / 2
    end = (bx + C60 * end_d, by - S60 * end_d)
    v = (f'<path d="M{left[0]:.1f} {left[1]:.1f} L{bx:.1f} {by:.1f} L{end[0]:.1f} {end[1]:.1f}" '
         f'fill="none" stroke="{{v}}" stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round"/>')
    b = f'<circle cx="{ball[0]:.1f}" cy="{ball[1]:.1f}" r="{ball_r}" fill="{{b}}"/>'
    return v + b


SYMBOL = symbol_parts()
# Kleine Größen (16–32 px): kräftiger Strich, größerer Ball, breitere Lücke
SYMBOL_SMALL = symbol_parts(stroke=46, ball_r=36, gap=16, length=160, dx=-8, dy=4)


# ---------------------------------------------------------------- Linienschrift
def glyph(ch, H, w):
    """Mittellinien-Pfad einer Versalie; Box 0..H in der Höhe (inkl. Strichstärke).
    Gibt (pfad, breite_der_mittellinie, seitenabstand_links, seitenabstand_rechts) zurück."""
    t, b = w / 2, H - w / 2          # obere / untere Mittellinie
    m = (t + b) / 2
    h = b - t
    if ch == "V":
        W = 0.86 * h
        return f"M0 {t} L{W/2} {b} L{W} {t}", W, 0.0, 0.0
    if ch == "A":
        W = 0.86 * h
        cy = t + 0.70 * h
        return f"M0 {b} L{W/2} {t} L{W} {b} M{W*0.17:.2f} {cy:.2f} H{W*0.83:.2f}", W, 0.0, 0.0
    if ch == "Y":
        W = 0.84 * h
        return f"M0 {t} L{W/2} {m} L{W} {t} M{W/2} {m} V{b}", W, 0.0, 0.0
    if ch == "O":
        r = h / 2
        return f"M0 {m} A{r} {r} 0 1 1 {2*r} {m} A{r} {r} 0 1 1 0 {m} Z", 2 * r, -0.04 * H, -0.04 * H
    if ch == "L":
        W = 0.5 * h
        return f"M0 {t} V{b} H{W}", W, 0.06 * H, -0.07 * H
    if ch == "E":
        W = 0.5 * h
        return f"M{W} {t} H0 V{b} H{W} M0 {m} H{W*0.86:.2f}", W, 0.06 * H, 0.0
    if ch == "P":
        r = (m - t) / 2 + 0.02 * h
        y2 = t + 2 * r
        s = 0.18 * h
        return f"M0 {b} V{t} H{s} A{r} {r} 0 0 1 {s} {y2} H0", s + r, 0.06 * H, 0.0
    if ch == "B":
        r1 = (m - t) / 2
        r2 = (b - m) / 2
        s1, s2 = 0.16 * h, 0.2 * h
        return (f"M0 {m} V{t} H{s1} A{r1} {r1} 0 0 1 {s1} {m} H0 M{s1} {m} H{s2} "
                f"A{r2} {r2} 0 0 1 {s2} {b} H0 V{m}"), s2 + r2, 0.06 * H, 0.0
    if ch == "K":
        W = 0.6 * h
        j = t + W
        return f"M0 {t} V{b} M{W} {t} L0 {j} M{W*0.33:.2f} {t + 0.42*h:.2f} L{W} {b}", W, 0.06 * H, 0.0
    if ch == " ":
        return "", 0.32 * H, 0.0, 0.0
    raise ValueError(ch)


def word(text, H, w, tracking, x0=0.0, y0=0.0, color="{v}"):
    """Setzt einen Schriftzug; gibt (svg, breite) zurück."""
    x = x0 + w / 2
    paths = []
    for i, ch in enumerate(text):
        d, W, lsb, rsb = glyph(ch, H, w)
        x += lsb
        if d:
            paths.append(f'<path transform="translate({x:.2f} {y0:.2f})" d="{d}"/>')
        x += W + rsb
        if i < len(text) - 1:
            x += w + tracking
    width = x + w / 2 - x0
    g = (f'<g fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" '
         f'stroke-linejoin="round">{"".join(paths)}</g>')
    return g, width


# ---------------------------------------------------------------- Lockups
def svg(vb_w, vb_h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w:.0f} {vb_h:.0f}" '
            f'width="{vb_w:.0f}" height="{vb_h:.0f}" role="img"><title>{title}</title>{body}</svg>\n')


def wordmark_block(x0, y0, color):
    """Zweizeilig: VOLLEYBALL (klein, gesperrt) über PLAYBOOK (groß)."""
    big_H, big_w = 92, 15
    small_H, small_w = 28, 6
    big, big_W = word("PLAYBOOK", big_H, big_w, 10, x0, y0 + small_H + 18, color)
    # VOLLEYBALL auf die Breite von PLAYBOOK sperren
    _, raw = word("VOLLEYBALL", small_H, small_w, 0)
    track = (big_W - raw) / 9
    small, _ = word("VOLLEYBALL", small_H, small_w, track, x0, y0, color)
    return small + big, big_W, small_H + 18 + big_H


def build(out):
    os.makedirs(out, exist_ok=True)
    T = "Volleyball Playbook"

    def put(name, content):
        with open(os.path.join(out, name), "w", encoding="utf-8") as fh:
            fh.write(content)

    # Symbol
    put("vp-symbol.svg", svg(256, 256, SYMBOL.format(v=INK, b=BALL), T))
    put("vp-symbol-dunkel.svg", svg(256, 256, SYMBOL.format(v=INK_DARK, b=BALL), T))
    put("vp-symbol-klein.svg", svg(256, 256, SYMBOL_SMALL.format(v=INK, b=BALL), T))
    put("vp-symbol-schwarz.svg", svg(256, 256, SYMBOL.format(v=INK, b=INK), T))

    # Horizontal: Symbol (256) + Abstand + Schriftzug, vertikal mittig
    for suffix, vcol in (("", INK), ("-dunkel", INK_DARK)):
        block, bw, bh = wordmark_block(0, 0, vcol)
        gap = 46
        x_text = 256 - 22 + gap          # Symbol hat rechts ~17 Einheiten Luft
        y_text = (256 - bh) / 2 + 4
        block, bw, bh = wordmark_block(x_text, y_text, vcol)
        body = SYMBOL.format(v=vcol, b=BALL) + block
        put(f"vp-horizontal{suffix}.svg", svg(x_text + bw + 16, 256, body, T))

        # Gestapelt: Symbol oben, Schriftzug darunter mittig
        block, bw, bh = wordmark_block(0, 0, vcol)
        W = max(bw + 48, 300)
        sym = f'<g transform="translate({(W - 256) / 2 + 6:.1f} 0)">{SYMBOL.format(v=vcol, b=BALL)}</g>'
        block, _, _ = wordmark_block((W - bw) / 2, 250, vcol)
        put(f"vp-gestapelt{suffix}.svg", svg(W, 250 + bh + 32, sym + block, T))

    # Nur Schriftzug
    block, bw, bh = wordmark_block(16, 16, INK)
    put("vp-schriftzug.svg", svg(bw + 32, bh + 32, block, T))


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
