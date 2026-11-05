"""Génère css/themes.css : huit thèmes illustrés (palettes, motifs de fond, touches propres)."""
import math, random
from urllib.parse import quote
random.seed(7)  # motifs reproductibles
def uri(svg): return 'url("data:image/svg+xml,' + quote(svg, safe=" =:/,.'-()") + '")'
def svg(w, h, body): return f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}'>{body}</svg>"

# ---------- Motifs ----------
def stars(constellation=False):
    b = ''
    for _ in range(70):
        x, y, r = random.uniform(0, 400), random.uniform(0, 400), random.choice([.5, .6, .8, 1, 1.3])
        b += f"<circle cx='{x:.0f}' cy='{y:.0f}' r='{r}' fill='#fff' opacity='{random.uniform(.25, .8):.2f}'/>"
    for x, y in [(60, 80), (300, 240), (180, 350)]:  # étoiles à branches
        b += (f"<g stroke='#fff' stroke-linecap='round' opacity='.7'><path d='M{x} {y-5}v10M{x-5} {y}h10' stroke-width='1'/>"
              f"<path d='M{x-2} {y-2}l4 4M{x+2} {y-2}l-4 4' stroke-width='.6'/></g>")
    # Une petite constellation figée, pour qui a demandé moins d'animations (sinon ui/sky.js les dessine)
    if constellation:
        pts = [(250, 60), (285, 85), (320, 75), (340, 110), (300, 130)]
        b += "<path d='M" + 'L'.join(f'{x} {y}' for x, y in pts) + "' fill='none' stroke='#9FB4FF' stroke-width='.6' opacity='.35'/>"
        b += ''.join(f"<circle cx='{x}' cy='{y}' r='1.6' fill='#DCE4FF' opacity='.85'/>" for x, y in pts)
    return svg(400, 400, b)

def porcelaine():
    """Décor de faïence en bleu de four : médaillons à rosace, rinceaux feuillus, fleurettes et
    perles d'or ; tout se raccorde d'une tuile à l'autre (médaillons aux coins, fleurettes aux bords)."""
    C, G = '#1F4690', '#C9A227'
    def medallion(cx, cy):
        petals = ''.join(f"<ellipse cx='{cx}' cy='{cy - 15}' rx='6.5' ry='15' transform='rotate({a} {cx} {cy})'/>" for a in range(0, 360, 45))
        pearls = ''.join(f"<circle cx='{cx + 33*math.cos(math.radians(a)):.1f}' cy='{cy + 33*math.sin(math.radians(a)):.1f}' r='1.5'/>" for a in range(0, 360, 15))
        return (f"<g opacity='.3'><circle cx='{cx}' cy='{cy}' r='44' fill='none' stroke='{C}' stroke-width='1.8'/>"
                f"<circle cx='{cx}' cy='{cy}' r='39' fill='none' stroke='{C}' stroke-width='.7'/>"
                f"<g fill='{C}'>{pearls}</g>"
                f"<g fill='{C}' fill-opacity='.35' stroke='{C}' stroke-width='.9'>{petals}</g>"
                f"<circle cx='{cx}' cy='{cy}' r='5.5' fill='{C}'/></g>"
                f"<circle cx='{cx}' cy='{cy}' r='2.2' fill='{G}' opacity='.8'/>")
    def floweret(cx, cy):
        petals = ''.join(f"<circle cx='{cx + 6*math.cos(math.radians(a)):.1f}' cy='{cy + 6*math.sin(math.radians(a)):.1f}' r='4'/>" for a in range(-90, 270, 72))
        return f"<g fill='{C}' opacity='.26'>{petals}</g><circle cx='{cx}' cy='{cy}' r='2.4' fill='{G}' opacity='.75'/>"
    def vine(d, leaves):
        lf = ''.join(f"<ellipse cx='{x}' cy='{y}' rx='7' ry='3' transform='rotate({r} {x} {y})'/>" for x, y, r in leaves)
        return (f"<g opacity='.26'><path d='{d}' fill='none' stroke='{C}' stroke-width='1.4' stroke-linecap='round'/>"
                f"<g fill='{C}'>{lf}</g></g>")
    b = medallion(180, 180) + ''.join(medallion(x, y) for x in (0, 360) for y in (0, 360))
    b += ''.join(floweret(x, y) for x, y in ((180, 0), (180, 360), (0, 180), (360, 180)))
    # Rinceaux : de chaque fleurette vers le médaillon central, en S, avec leurs feuilles et une vrille
    for (fx, fy), (dx, dy) in (((180, 14), (0, 1)), ((180, 346), (0, -1)), ((14, 180), (1, 0)), ((346, 180), (-1, 0))):
        px, py = -dy, dx
        def at(t, w):
            return (fx + dx*t + px*w, fy + dy*t + py*w)
        p0, c1, c2, p1 = at(0, 0), at(40, 26), at(70, -26), at(118, 0)
        d = f"M{p0[0]:.0f} {p0[1]:.0f}C{c1[0]:.0f} {c1[1]:.0f} {c2[0]:.0f} {c2[1]:.0f} {p1[0]:.0f} {p1[1]:.0f}"
        l1, l2, l3 = at(30, 15), at(62, -12), at(92, -9)
        ang = math.degrees(math.atan2(dy, dx))
        b += vine(d, [(round(l1[0]), round(l1[1]), ang - 35), (round(l2[0]), round(l2[1]), ang + 40), (round(l3[0]), round(l3[1]), ang - 30)])
        t0 = at(48, 18)
        b += f"<path d='M{t0[0]:.0f} {t0[1]:.0f}c{px*8+dx*4:.0f} {py*8+dy*4:.0f} {px*14-dx*2:.0f} {py*14-dy*2:.0f} {px*8-dx*6:.0f} {py*8-dy*6:.0f}' fill='none' stroke='{C}' stroke-width='.9' opacity='.26'/>"
    # Perles d'or semées
    b += f"<g fill='{G}' opacity='.55'>" + ''.join(f"<circle cx='{x}' cy='{y}' r='1.3'/>" for x, y in ((90, 90), (270, 90), (90, 270), (270, 270))) + "</g>"
    return svg(360, 360, b)

