"""Génère css/themes.css : huit thèmes illustrés (palettes, motifs de fond, touches propres)."""
import math, random
from urllib.parse import quote
random.seed(7)  # motifs reproductibles
def uri(svg): return 'url("data:image/svg+xml,' + quote(svg, safe=" =:/,.'-()") + '")'
def svg(w, h, body): return f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}'>{body}</svg>"

# ---------- Motifs ----------
def stars():
    """Fond d'étoiles faibles, semées au hasard ; les constellations, réelles, sont dessinées par ui/sky.js."""
    b = ''
    for _ in range(70):
        x, y, r = random.uniform(0, 400), random.uniform(0, 400), random.choice([.5, .6, .8, 1, 1.3])
        b += f"<circle cx='{x:.0f}' cy='{y:.0f}' r='{r}' fill='#fff' opacity='{random.uniform(.25, .8):.2f}'/>"
    for x, y in [(60, 80), (300, 240), (180, 350)]:  # étoiles à branches
        b += (f"<g stroke='#fff' stroke-linecap='round' opacity='.7'><path d='M{x} {y-5}v10M{x-5} {y}h10' stroke-width='1'/>"
              f"<path d='M{x-2} {y-2}l4 4M{x+2} {y-2}l-4 4' stroke-width='.6'/></g>")
    return svg(400, 400, b)

