"""Erzeugt die 10 Logo-Konzepte für „Aufsteiger“ (Symbol + horizontales Logo je Konzept).

Aufruf: python build_konzepte.py <ausgabeordner> [--farbe]
Alles ist Geometrie (Kreise, Polygone, Striche mit runden Enden), kein <text>.
Ohne --farbe: alles schwarz (erste Runde). Mit --farbe: Ball im App-Rot.
"""
import math
import os
import sys

INK = "#18181B"
RED = "#E5484D"


# ---------------------------------------------------------------- Linienschrift (Versalien)
def glyph(ch, H, w):
    t, b = w / 2, H - w / 2
    m = (t + b) / 2
    h = b - t
    if ch == "A":
        W = 0.86 * h
        cy = t + 0.70 * h
        return f"M0 {b} L{W/2} {t} L{W} {b} M{W*0.17:.2f} {cy:.2f} H{W*0.83:.2f}", W, 0.0, 0.0
    if ch == "U":
        W = 0.62 * h
        r = W / 2
        return f"M0 {t} V{b-r:.2f} A{r:.2f} {r:.2f} 0 0 0 {W:.2f} {b-r:.2f} V{t}", W, 0.05 * H, 0.05 * H
    if ch == "F":
        W = 0.5 * h
        return f"M{W} {t} H0 V{b} M0 {m} H{W*0.86:.2f}", W, 0.06 * H, 0.0
    if ch == "E":
        W = 0.5 * h
        return f"M{W} {t} H0 V{b} H{W} M0 {m} H{W*0.86:.2f}", W, 0.06 * H, 0.0
    if ch == "T":
        W = 0.62 * h
        return f"M0 {t} H{W} M{W/2} {t} V{b}", W, -0.03 * H, -0.03 * H
    if ch == "I":
        return f"M0 {t} V{b}", 0.0, 0.06 * H, 0.06 * H
    if ch == "S":
        r1 = (m - t) / 2
        r2 = (b - m) / 2
        r = 0.27 * h
        a = math.radians(32)
        x1, y1 = r + r * math.cos(a), t + r1 - r1 * math.sin(a)
        x2, y2 = r - r * math.cos(a), m + r2 + r2 * math.sin(a)
        return (f"M{x1:.2f} {y1:.2f} A{r:.2f} {r1:.2f} 0 1 0 {r:.2f} {m:.2f} "
                f"A{r:.2f} {r2:.2f} 0 1 1 {x2:.2f} {y2:.2f}"), 2 * r, 0.0, 0.0
    if ch == "G":
        r = h / 2
        a = math.radians(-42)
        x1, y1 = r + r * math.cos(a), m + r * math.sin(a)
        return (f"M{x1:.2f} {y1:.2f} A{r:.2f} {r:.2f} 0 1 0 {2*r:.2f} {m:.2f} H{r*1.12:.2f}"), 2 * r, -0.03 * H, -0.03 * H
    if ch == "R":
        r = (m - t) / 2 + 0.02 * h
        y2 = t + 2 * r
        s = 0.18 * h
        return f"M0 {b} V{t} H{s:.2f} A{r:.2f} {r:.2f} 0 0 1 {s:.2f} {y2:.2f} H0 M{s:.2f} {y2:.2f} L{s+r:.2f} {b}", s + r, 0.06 * H, 0.0
    if ch == " ":
        return "", 0.32 * H, 0.0, 0.0
    raise ValueError(ch)


def word(text, H, w, tracking, x0=0.0, y0=0.0, color=INK, raise_from=None, step=0.0):
    """Setzt einen Schriftzug; ab Index raise_from stehen die Buchstaben um step höher."""
    x = x0 + w / 2
    paths = []
    for i, ch in enumerate(text):
        d, W, lsb, rsb = glyph(ch, H, w)
        x += lsb
        dy = -step if raise_from is not None and i >= raise_from else 0.0
        if d:
            paths.append(f'<path transform="translate({x:.2f} {y0 + dy:.2f})" d="{d}"/>')
        x += W + rsb
        if i < len(text) - 1:
            x += w + tracking
    width = x + w / 2 - x0
    g = (f'<g fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" '
         f'stroke-linejoin="round">{"".join(paths)}</g>')
    return g, width