def porcelain_frieze():
    """Frise festonnée de bordure d'assiette : bandeau bleu de four, festons blancs, perles d'or."""
    return svg(36, 18, "<rect width='36' height='12' fill='#1F4690'/><path d='M0 12a9 6 0 0 0 18 0a9 6 0 0 0 18 0' fill='#1F4690'/>"
               "<path d='M0 4h36' stroke='#C9A227' stroke-width='1'/><path d='M3 12a6 4 0 0 0 12 0M21 12a6 4 0 0 0 12 0' fill='none' stroke='#FFFFFF' stroke-width='1' opacity='.8'/>"
               "<circle cx='9' cy='8' r='1.4' fill='#C9A227'/><circle cx='27' cy='8' r='1.4' fill='#C9A227'/>")

def matrix_still():
    """Pluie figée (si le système demande moins d'animations) : quelques colonnes de signes verts."""
    random.seed(11)
    glyphs = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789Z:=+<>'
    b = ''
    for col in range(0, 240, 16):
        if random.random() < .45:
            continue
        top = random.randint(-8, 10)
        n = random.randint(6, 16)
        for k in range(n):
            op = .08 + .5 * k / n
            b += f"<text x='{col + 2}' y='{(top + k) * 16}' fill='#00FF41' opacity='{op:.2f}'>{random.choice(glyphs)}</text>"
    return svg(240, 320, f"<g font-family='monospace' font-size='14'>{b}</g>")

def terminal():
    b = "<path d='M0 1.5H4' stroke='#000' stroke-width='1' opacity='.35'/>"
    return svg(4, 3, b)

# ---------- Thèmes ----------
KEYS = ['paper', 'surface', 'ink', 'muted', 'line', 'edge', 'dot', 'accent', 'accent-ink', 'accent-soft', 'warn',
        'danger', 'danger-soft', 'ok', 'halo', 'male', 'female', 'scrim']
