"""Génère css/themes.css : huit thèmes illustrés (palettes, motifs de fond, touches propres)."""
import math, random
from urllib.parse import quote
random.seed(7)  # motifs reproductibles
def uri(svg): return 'url("data:image/svg+xml,' + quote(svg, safe=" =:/,.'-()") + '")'
def svg(w, h, body): return f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}'>{body}</svg>"

# ---------- Motifs ----------
def stars():
    b = ''
    for _ in range(70):
        x, y, r = random.uniform(0, 400), random.uniform(0, 400), random.choice([.5, .6, .8, 1, 1.3])
        b += f"<circle cx='{x:.0f}' cy='{y:.0f}' r='{r}' fill='#fff' opacity='{random.uniform(.25, .8):.2f}'/>"
    for x, y in [(60, 80), (300, 240), (180, 350)]:  # étoiles à branches
        b += (f"<g stroke='#fff' stroke-linecap='round' opacity='.7'><path d='M{x} {y-5}v10M{x-5} {y}h10' stroke-width='1'/>"
              f"<path d='M{x-2} {y-2}l4 4M{x+2} {y-2}l-4 4' stroke-width='.6'/></g>")
    # une petite constellation
    pts = [(250, 60), (285, 85), (320, 75), (340, 110), (300, 130)]
    b += "<path d='M" + 'L'.join(f'{x} {y}' for x, y in pts) + "' fill='none' stroke='#9FB4FF' stroke-width='.6' opacity='.35'/>"
    b += ''.join(f"<circle cx='{x}' cy='{y}' r='1.6' fill='#DCE4FF' opacity='.85'/>" for x, y in pts)
    return svg(400, 400, b)

def registre():
    b = ''.join(f"<path d='M0 {y}H360' stroke='#7A93B8' stroke-width='.6' opacity='.28'/>" for y in range(14, 360, 22))
    b += "<path d='M46 0V360' stroke='#B4473B' stroke-width='.8' opacity='.35'/>"
    b += ("<g transform='translate(270 250) rotate(-14)' fill='none' stroke='#6A2A3A' opacity='.16'>"
          "<circle r='38' stroke-width='2'/><circle r='30' stroke-width='.8'/>"
          "<path id='a' d='M-34 0A34 34 0 0 1 34 0' stroke='none'/>"
          "<text font-family='Georgia,serif' font-size='7.5' letter-spacing='1.2' fill='#6A2A3A' stroke='none'>"
          "<textPath href='#a' startOffset='50%' text-anchor='middle'>ARCHIVES DÉPARTEMENTALES</textPath></text>"
          "<text y='5' font-family='Georgia,serif' font-size='12' fill='#6A2A3A' stroke='none' text-anchor='middle'>✠</text></g>")
    return svg(360, 360, b)

def porcelaine():
    C = '#2E5A9E'
    def flower(x, y, s):
        p = ''.join(f"<ellipse cx='{x + 7*s*math.cos(a):.1f}' cy='{y + 7*s*math.sin(a):.1f}' rx='{4.2*s:.1f}' ry='{2.6*s:.1f}' transform='rotate({math.degrees(a):.0f} {x + 7*s*math.cos(a):.1f} {y + 7*s*math.sin(a):.1f})'/>" for a in [i * 2 * math.pi / 6 for i in range(6)])
        return f"<g fill='{C}' opacity='.22'>{p}<circle cx='{x}' cy='{y}' r='{2.4*s:.1f}'/></g>"
    def sprig(x, y, rot):
        return (f"<g transform='translate({x} {y}) rotate({rot})' fill='none' stroke='{C}' stroke-width='1.1' opacity='.2' stroke-linecap='round'>"
                "<path d='M0 0C10 -6 22 -6 34 0'/><path d='M8 -4c2-6 7-8 10-8M18 -5c3-5 8-6 11-5M14 -3c0 5-3 8-6 9M26 -2c1 5-1 8-4 10'/></g>")
    b = flower(60, 60, 1) + flower(230, 150, 1.3) + flower(120, 260, .8) + sprig(100, 90, 20) + sprig(250, 250, -30) + sprig(20, 200, 60)
    b += "<g fill='#C9A227' opacity='.35'><circle cx='170' cy='40' r='1.6'/><circle cx='300' cy='70' r='1.2'/><circle cx='40' cy='300' r='1.4'/></g>"
    return svg(320, 320, b)