def stroke(d, w, c):
    return (f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')


def circle(cx, cy, r, c):
    return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{c}"/>'


# ---------------------------------------------------------------- Konzepte (Symbol, 256 × 256)
S60 = math.sin(math.radians(60))
T60 = math.tan(math.radians(60))


def k01(i, b):
    """Gipfel-A: ein A, dessen Spitze der Ball ist (das V-Ball-Logo, umgedreht und aufgestiegen)."""
    ax, ay, r, gap, sw = 128, 70, 32, 10, 34
    base = 216
    half = (base - ay) / T60
    L = (base - ay) / S60
    stop = L - r - gap - sw / 2
    lx, rx = ax - half, ax + half
    ex = stop * math.cos(math.radians(60))
    ey = base - stop * S60
    yc = 170
    cx = (yc - ay) / T60
    legs = stroke(f"M{lx:.1f} {base} L{lx+ex:.1f} {ey:.1f} M{rx:.1f} {base} L{rx-ex:.1f} {ey:.1f} "
                  f"M{ax-cx:.1f} {yc} H{ax+cx:.1f}", sw, i)
    return legs + circle(ax, ay - 2, r, b)


def k02(i, b):
    """Treppe: eine Treppe aus einem Strich, der Ball springt über die oberste Stufe hinaus."""
    return (stroke("M30 214 H86 V160 H142 V106 H190", 28, i) + circle(198, 58, 26, b))


def k03(i, b):
    """Ballnähte als Spitzbogen: die Nähte des Volleyballs zeigen nach oben."""
    ring = f'<circle cx="128" cy="128" r="96" fill="none" stroke="{i}" stroke-width="22"/>'
    seams = stroke("M62 198 A150 150 0 0 1 128 66 A150 150 0 0 1 194 198", 22, i)
    return ring + seams


def k04(i, b):
    """Flugbahn: Annahme, Zuspiel, Angriff – drei Punkte, die steigen und wachsen."""
    return circle(54, 202, 16, i) + circle(108, 138, 24, i) + circle(182, 70, 40, b)


def k05(i, b):
    """Netz-A: zwei Antennen bilden das A, die Netzkante ist der Querbalken."""
    legs = stroke("M44 220 L128 40 L212 220", 30, i)
    band = (f'<path fill-rule="evenodd" fill="{i}" d="M62 122 H194 L210 156 H46 Z '
            f'M80 131 H98 V147 H80 Z M110 131 H124 V147 H110 Z M132 131 H146 V147 H132 Z M158 131 H176 V147 H158 Z"/>')
    return legs + band


def k06(i, b):
    """Tabelle: der Ball verlässt den letzten Platz und steht ganz oben."""
    rows = stroke("M104 76 H222 M104 128 H222 M104 180 H222", 22, i)
    ring = f'<circle cx="60" cy="180" r="15" fill="none" stroke="{i}" stroke-width="8"/>'
    return rows + circle(60, 128, 15, i) + ring + circle(60, 76, 26, b)


def k07(i, b):
    """Sechs Positionen: fünf Spieler bleiben unten, die Sechs steigt über das Netz."""
    net = stroke("M36 124 H220", 14, i)
    dots = "".join(circle(x, y, 17, i) for x, y in [(64, 168), (192, 168), (64, 214), (128, 214), (192, 214)])
    return net + dots + circle(128, 70, 30, b)


def k08(i, b):
    """Vereinswappen: Wappenschild mit Sparren (dem heraldischen Zeichen für Aufstieg) und Ball."""
    shield = stroke("M48 40 H208 V126 C208 182 172 214 128 232 C84 214 48 182 48 126 Z", 18, i)
    chev = stroke("M78 178 L128 128 L178 178", 26, i)
    return shield + chev + circle(128, 86, 22, b)


def k09(i, b):
    """Stufen-A: der rechte Fuß des A steht schon eine Stufe höher."""
    return stroke("M50 216 L128 42 L186 170 H226 M80 150 H177", 30, i)


def k10(i, b):
    """Ball mit Treppe: der Aufstieg teilt den Ball."""
    up = "M35.2 175 H95 V127 H143 V79 H219.7 A104 104 0 0 0 35.2 175 Z"
    lo = "M227.3 97 H161 V145 H113 V193 H46.8 A104 104 0 0 0 227.3 97 Z"
    return f'<path fill="{i}" d="{up}"/><path fill="{b}" d="{lo}"/>'


KONZEPTE = [
    ("01-gipfel-a", "Gipfel-A", k01),
    ("02-treppe", "Treppe", k02),
    ("03-spitzbogen", "Spitzbogen", k03),
    ("04-flugbahn", "Flugbahn", k04),
    ("05-netz-a", "Netz-A", k05),
    ("06-tabelle", "Tabelle", k06),
    ("07-sechs-positionen", "Sechs Positionen", k07),
    ("08-wappen", "Wappen", k08),
    ("09-stufen-a", "Stufen-A", k09),
    ("10-geteilter-ball", "Geteilter Ball", k10),
]


def svg(vb_w, vb_h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w:.0f} {vb_h:.0f}" '
            f'width="{vb_w:.0f}" height="{vb_h:.0f}" role="img"><title>{title}</title>{body}</svg>\n')


def lockup(sym, i, step_word=False):
    """Symbol links, AUFSTEIGER rechts (bei Konzept 9: STEIGER eine Stufe höher als AUF)."""
    H, w = 76, 13
    if step_word:
        wd, W = word("AUFSTEIGER", H, w, 6, x0=300, y0=104, color=i, raise_from=3, step=22)
    else:
        wd, W = word("AUFSTEIGER", H, w, 6, x0=300, y0=90, color=i)
    return svg(300 + W + 24, 256, sym + wd, "Aufsteiger")


def build(out, farbe):
    os.makedirs(out, exist_ok=True)
    b_col = RED if farbe else INK
    for slug, name, fn in KONZEPTE:
        body = fn(INK, b_col)
        with open(os.path.join(out, f"{slug}.svg"), "w", encoding="utf-8") as f:
            f.write(svg(256, 256, body, f"Aufsteiger – {name}"))
        with open(os.path.join(out, f"{slug}-horizontal.svg"), "w", encoding="utf-8") as f:
            f.write(lockup(body, INK, step_word=slug.startswith("09")))


if __name__ == "__main__":
    build(sys.argv[1], "--farbe" in sys.argv)