THEMES = [
  ('constellations', 'Constellations : nuit bleu profond, étoiles, liens en fins traits lumineux ; étoiles qui scintillent et étoiles filantes (ui/sky.js)', 'dark',
   dict(paper='#0B1026', surface='#141C3E', ink='#E8ECFF', muted='#AAB4DC', line='#2C386B', edge='#8FA4F0', dot='#1A2350',
        accent='#FFD36E', **{'accent-ink': '#0B1026', 'accent-soft': '#2B2B4F'}, warn='#FFD27A', danger='#FF9A8B', **{'danger-soft': '#3A1C2A'},
        ok='#8FE3C0', halo='#FFE7A3', male='#7FB2FF', female='#F5A3D0', scrim='rgba(2, 4, 16, .7)'),
   stars(), '400px', {}),
  ('porcelaine', 'Porcelaine de Limoges : émail blanc, décor de faïence en bleu de four (médaillons, rinceaux, fleurettes), filets et perles d’or ; frises festonnées, fiches en plaques émaillées, la personne au centre en bleu de four', 'light',
   dict(paper='#F3F6FB', surface='#FFFFFF', ink='#10224A', muted='#45567C', line='#BFCBE0', edge='#1F4690', dot='#E3EAF5',
        accent='#1F4690', **{'accent-ink': '#FFFFFF', 'accent-soft': '#DCE5F5'}, warn='#7A5200', danger='#A3263A', **{'danger-soft': '#F6DDE2'},
        ok='#2A6A4A', halo='#B8901A', male='#2E5A9E', female='#B04A7A', scrim='rgba(10, 20, 40, .45)'),
   porcelaine(), '360px', {'--frieze': uri(porcelain_frieze())}),
  ('matrice', 'Matrice : pluie de signes verts qui défile sur la toile (ui/rain.js), fiches de console', 'dark',
   dict(paper='#000300', surface='#020D04', ink='#C8FFD4', muted='#5FE07A', line='#0E4A1C', edge='#00D43A', dot='#021A08',
        accent='#00FF41', **{'accent-ink': '#001A07', 'accent-soft': '#063A16'}, warn='#E6FF6A', danger='#FF6B6B', **{'danger-soft': '#3A0E0E'},
        ok='#7DFFA0', halo='#B6FF00', male='#5CE1FF', female='#FF7AD9', scrim='rgba(0, 0, 0, .75)'),
   svg(4, 4, ''), '4px', {'--f-display': '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace'}),
  ('terminal', 'Terminal rétro : vert phosphore sur noir, lignes de balayage', 'dark',
   dict(paper='#040A05', surface='#08140A', ink='#9CFFAE', muted='#5FD47A', line='#1F5A2A', edge='#3FCF5C', dot='#0E2412',
        accent='#3DFF6E', **{'accent-ink': '#021006', 'accent-soft': '#0F3A1A'}, warn='#E6FF6A', danger='#FF7A7A', **{'danger-soft': '#3A1010'},
        ok='#9CFFAE', halo='#C6FF4A', male='#6AE0FF', female='#FF9AE0', scrim='rgba(0, 0, 0, .7)'),
   terminal(), '4px 3px', {'--f-display': '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace'}),
]

out = ["""/* ==========================================================
   Thèmes illustrés supplémentaires (menu « Aa », ui/theme.js) : palette, motif
   de la toile (--deco) et quelques touches propres à chaque thème.
   Généré par scripts/build-themes.py : les couleurs se règlent là.
   ========================================================== */
"""]
for name, comment, scheme, v, deco, size, extra in THEMES:
    body = ''.join(f"  --{k}: {v[k]};\n" for k in KEYS)
    body += ''.join(f"  {k}: {val};\n" for k, val in extra.items())
    out.append(f"""
/* {comment} */
:root[data-theme="{name}"] {{
{body}  --deco: {uri(deco)};
  --deco-size: {size};
  color-scheme: {scheme};
}}
""")

out.append(f"""
/* Constellations et Matrice : figées dans le fond pour qui a demandé moins d'animations */
@media (prefers-reduced-motion: reduce) {{
  :root[data-theme="constellations"] {{
    --deco: {uri(stars(True))};
  }}

  :root[data-theme="matrice"] {{
    --deco: {uri(matrix_still())};
    --deco-size: 240px 320px;
  }}
}}
""")

