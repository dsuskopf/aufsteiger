"""Erzeugt die Master-SVGs des Aufsteiger-Logos (Konzept D „Flugbahn“).

Aufruf: python build_logo.py <ausgabeordner>
Idee: Annahme, Zuspiel, Angriff – drei Punkte auf einer steigenden Wurfparabel, die mit jedem Kontakt wachsen.
Alles ist Geometrie: drei Kreise auf y = ya + k·(x − xa)², gleiche Abstände zwischen den Kreisrändern.
Der Schriftzug ist die Linienschrift aus build_konzepte.py (Pfade mit runden Enden, kein <text>).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_konzepte import word  # noqa: E402

INK = "#18181B"
BALL = "#E5484D"
INK_DARK = "#F4F4F5"


def dots(r1, r2, r3, x1=52.0, x3=184.0, y1=204.0, y3=64.0, xa=236.0, dx=0.0, dy=0.0):
    """Drei Kreise auf der Parabel durch (x1,y1) und (x3,y3) mit Scheitel bei x = xa.
    Der mittlere Kreis wird so gesetzt, dass beide Lücken (Rand zu Rand) gleich groß sind."""
    k = (y1 - y3) / ((x1 - xa) ** 2 - (x3 - xa) ** 2)
    ya = y3 - k * (x3 - xa) ** 2

    def y(x):
        return ya + k * (x - xa) ** 2

    def gaps(x2):
        y2 = y(x2)
        g1 = math.hypot(x2 - x1, y2 - y1) - r1 - r2
        g2 = math.hypot(x3 - x2, y3 - y2) - r2 - r3
        return g1 - g2

    lo, hi = x1, x3
    for _ in range(60):
        mid = (lo + hi) / 2
        if gaps(mid) > 0:
            hi = mid
        else:
            lo = mid
    x2 = (lo + hi) / 2
    pts = [(x1, y1, r1), (x2, y(x2), r2), (x3, y3, r3)]
    return [(x + dx, yy + dy, r) for x, yy, r in pts]


def symbol(pts, ink, ball):
    c = [ink, ink, ball]
    return "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{c[i]}"/>' for i, (x, y, r) in enumerate(pts))


# Normalfassung: Radien 16 · 25 · 42 (≈ 1 : 1,6 : 2,6); optisch leicht über der Mitte
PTS = dots(16, 25, 42, dx=-3, dy=4)
# Kleinversion (unter 48 px): größere Punkte, damit der kleinste bei 16 px nicht verschwindet
PTS_SMALL = dots(26, 34, 48, x1=40, x3=192, y1=212, y3=62, xa=244)


def svg(vb_w, vb_h, body, title="Aufsteiger"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w:.0f} {vb_h:.0f}" '
            f'width="{vb_w:.0f}" height="{vb_h:.0f}" role="img"><title>{title}</title>{body}</svg>\n')


WORD_H, WORD_W, TRACK = 76, 13, 6


def build(out):
    os.makedirs(out, exist_ok=True)

    def put(name, content):
        with open(os.path.join(out, name), "w", encoding="utf-8") as fh:
            fh.write(content)

    put("af-symbol.svg", svg(256, 256, symbol(PTS, INK, BALL)))
    put("af-symbol-dunkel.svg", svg(256, 256, symbol(PTS, INK_DARK, BALL)))
    put("af-symbol-schwarz.svg", svg(256, 256, symbol(PTS, INK, INK)))
    put("af-symbol-klein.svg", svg(256, 256, symbol(PTS_SMALL, INK, BALL)))
    put("af-symbol-klein-dunkel.svg", svg(256, 256, symbol(PTS_SMALL, INK_DARK, BALL)))

    for suffix, col in (("", INK), ("-dunkel", INK_DARK)):
        # Horizontal: Symbol links; Schriftzug-Oberkante auf Höhe der Ballmitte, Grundlinie auf Höhe des kleinen Punkts
        x_text = 256 + 20
        y_text = (256 - WORD_H) / 2
        wd, W = word("AUFSTEIGER", WORD_H, WORD_W, TRACK, x0=x_text, y0=y_text, color=col)
        put(f"af-horizontal{suffix}.svg", svg(x_text + W + 24, 256, symbol(PTS, col, BALL) + wd))

        # Gestapelt: Symbol oben mittig, Schriftzug darunter
        _, W = word("AUFSTEIGER", WORD_H, WORD_W, TRACK)
        CW = W + 64
        sym = f'<g transform="translate({(CW - 256) / 2:.1f} 0)">{symbol(PTS, col, BALL)}</g>'
        wd, _ = word("AUFSTEIGER", WORD_H, WORD_W, TRACK, x0=32, y0=262, color=col)
        put(f"af-gestapelt{suffix}.svg", svg(CW, 262 + WORD_H + 32, sym + wd))

    wd, W = word("AUFSTEIGER", WORD_H, WORD_W, TRACK, x0=16, y0=16, color=INK)
    put("af-schriftzug.svg", svg(W + 32, WORD_H + 32, wd))
    wd, W = word("AUFSTEIGER", WORD_H, WORD_W, TRACK, x0=16, y0=16, color=INK_DARK)
    put("af-schriftzug-dunkel.svg", svg(W + 32, WORD_H + 32, wd))

    # App-Icon: helle Punkte + roter Ball auf dunkler Kachel (wie die App-Oberfläche)
    tile = f'<rect width="256" height="256" rx="57.6" fill="{INK}"/>'
    put("af-app-icon.svg", svg(256, 256, tile + f'<g transform="translate(25.6 25.6) scale(0.8)">'
                                              f'{symbol(PTS_SMALL, INK_DARK, BALL)}</g>'))


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else ".")
    for p in PTS + PTS_SMALL:
        print(f"({p[0]:.1f}, {p[1]:.1f}) r={p[2]}")