def porcelaine():
    """Décor de faïence en bleu de four : médaillons à rosace, rinceaux feuillus, fleurettes et
    perles d'or ; tout se raccorde d'une tuile à l'autre (médaillons aux coins, fleurettes aux bords)."""
    C, G = '#1A3F8F', '#C9A227'
    def medallion(cx, cy):
        petals = ''.join(f"<ellipse cx='{cx}' cy='{cy - 15}' rx='6.5' ry='15' transform='rotate({a} {cx} {cy})'/>" for a in range(0, 360, 45))
        pearls = ''.join(f"<circle cx='{cx + 33*math.cos(math.radians(a)):.1f}' cy='{cy + 33*math.sin(math.radians(a)):.1f}' r='1.6' fill='{G if a % 30 else C}'/>" for a in range(0, 360, 15))
        return (f"<g opacity='.48'><circle cx='{cx}' cy='{cy}' r='44' fill='none' stroke='{C}' stroke-width='1.8'/>"
                f"<circle cx='{cx}' cy='{cy}' r='39' fill='none' stroke='{C}' stroke-width='.7'/>"
                f"<g>{pearls}</g>"
                f"<g fill='{C}' fill-opacity='.5' stroke='{C}' stroke-width='.9'>{petals}</g>"
                f"<circle cx='{cx}' cy='{cy}' r='5.5' fill='{C}'/></g>"
                f"<circle cx='{cx}' cy='{cy}' r='47.5' fill='none' stroke='{G}' stroke-width='1.4' opacity='.7'/>"
                f"<circle cx='{cx}' cy='{cy}' r='36.5' fill='none' stroke='{G}' stroke-width='.6' opacity='.55'/>"
                f"<circle cx='{cx}' cy='{cy}' r='2.4' fill='{G}' opacity='.9'/>")
    def floweret(cx, cy):
        petals = ''.join(f"<circle cx='{cx + 6*math.cos(math.radians(a)):.1f}' cy='{cy + 6*math.sin(math.radians(a)):.1f}' r='4'/>" for a in range(-90, 270, 72))
        return f"<g fill='{C}' opacity='.45'>{petals}</g><circle cx='{cx}' cy='{cy}' r='2.4' fill='{G}' opacity='.9'/>"
    def vine(d, leaves):
        lf = ''.join(f"<ellipse cx='{x}' cy='{y}' rx='7' ry='3' transform='rotate({r} {x} {y})'/>" for x, y, r in leaves)
        return (f"<g opacity='.42'><path d='{d}' fill='none' stroke='{C}' stroke-width='1.4' stroke-linecap='round'/>"
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
        b += f"<path d='M{t0[0]:.0f} {t0[1]:.0f}c{px*8+dx*4:.0f} {py*8+dy*4:.0f} {px*14-dx*2:.0f} {py*14-dy*2:.0f} {px*8-dx*6:.0f} {py*8-dy*6:.0f}' fill='none' stroke='{C}' stroke-width='.9' opacity='.42'/>"
        b += f"<circle cx='{t0[0] + px*8 - dx*6:.0f}' cy='{t0[1] + py*8 - dy*6:.0f}' r='1.5' fill='{G}' opacity='.75'/>"
    # Perles d'or semées
    b += f"<g fill='{G}' opacity='.7'>" + ''.join(f"<circle cx='{x}' cy='{y}' r='1.6'/>" for x, y in ((90, 90), (270, 90), (90, 270), (270, 270), (135, 45), (225, 315), (45, 225), (315, 135))) + "</g>"
    return svg(360, 360, b)

def porcelain_frieze():
    """Frise festonnée de bordure d'assiette : bandeau bleu de four, festons blancs, perles d'or."""
    return svg(36, 18, "<rect width='36' height='12' fill='#1F4690'/><path d='M0 12a9 6 0 0 0 18 0a9 6 0 0 0 18 0' fill='#1F4690'/>"
               "<path d='M0 1.2h36M0 4.2h36' stroke='#D9B440' stroke-width='1.2'/><path d='M3 12a6 4 0 0 0 12 0M21 12a6 4 0 0 0 12 0' fill='none' stroke='#FFFFFF' stroke-width='1' opacity='.8'/>"
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

# ---------- Thèmes ----------
KEYS = ['paper', 'surface', 'ink', 'muted', 'line', 'edge', 'dot', 'accent', 'accent-ink', 'accent-soft', 'warn',
        'danger', 'danger-soft', 'ok', 'halo', 'male', 'female', 'scrim']
THEMES = [
  ('constellations', 'Constellations : nuit bleu profond, le vrai ciel de Bordeaux ce soir avec ses constellations, qui tourne lentement (ui/sky.js)', 'dark',
   dict(paper='#0B1026', surface='#1C2756', ink='#EEF1FF', muted='#B4BEE4', line='#33407A', edge='#8FA4F0', dot='#1A2350',
        accent='#FFD36E', **{'accent-ink': '#0B1026', 'accent-soft': '#3A3872'}, warn='#FFD27A', danger='#FF9A8B', **{'danger-soft': '#3A1C2A'},
        ok='#8FE3C0', halo='#FFE7A3', male='#7FB2FF', female='#F5A3D0', scrim='rgba(2, 4, 16, .7)'),
   stars(), '400px', {}),
  ('porcelaine', 'Porcelaine de Limoges : émail blanc, décor de faïence en bleu de four (médaillons, rinceaux, fleurettes), filets et perles d’or ; frises festonnées, fiches en plaques émaillées, la personne au centre en bleu de four', 'light',
   dict(paper='#FBF9F3', surface='#FFFFFF', ink='#10224A', muted='#45567C', line='#C6D0E4', edge='#1A3F8F', dot='#ECE6D8',
        accent='#1A3F8F', **{'accent-ink': '#FFFFFF', 'accent-soft': '#DCE5F5'}, warn='#7A5200', danger='#A3263A', **{'danger-soft': '#F6DDE2'},
        ok='#2A6A4A', halo='#B8901A', male='#2E5A9E', female='#B04A7A', scrim='rgba(10, 20, 40, .45)'),
   porcelaine(), '360px', {'--frieze': uri(porcelain_frieze())}),
  ('matrix', 'Matrix : pluie de signes verts qui défile sur la toile (ui/rain.js), fiches de console', 'dark',
   dict(paper='#000300', surface='#020D04', ink='#C8FFD4', muted='#5FE07A', line='#0E4A1C', edge='#00D43A', dot='#021A08',
        accent='#00FF41', **{'accent-ink': '#001A07', 'accent-soft': '#063A16'}, warn='#E6FF6A', danger='#FF6B6B', **{'danger-soft': '#3A0E0E'},
        ok='#7DFFA0', halo='#B6FF00', male='#5CE1FF', female='#FF7AD9', scrim='rgba(0, 0, 0, .75)'),
   svg(4, 4, ''), '4px', {'--f-display': '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace'}),
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
/* Matrix : pluie figée dans le fond pour qui a demandé moins d'animations */
@media (prefers-reduced-motion: reduce) {{
  :root[data-theme="matrix"] {{
    --deco: {uri(matrix_still())};
    --deco-size: 240px 320px;
  }}
}}
""")

# ---------- Carte du Maraudeur : ornements dessinés à l'encre (inspirés de l'affiche, sans en copier
# ni les textes ni l'emblème) : banderole, château et losange rouge, saule, rose des vents ----------
INK = '#4A2A18'
SERIF = "font-family='IM Fell English, Georgia, serif'"

def banner():
    """Banderole calligraphiée et ses arabesques : « Itinerarium familiae », et une ligne d'annonce."""
    swirl = ("M20 70C10 40 40 20 60 40S50 80 30 66"  # arabesque de gauche
             "M300 70C310 40 280 20 260 40S270 80 290 66")
    ribbon = "M40 48C90 28 230 28 280 48L272 66C222 48 98 48 48 66Z"
    return svg(320, 130,
        f"<g fill='none' stroke='{INK}' stroke-linecap='round' opacity='.6'>"
        f"<path d='{swirl}' stroke-width='1.4'/>"
        "<path d='M60 40c20-25 60-30 100-28s80 3 100 28' stroke-width='.9'/>"
        "<path d='M14 80c10 18 40 22 60 12M306 80c-10 18-40 22-60 12' stroke-width='1'/></g>"
        f"<path d='{ribbon}' fill='#EAD9B0' stroke='{INK}' stroke-width='1.3' opacity='.85'/>"
        f"<path d='M48 66l-14 8 8-14M272 66l14 8-8-14' fill='none' stroke='{INK}' stroke-width='1.1' opacity='.7'/>"
        f"<path id='rb' d='M52 57C100 40 220 40 268 57' fill='none'/>"
        f"<text {SERIF} font-size='12' letter-spacing='1.5' fill='{INK}' opacity='.85'>"
        "<textPath href='#rb' startOffset='50%' text-anchor='middle'>ITINERARIUM FAMILIAE</textPath></text>"
        f"<text x='160' y='96' {SERIF} font-style='italic' font-size='13' fill='{INK}' text-anchor='middle' opacity='.75'>"
        "les ancêtres ont l’honneur</text>"
        f"<text x='160' y='114' {SERIF} font-style='italic' font-size='13' fill='{INK}' text-anchor='middle' opacity='.75'>"
        "de vous présenter</text>")

def castle():
    """Château à tourelles, à l'encre, barré d'un losange rouge : « La carte de Lignée »."""
    towers = ''
    for x, w, top in ((30, 26, 70), (78, 22, 50), (122, 30, 30), (172, 22, 52), (212, 26, 74)):
        towers += (f"<path d='M{x} 180V{top}h{w}V180'/><path d='M{x - 3} {top}L{x + w / 2} {top - 26}L{x + w + 3} {top}Z'/>"
                   f"<path d='M{x + w / 2 - 3} {top + 18}v8h6v-8a3 3 0 0 0-6 0'/>")
    walls = "M20 180h230M20 180v-60h230v60" + ''.join(f"M{20 + i * 10} 120v-6h5v6" for i in range(23))
    seal = ("<g transform='translate(135 150) rotate(45)'>"
            "<rect x='-46' y='-46' width='92' height='92' fill='#8E1F1F' stroke='#4A1A12' stroke-width='2'/>"
            "<rect x='-40' y='-40' width='80' height='80' fill='none' stroke='#E9D3A8' stroke-width='1' opacity='.8'/></g>"
            f"<text x='135' y='140' {SERIF} font-style='italic' font-size='15' fill='#F4E6C4' text-anchor='middle'>La carte de</text>"
            f"<text x='135' y='166' {SERIF} font-size='22' letter-spacing='1' fill='#F4E6C4' text-anchor='middle'>LIGNÉE</text>")
    return svg(270, 230,
        f"<g fill='none' stroke='{INK}' stroke-width='1.2' stroke-linejoin='round' opacity='.6'>{towers}<path d='{walls}'/>"
        "<path d='M20 200c40 10 80-6 120 4s80 8 110-2' stroke-dasharray='2 4'/></g>" + seal)

def willow():
    """Saule croqué à la plume : tronc noueux, branches qui retombent."""
    b = "<path d='M100 200C96 160 108 130 98 100S104 60 100 40' stroke-width='4'/>"
    for i in range(16):
        x0 = 100 + (i - 8) * 3
        dx = (i - 8) * 9
        b += f"<path d='M{x0} {50 + abs(i - 8) * 3}C{x0 + dx * .6} {20 + i % 3 * 6} {x0 + dx} {60} {x0 + dx * 1.1} {120 + (i % 4) * 14}' stroke-width='.9'/>"
    return svg(200, 210, f"<g fill='none' stroke='{INK}' stroke-linecap='round' opacity='.5'>{b}</g>")

def compass():
    """Rose des vents à huit branches et ses points cardinaux."""
    pts = ''
    for k in range(8):
        a = k * math.pi / 4
        long = 46 if k % 2 == 0 else 26
        x, y = 70 + long * math.sin(a), 70 - long * math.cos(a)
        lx, ly = 70 + 7 * math.sin(a + math.pi / 2), 70 - 7 * math.cos(a + math.pi / 2)
        rx, ry = 70 + 7 * math.sin(a - math.pi / 2), 70 - 7 * math.cos(a - math.pi / 2)
        fill = INK if k % 2 == 0 else 'none'
        pts += f"<path d='M{x:.1f} {y:.1f}L{lx:.1f} {ly:.1f}L70 70L{rx:.1f} {ry:.1f}Z' fill='{fill}' fill-opacity='.55'/>"
    letters = ''.join(f"<text x='{x}' y='{y}' {SERIF} font-size='12' fill='{INK}' text-anchor='middle'>{t}</text>"
                      for x, y, t in ((70, 16, 'N'), (70, 134, 'S'), (128, 74, 'E'), (12, 74, 'O')))
    return svg(140, 140, f"<g stroke='{INK}' stroke-width='.9' opacity='.6'><circle cx='70' cy='70' r='34' fill='none'/>"
               f"<circle cx='70' cy='70' r='30' fill='none' stroke-dasharray='1 3'/>{pts}</g><g opacity='.65'>{letters}</g>")

out.append(f"""
/* Carte du Maraudeur : ornements à l'encre aux coins de la toile (banderole, saule, château et
   losange rouge, rose des vents), sur le parchemin et ses tracés ; fixes, même sans animation */
:root[data-theme="maraudeur"] .canvas {{
  background-image: {uri(banner())}, {uri(willow())}, {uri(castle())}, {uri(compass())}, var(--deco), radial-gradient(circle, var(--dot) 1px, transparent 1.4px);
  background-position: top 10px left 14px, top 6px right 10px, bottom 6px left 10px, bottom 14px right 16px, 0 0, 0 0;
  background-repeat: no-repeat, no-repeat, no-repeat, no-repeat, repeat, repeat;
  background-size: 320px 130px, 200px 210px, 270px 230px, 140px 140px, var(--deco-size), 20px 20px;
}}
""")

out.append("""
/* ---------- Touches propres ---------- */

/* Constellations : fiches plus claires que le ciel, détachées des étoiles par un liseré de nuit,
   et un halo (doré pour la lignée directe) ; le contour garde la couleur homme ou femme */
:root[data-theme="constellations"] .card:not(.is-line) {
  box-shadow: 0 0 0 5px rgba(8, 12, 30, .88), 0 0 22px 4px rgba(127, 160, 255, .28);
}

:root[data-theme="constellations"] .card.is-line {
  box-shadow: 0 0 0 2px var(--halo), 0 0 0 7px rgba(8, 12, 30, .88), 0 0 22px 5px rgba(255, 231, 163, .3);
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
  box-shadow: inset 0 0 0 2px #FFFFFF, inset 0 0 0 3.5px #C9A227, inset 0 0 0 5px #FFFFFF, inset 0 0 0 5.6px rgba(201, 162, 39, .6), 0 2px 6px rgba(16, 34, 74, .12);
}

/* Fiches « Ajouter » : un simple cadre pointillé, sans filets */
:root[data-theme="porcelaine"] .card.ph {
  background: rgba(255, 255, 255, .7);
  box-shadow: none;
}

/* Boutons principaux et onglet choisi : un filet d'or */
:root[data-theme="porcelaine"] .btn.primary,
:root[data-theme="porcelaine"] .seg button[aria-pressed="true"] {
  box-shadow: inset 0 0 0 1px #E2C15A;
}

:root[data-theme="porcelaine"] .tabs button[aria-selected="true"] {
  box-shadow: inset 0 -3px 0 #C9A227;
}

/* La personne au centre : plaque blanche cerclée de filets d'or et de bleu de four, nom en bleu */
:root[data-theme="porcelaine"] .card.is-focus {
  border-color: #1A3F8F;
  background: radial-gradient(120% 90% at 28% 18%, #FFFFFF 0%, #F1F5FD 55%, #DFE8F8 100%);
  box-shadow: inset 0 0 0 2px #FFFFFF, inset 0 0 0 4px #C9A227, inset 0 0 0 6px #FFFFFF, inset 0 0 0 7px #1A3F8F, 0 4px 14px rgba(16, 34, 74, .25);
}

:root[data-theme="porcelaine"] .card.is-focus .g {
  color: #1A3F8F;
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

/* Matrix : fiches en caractères de console (l'interface garde sa police, plus étroite) */
:root[data-theme="matrix"] .card {
  font-family: var(--f-mono);
}

/* Matrix : fiches de console qui luisent sur la pluie ; pluie figée dans le fond si moins d'animations */
:root[data-theme="matrix"] {
  --r: 2px;
}

:root[data-theme="matrix"] .card {
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(0, 255, 65, .22);
}

:root[data-theme="matrix"] .card .g {
  text-shadow: 0 0 6px rgba(0, 255, 65, .6);
}

/* Matrix : la pluie de signes, dessinée par ui/rain.js sous l'arbre */
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

/* Constellations : le vrai ciel de Bordeaux, dessiné par ui/sky.js sous l'arbre */
.sky {
  position: sticky;
  top: 0;
  left: 0;
  height: 0;
  pointer-events: none;
}

.sky canvas {
  position: absolute;
  top: 0;
  left: 0;
}
""")
import sys
open(sys.argv[1], 'w').write(''.join(out))