out.append("""
/* ---------- Touches propres ---------- */

/* Constellations : fiches et liens qui brillent doucement */
:root[data-theme="constellations"] .card {
  box-shadow: 0 0 14px rgba(127, 160, 255, .18);
}

:root[data-theme="constellations"] .edges path {
  filter: drop-shadow(0 0 2px rgba(143, 164, 240, .7));
}

/* Porcelaine : frises festonnées en haut et en bas de la toile, sur le décor de faïence */
:root[data-theme="porcelaine"] .canvas {
  background-image: var(--frieze), var(--frieze), var(--deco), radial-gradient(circle, var(--dot) 1px, transparent 1.4px);
  background-position: top left, bottom left, center, 0 0;
  background-repeat: repeat-x, repeat-x, repeat, repeat;
  background-size: 36px 18px, 36px 18px, var(--deco-size), 20px 20px;
}

/* Cadres de la toile et du panneau : filet d'or et filet bleu, comme le marli d'une assiette */
:root[data-theme="porcelaine"] .stage,
:root[data-theme="porcelaine"] .side {
  border-color: #C9A227;
  box-shadow: inset 0 0 0 3px #FFFFFF, inset 0 0 0 4px rgba(31, 70, 144, .35), 0 6px 18px rgba(16, 34, 74, .08);
}

:root[data-theme="porcelaine"] .tabs {
  border-bottom: 2px solid #1F4690;
  box-shadow: 0 2px 0 #C9A227;
}

/* Fiches : plaques émaillées, reflet du vernis, liseré d'or à l'intérieur du bord */
:root[data-theme="porcelaine"] .card {
  border-radius: 10px;
  background: radial-gradient(120% 90% at 28% 18%, #FFFFFF 0%, #F7F9FD 55%, #E8EEF8 100%);
  box-shadow: inset 0 0 0 2px #FFFFFF, inset 0 0 0 3px #C9A227, 0 2px 6px rgba(16, 34, 74, .12);
}

/* La personne au centre : une plaque bleu de four bordée d'or, au reflet blanc */
:root[data-theme="porcelaine"] .card.is-focus {
  border-color: #C9A227;
  background: radial-gradient(120% 90% at 28% 18%, #3B66B8 0%, #1F4690 55%, #15346E 100%);
  box-shadow: inset 0 0 0 2px #1F4690, inset 0 0 0 3px #E2C15A, 0 4px 12px rgba(16, 34, 74, .3);
  color: #FFFFFF;
}

:root[data-theme="porcelaine"] .card.is-focus * {
  color: #F2F5FF;
}

/* Son symbole (homme, femme) en blanc ; son numéro Sosa, une pastille d'or */
:root[data-theme="porcelaine"] .card.is-focus .sx {
  background: #F2F5FF;
  opacity: .9;
}

/* Son numéro Sosa : une pastille d'or */
:root[data-theme="porcelaine"] .card.is-focus .sosa {
  border-color: #E2C15A;
  background: #E2C15A;
  color: #10224A;
}

/* Lignée directe : filets d'or */
:root[data-theme="porcelaine"] .edges path.line {
  stroke: #C9A227;
}

/* Matrice et terminal : fiches en caractères de console (l'interface garde sa police, plus étroite) */
:root[data-theme="matrice"] .card,
:root[data-theme="terminal"] .card {
  font-family: var(--f-mono);
}

/* Matrice : fiches de console qui luisent sur la pluie ; pluie figée dans le fond si moins d'animations */
:root[data-theme="matrice"] {
  --r: 2px;
}

:root[data-theme="matrice"] .card {
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(0, 255, 65, .22);
}

:root[data-theme="matrice"] .card .g {
  text-shadow: 0 0 6px rgba(0, 255, 65, .6);
}

/* Terminal : texte qui luit, coins carrés, bords de l'écran assombris */
:root[data-theme="terminal"] {
  --r: 0;
}

:root[data-theme="terminal"] body {
  text-shadow: 0 0 4px rgba(60, 255, 110, .35);
}

:root[data-theme="terminal"] .card {
  border-radius: 0;
}

:root[data-theme="terminal"] .canvas {
  box-shadow: inset 0 0 80px rgba(0, 0, 0, .8);
}

/* Matrice : la pluie de signes, dessinée par ui/rain.js sous l'arbre */
.rain {
  position: sticky;
  top: 0;
  left: 0;
  height: 0;
  pointer-events: none;
}

.rain canvas {
  position: absolute;
  top: 0;
  left: 0;
}

/* Constellations : étoiles qui scintillent et étoiles filantes (ui/sky.js) */
.sky {
  position: sticky;
  top: 0;
  left: 0;
  height: 0;
  pointer-events: none;
}

.sky svg {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
}

.sky .twinkle {
  fill: #FFFFFF;
  opacity: 0;
  animation: twinkle 3.2s ease-in-out forwards;
}

.sky .shoot {
  opacity: 0;
  animation: shoot 1.4s ease-out forwards;
}

/* Constellations animées : traits qui se tracent, étoiles qui brillent et pulsent, puis tout s'efface */
.sky .constel {
  opacity: 0;
  animation: constel-life var(--life, 15s) ease-in-out forwards;
}

.sky .constel-line {
  fill: none;
  stroke: #B9CAFF;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: var(--len);
  stroke-dashoffset: var(--len);
  filter: drop-shadow(0 0 3px rgba(185, 202, 255, .95));
  animation: constel-draw 2.4s ease-out .6s forwards;
}

.sky .constel-star {
  fill: #FFFFFF;
  filter: drop-shadow(0 0 3px #FFFFFF) drop-shadow(0 0 9px #A9BDFF) drop-shadow(0 0 16px rgba(159, 180, 255, .6));
  transform-box: fill-box;
  transform-origin: center;
  animation: shine 2.2s ease-in-out infinite alternate;
}

.sky .constel-flare {
  stroke: #FFFFFF;
  stroke-width: 1.1;
  stroke-linecap: round;
  filter: drop-shadow(0 0 3px #FFFFFF);
  transform-box: fill-box;
  transform-origin: center;
  animation: flare 3s ease-in-out infinite;
}

@keyframes constel-life {
  0% {
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes constel-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes shine {
  from {
    opacity: .55;
    transform: scale(.8);
  }
  to {
    opacity: 1;
    transform: scale(1.25);
  }
}

@keyframes flare {
  0%,
  100% {
    opacity: .2;
    transform: scale(.6) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.2) rotate(45deg);
  }
}

@keyframes twinkle {
  0% {
    opacity: 0;
  }
  50% {
    opacity: .95;
  }
  100% {
    opacity: 0;
  }
}

@keyframes shoot {
  0% {
    opacity: 0;
    transform: translateX(0);
  }
  10% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(260px);
  }
}
""")
import sys
open(sys.argv[1], 'w').write(''.join(out))