def herbier():
    def leaf(x, y, rot, s, c):
        return (f"<g transform='translate({x} {y}) rotate({rot}) scale({s})' opacity='.28'><path d='M0 0C8-10 8-26 0-36C-8-26-8-10 0 0z' fill='{c}'/>"
                f"<path d='M0 0V-34M0-10l5-5M0-18l-5-5M0-26l4-4' stroke='#F4F5E8' stroke-width='.7' fill='none'/></g>")
    def fern(x, y, rot):
        p = "<path d='M0 0C2-20 2-40 0-60' stroke='#5E7A3A' stroke-width='1.1' fill='none'/>"
        for i in range(1, 8):
            yy = -i * 7.5; L = 13 - i * 1.3
            p += f"<path d='M0 {yy}q{L/2} -3 {L} -1M0 {yy}q{-L/2} -3 {-L} -1' stroke='#5E7A3A' stroke-width='.9' fill='none'/>"
        return f"<g transform='translate({x} {y}) rotate({rot})' opacity='.3'>{p}</g>"
    b = leaf(70, 120, -25, 1.1, '#6B8A4E') + leaf(260, 90, 35, .9, '#A08A3E') + leaf(170, 310, 160, 1, '#7E9A54') + fern(320, 300, -20) + fern(40, 330, 25)
    return svg(360, 360, b)

def album():
    # carton d'album : fibres et petites taches
    b = ''.join(f"<path d='M{random.uniform(0,300):.0f} {random.uniform(0,300):.0f}l{random.uniform(-6,6):.1f} {random.uniform(-2,2):.1f}' stroke='#5A4632' stroke-width='.6' opacity='{random.uniform(.1,.25):.2f}'/>" for _ in range(90))
    return svg(300, 300, b)

def machine():
    b = ''.join(f"<path d='M{random.uniform(0,300):.0f} {random.uniform(0,300):.0f}l{random.uniform(-10,10):.1f} {random.uniform(-1,1):.1f}' stroke='#8A8576' stroke-width='.5' opacity='{random.uniform(.08,.18):.2f}'/>" for _ in range(70))
    b += "<text x='210' y='250' font-family='Courier New,monospace' font-size='11' fill='#2A2A2A' opacity='.07'>— 1 —</text>"
    return svg(300, 300, b)

def heraldique():
    def shield(x, y, c1, c2, split):
        sh = "M0 0H24V12C24 22 12 28 12 28C12 28 0 22 0 12Z"
        div = {'v': "<path d='M12 0V28' stroke-width='12' stroke='{c2}'/>",
               'h': "<path d='M0 8H24' stroke-width='16' stroke='{c2}'/>",
               'd': "<path d='M0 0L24 24' stroke-width='9' stroke='{c2}'/>"}[split].format(c2=c2)
        return (f"<g transform='translate({x} {y})' opacity='.22'><clipPath id='c{x}{y}'><path d='{sh}'/></clipPath>"
                f"<path d='{sh}' fill='{c1}'/><g clip-path='url(#c{x}{y})'>{div}</g><path d='{sh}' fill='none' stroke='#5A4630' stroke-width='1'/></g>")
    b = shield(40, 40, '#1F3A7A', '#B8860B', 'v') + shield(200, 120, '#8E1F2F', '#E9DFC7', 'h') + shield(110, 230, '#2F5A2A', '#B8860B', 'd') + shield(260, 270, '#1F3A7A', '#E9DFC7', 'd')
    return svg(320, 320, b)

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
  ('registre', 'Registre ancien : papier de registre paroissial jauni et réglé, encre brun-noir, titres de copiste, tampon d’archives ; la personne au centre en lettrine', 'light',
   dict(paper='#EDE3C8', surface='#F7EFD9', ink='#2B1D12', muted='#5E4A36', line='#C9B48A', edge='#6B5038', dot='#E3D6B2',
        accent='#7A2420', **{'accent-ink': '#FBF3E0', 'accent-soft': '#E8D3B0'}, warn='#7A4E00', danger='#8E1F1F', **{'danger-soft': '#EBC9B4'},
        ok='#3B5A26', halo='#8C5A1E', male='#2F4F72', female='#8E3A52', scrim='rgba(40, 24, 10, .5)'),
   registre(), '360px', {'--f-display': '"IM Fell English", "Iowan Old Style", Georgia, serif'}),
  ('porcelaine', 'Porcelaine de Limoges : blanc émaillé, fleurs en bleu de four, liseré doré au bord des fiches', 'light',
   dict(paper='#F2F5FA', surface='#FFFFFF', ink='#12233F', muted='#46577A', line='#B9C8DF', edge='#2E5A9E', dot='#DCE5F2',
        accent='#1F4E9A', **{'accent-ink': '#FFFFFF', 'accent-soft': '#DCE6F6'}, warn='#7A5200', danger='#A3263A', **{'danger-soft': '#F6DDE2'},
        ok='#2A6A4A', halo='#B8901A', male='#2E5A9E', female='#B04A7A', scrim='rgba(10, 20, 40, .45)'),
   porcelaine(), '320px', {}),
  ('herbier', 'Herbier : papier de botaniste, feuilles et fougères séchées, tiges vertes pour les liens', 'light',
   dict(paper='#EDEFE0', surface='#FAFBF1', ink='#1F2A1A', muted='#526046', line='#C3CBA9', edge='#5E7A3A', dot='#DCE1C6',
        accent='#3F6A28', **{'accent-ink': '#F6FAEE', 'accent-soft': '#DDE7C9'}, warn='#7A5200', danger='#9A2E22', **{'danger-soft': '#F1DCD3'},
        ok='#2F6A3A', halo='#7FA63A', male='#3F6E8C', female='#A8506F', scrim='rgba(20, 30, 10, .45)'),
   herbier(), '360px', {}),
  ('album', 'Album de famille : carton d’album, fiches en tirages photo à bords blancs tenus par des coins', 'light',
   dict(paper='#CBB797', surface='#FFFDF7', ink='#2A211C', muted='#5A4A3C', line='#D9CDB6', edge='#5A4632', dot='#BCA683',
        accent='#7A3E1E', **{'accent-ink': '#FFF8F0', 'accent-soft': '#EEDDC8'}, warn='#7A4E00', danger='#8E1F1F', **{'danger-soft': '#F1D3C6'},
        ok='#3B5A26', halo='#9A5A1E', male='#3A5F86', female='#A0476A', scrim='rgba(30, 20, 10, .5)'),
   album(), '300px', {}),
  ('machine', 'Machine à écrire : papier pelure, caractères de machine, ruban rouge et noir', 'light',
   dict(paper='#F1EEE4', surface='#FBFAF4', ink='#1C1C1C', muted='#4A4A4A', line='#C9C4B6', edge='#4A4A4A', dot='#E1DCCD',
        accent='#A8221B', **{'accent-ink': '#FFFFFF', 'accent-soft': '#F1D6D2'}, warn='#6E4A00', danger='#A8221B', **{'danger-soft': '#F1D6D2'},
        ok='#2F5A2F', halo='#A8221B', male='#2F4A78', female='#8E3A5A', scrim='rgba(0, 0, 0, .45)'),
   machine(), '300px', {'--f-display': '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace'}),
  ('heraldique', 'Héraldique : parchemin enluminé, écus stylisés, émaux d’azur, de gueules et d’or', 'light',
   dict(paper='#E8DEC5', surface='#F5EEDB', ink='#2A1E14', muted='#5C4A36', line='#C4B08A', edge='#5A4630', dot='#DCCFAE',
        accent='#1F3A7A', **{'accent-ink': '#F8F2E2', 'accent-soft': '#DCD9E6'}, warn='#7A4E00', danger='#8E1F2F', **{'danger-soft': '#EBCBC6'},
        ok='#2F5A2A', halo='#B07D10', male='#1F3A7A', female='#8E1F2F', scrim='rgba(30, 20, 10, .5)'),
   heraldique(), '320px', {'--f-display': '"IM Fell English", "Iowan Old Style", Georgia, serif'}),
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

out.append("""
/* ---------- Touches propres ---------- */

/* Constellations : fiches et liens qui brillent doucement */
:root[data-theme="constellations"] .card {
  box-shadow: 0 0 14px rgba(127, 160, 255, .18);
}

:root[data-theme="constellations"] .edges path {
  filter: drop-shadow(0 0 2px rgba(143, 164, 240, .7));
}

/* Registre ancien : le prénom de la personne au centre commence par une lettrine */
:root[data-theme="registre"] .card.is-focus .g::first-letter {
  font-family: "IM Fell English", Georgia, serif;
  font-size: 1.7em;
  line-height: .8;
  color: #7A2420;
}

/* Porcelaine : liseré doré à l'intérieur du bord des fiches */
:root[data-theme="porcelaine"] .card {
  box-shadow: inset 0 0 0 2px var(--surface), inset 0 0 0 3px #C9A227;
}

/* Herbier : liens en tiges, un peu plus épais */
:root[data-theme="herbier"] .edges path {
  stroke-width: 1.8;
  stroke-linecap: round;
}

/* Album : tirages photo à bords blancs, légèrement de travers, tenus par des coins */
:root[data-theme="album"] .card {
  border: 5px solid #FFFFFF;
  box-shadow: 0 3px 8px rgba(40, 25, 10, .3);
}

:root[data-theme="album"] .card:nth-child(3n) {
  rotate: -1deg;
}

:root[data-theme="album"] .card:nth-child(3n + 1) {
  rotate: .8deg;
}

:root[data-theme="album"] .card::before,
:root[data-theme="album"] .card::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  background: #3A2C22;
}

:root[data-theme="album"] .card::before {
  top: -7px;
  left: -7px;
  clip-path: polygon(0 0, 100% 0, 0 100%);
}

:root[data-theme="album"] .card::after {
  right: -7px;
  bottom: -7px;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

/* Machine à écrire et terminal : fiches de l'arbre en caractères de machine (l'interface garde sa
   police, plus étroite, pour tenir sur une ligne) */
:root[data-theme="machine"] .card,
:root[data-theme="terminal"] .card {
  font-family: var(--f-mono);
}

/* Machine à écrire : traits nets, sans arrondi */
:root[data-theme="machine"] {
  --r: 0;
}

:root[data-theme="machine"] .card {
  border-radius: 0;
}

/* Héraldique : fiches bordées d'or */
:root[data-theme="heraldique"] .card {
  box-shadow: inset 0 0 0 1px #B07D10;
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
