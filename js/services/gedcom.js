/**
 * Format GEDCOM 5.5.1 : export et import.
 * C'est le format d'échange accepté par Geneanet, Ancestris, Gramps, Heredis, MyHeritage…
 */
import { S } from '../state.js';
import { GM } from '../config.js';
import { rid } from '../utils/helpers.js';
import { dateParts } from '../utils/dates.js';
import { P, byBirth, maiden, SITUATIONS, SOURCE_KINDS, UNION_TYPES, UNION_ENDS, unionType, unionTypeLabel, eventsOf, sourcesOf, factLabel } from '../model/people.js';
import { t } from '../i18n.js';

/** Balise GEDCOM de chaque type d'événement (le type 'other' s'écrit EVEN + TYPE). */
const EVENT_TAGS = {
  baptism: 'BAPM', burial: 'BURI', cremation: 'CREM', census: 'CENS', residence: 'RESI', occupation: 'OCCU',
  emigration: 'EMIG', immigration: 'IMMI', naturalization: 'NATU', graduation: 'GRAD', retirement: 'RETI', will: 'WILL',
};
const TAG_EVENTS = { ...Object.fromEntries(Object.entries(EVENT_TAGS).map(([k, v]) => [v, k])), CHR: 'baptism', EVEN: 'other' };

/* ---------- Dates ---------- */

/**
 * « 12/03/1932 » -> « 12 MAR 1932 », « vers 1850 » -> « ABT 1850 ».
 * Texte libre ou date impossible : date-phrase GEDCOM, « (31/02/1900) », gardée telle quelle.
 */
export function toGedDate(s) {
  const raw = String(s || '').trim();
  if (!raw) return '';
  const p = dateParts(raw);
  if (!p) return '(' + raw.replace(/\(/g, '[').replace(/\)/g, ']') + ')';
  return (p.q ? p.q.toUpperCase() + ' ' : '') // abt, bef, aft : mêmes mots qu'en GEDCOM
    + (p.d ? p.d + ' ' : '') + (p.m ? GM[p.m - 1] + ' ' : '') + p.y;
}

/** « 12 MAR 1932 » -> « 12/03/1932 », « ABT 1850 » -> « vers 1850 », « (texte) » -> « texte ». */
export function fromGedDate(s) {
  const raw = String(s || '').trim();
  let m = /^\((.*)\)$/.exec(raw);
  if (m) return m[1].trim();
  // Date interprétée : « INT 1850 (vers le milieu du siècle) » -> la date
  if ((m = /^INT\s+(.+?)\s*\(.*\)$/i.exec(raw))) return fromGedDate(m[1]);
  let u = raw.toUpperCase();
  let prefix = '';
  if (!u) return '';
  if ((m = /^(ABT|EST|CAL)\s+/.exec(u))) {
    prefix = 'vers ';
    u = u.slice(m[0].length);
  } else if ((m = /^BEF\s+/.exec(u))) {
    prefix = 'avant ';
    u = u.slice(m[0].length);
  } else if ((m = /^AFT\s+/.exec(u))) {
    prefix = 'après ';
    u = u.slice(m[0].length);
  }
  if ((m = /^(\d{1,2})\s+([A-Z]{3})\s+(\d{3,4})$/.exec(u))) {
    const i = GM.indexOf(m[2]);
    if (i >= 0) return prefix + m[1].padStart(2, '0') + '/' + String(i + 1).padStart(2, '0') + '/' + m[3];
  }
  if ((m = /^([A-Z]{3})\s+(\d{3,4})$/.exec(u))) {
    const i = GM.indexOf(m[1]);
    if (i >= 0) return prefix + String(i + 1).padStart(2, '0') + '/' + m[2];
  }
  if (/^\d{3,4}$/.test(u)) return prefix + u;
  return raw;
}

/** Valeur sur une ligne, avec les @ doublés comme l'exige GEDCOM. */
const gv = (s) => String(s || '').replace(/[\r\n]+/g, ' ').replace(/@/g, '@@').trim();

// Longueur maximale d'une ligne GEDCOM 5.5.1, comptée en octets UTF-8 (la lecture la plus prudente)
const MAX_LINE = 255;
const bytes = (ch) => { const c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };

/**
 * Nombre de caractères de `chars` à mettre sur une ligne de `room` octets. On ne coupe
 * ni à côté d'une espace (certains logiciels les suppriment en bout de ligne) ni dans un @@.
 */
function cutPoint(chars, room) {
  let n = 0;
  for (let used = 0; n < chars.length && used + bytes(chars[n]) <= room; n++) used += bytes(chars[n]);
  if (n === chars.length) return n;
  for (let i = n; i > n / 2; i--) {
    if (chars[i - 1] !== ' ' && chars[i] !== ' ' && !(chars[i - 1] === '@' && chars[i] === '@')) return i;
  }
  return n;
}

/** Lignes d'un texte : CONT à chaque retour à la ligne, CONC quand une ligne serait trop longue. */
function textLines(level, tag, text) {
  const out = [];
  String(text).split(/\r?\n/).forEach((line, i) => {
    let head = i ? level + 1 + ' CONT' : level + ' ' + tag;
    let rest = [...line.replace(/@/g, '@@')];
    do {
      const n = cutPoint(rest, MAX_LINE - head.length - 1);
      out.push(head + ' ' + rest.slice(0, n).join(''));
      rest = rest.slice(n);
      head = level + 1 + ' CONC';
    } while (rest.length);
  });
  return out;
}

/* ---------- Export ---------- */

export function buildGedcom() {
  const out = [];
  const xref = new Map();
  let i = 0;
  const ids = [...S.people.keys()].sort(byBirth);
  for (const id of ids) xref.set(id, '@I' + ++i + '@');

  // Sources : une fiche SOUR par document ; chaque fait la cite avec sa cote (PAGE) et sa note
  const sourceRecords = new Map();
  const cite = (level, s) => {
    const key = [s.kind, s.title, s.place].join('|');
    if (!sourceRecords.has(key)) sourceRecords.set(key, { x: '@S' + (sourceRecords.size + 1) + '@', s });
    return [
      level + ' SOUR ' + sourceRecords.get(key).x,
      ...(s.ref ? textLines(level + 1, 'PAGE', s.ref) : []),
      ...(s.note ? textLines(level + 1, 'NOTE', s.note) : []),
    ];
  };
  const citations = (id, fact, level) => sourcesOf(P(id)).filter((s) => s.fact === fact).flatMap((s) => cite(level, s));
  const generalCitations = (id) => sourcesOf(P(id)).filter((s) => !factLabel(id, s.fact)).flatMap((s) => cite(1, s));

  // Familles : un couple (ou un parent seul) et ses enfants
  const fams = new Map();
  let fi = 0;
  const fam = (husband, wife) => {
    const key = [husband || '', wife || ''].sort().join('|');
    let f = fams.get(key);
    if (!f) {
      f = { x: '@F' + ++fi + '@', h: husband, w: wife, u: null, kids: [] };
      fams.set(key, f);
    }
    return f;
  };
  for (const [uid, u] of S.unions) {
    if (!S.people.has(u.a) || !S.people.has(u.b)) continue;
    const A = P(u.a);
    const B = P(u.b);
    const aIsWife = A.sex === 'F' || B.sex === 'M';
    const f = fam(aIsWife ? u.b : u.a, aIsWife ? u.a : u.b);
    f.u = u;
    f.uid = uid;
  }
  for (const id of ids) {
    const p = P(id);
    const father = S.people.has(p.fatherId) ? p.fatherId : null;
    const mother = S.people.has(p.motherId) ? p.motherId : null;
    if (father || mother) fam(father, mother).kids.push(id);
  }

  const famsOf = new Map();
  const famcOf = new Map();
  const push = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };
  for (const f of fams.values()) {
    for (const spouse of [f.h, f.w]) if (spouse) push(famsOf, spouse, f.x);
    for (const child of f.kids) push(famcOf, child, f.x);
  }

  const now = new Date();
  out.push(
    '0 HEAD', '1 SOUR LIGNEE', '2 NAME Lignée', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8', '1 DATE ' + now.getDate() + ' ' + GM[now.getMonth()] + ' ' + now.getFullYear(),
  );

  // Individus
  // Nom de naissance en premier ; le nom d'usage d'une femme mariée en second, TYPE married
  const nameLines = (g, s, type) => {
    const lines = ['1 NAME ' + (g ? g + ' ' : '') + '/' + s + '/'];
    if (type) lines.push('2 TYPE ' + type);
    if (g) lines.push('2 GIVN ' + g);
    if (s) lines.push('2 SURN ' + s);
    return lines;
  };
  for (const id of ids) {
    const p = P(id);
    const g = gv(p.given);
    const s = gv(p.surname);
    const m = gv(maiden(p) && p.maidenName);
    out.push('0 ' + xref.get(id) + ' INDI');
    if (m) out.push(...nameLines(g, m, ''), ...(s ? nameLines(g, s, 'married') : []));
    else out.push(...nameLines(g, s, ''));
    out.push('1 SEX ' + (p.sex === 'M' || p.sex === 'F' ? p.sex : 'U'));
    const birthCites = citations(id, 'birth', 2);
    if (p.birthDate || p.birthPlace || birthCites.length) {
      out.push('1 BIRT');
      if (p.birthDate) out.push('2 DATE ' + gv(toGedDate(p.birthDate)));
      if (p.birthPlace) out.push('2 PLAC ' + gv(p.birthPlace));
      out.push(...birthCites);
    }
    const deathCites = citations(id, 'death', 2);
    if (p.deathDate || p.deathPlace || deathCites.length) {
      out.push('1 DEAT');
      if (p.deathDate) out.push('2 DATE ' + gv(toGedDate(p.deathDate)));
      if (p.deathPlace) out.push('2 PLAC ' + gv(p.deathPlace));
      out.push(...deathCites);
    } else if (p.deceased) {
      out.push('1 DEAT Y');
    }
    if (p.occupation) out.push('1 OCCU ' + gv(p.occupation));
    for (const e of eventsOf(p)) {
      const inline = e.type === 'occupation' ? gv(e.note) : ''; // la profession s'écrit sur la ligne OCCU
      const sub = [];
      const tag = Object.hasOwn(EVENT_TAGS, e.type) ? EVENT_TAGS[e.type] : '';
      if (!tag) sub.push('2 TYPE ' + gv(e.label || t('ev.other')));
      if (e.date) sub.push('2 DATE ' + gv(toGedDate(e.date)));
      if (e.place) sub.push('2 PLAC ' + gv(e.place));
      if (e.note && !inline) sub.push(...textLines(2, 'NOTE', e.note));
      sub.push(...citations(id, e.id, 2));
      out.push('1 ' + (tag || 'EVEN') + (inline ? ' ' + inline : sub.length ? '' : ' Y'), ...sub);
    }
    // Situation familiale : balise propre à Lignée (ignorée par les autres logiciels)
    if (SITUATIONS.some(([c]) => c === p.situation)) {
      out.push('1 _SITU ' + p.situation);
      if (p.situationDate) out.push('2 DATE ' + gv(toGedDate(p.situationDate)));
    }
    if (p.notes) out.push(...textLines(1, 'NOTE', p.notes));
    out.push(...generalCitations(id));
    for (const x of famcOf.get(id) || []) out.push('1 FAMC ' + x);
    for (const x of famsOf.get(id) || []) out.push('1 FAMS ' + x);
  }

  // Familles
  for (const f of fams.values()) {
    out.push('0 ' + f.x + ' FAM');
    if (f.h) out.push('1 HUSB ' + xref.get(f.h));
    if (f.w) out.push('1 WIFE ' + xref.get(f.w));
    const marrCites = f.u ? [f.h, f.w].filter(Boolean).flatMap((id) => citations(id, 'union:' + f.uid, 2)) : [];
    const typeLabel = unionTypeLabel(f.u);
    if (f.u && (f.u.date || f.u.place || marrCites.length || typeLabel)) {
      out.push('1 MARR');
      // TYPE pour les autres logiciels ; _UTYPE, propre à Lignée, garde le code exact
      if (typeLabel) out.push('2 TYPE ' + gv(typeLabel), '2 _UTYPE ' + unionType(f.u));
      if (f.u.date) out.push('2 DATE ' + gv(toGedDate(f.u.date)));
      if (f.u.place) out.push('2 PLAC ' + gv(f.u.place));
      out.push(...marrCites);
    } else if (f.u) {
      out.push('1 MARR Y');
    }
    // Divorce : balise standard ; séparation et veuvage : balise propre à Lignée
    if (f.u && UNION_ENDS.includes(f.u.end)) {
      out.push(f.u.end === 'divorce' ? '1 DIV' : '1 _UEND ' + f.u.end);
      if (f.u.endDate) out.push('2 DATE ' + gv(toGedDate(f.u.endDate)));
    }
    for (const child of f.kids) out.push('1 CHIL ' + xref.get(child));
  }

  for (const { x, s } of sourceRecords.values()) {
    const kind = SOURCE_KINDS.includes(s.kind) ? s.kind : 'other';
    out.push('0 ' + x + ' SOUR', ...textLines(1, 'TITL', s.title || t('src.' + kind)));
    out.push('1 _KIND ' + kind); // balises propres à Lignée, ignorées ailleurs
    if (s.place) out.push('1 _PLAC ' + gv(s.place));
  }

  out.push('0 TRLR');
  return out.join('\r\n') + '\r\n';
}

/* ---------- Import ---------- */

/** Lit un fichier GEDCOM et renvoie { people: [{id, data}], unions: [{id, data}] }. */
export function parseGedcom(text) {
  // 1. Lignes -> arbre de nœuds { tag, val, xref, kids }
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const records = [];
  const stack = [];
  for (const raw of lines) {
    const m = /^\s*(\d+)\s+(@[^@\s]+@)?\s*([A-Za-z0-9_]+)(?: (.*))?$/.exec(raw);
    if (!m) continue;
    const level = +m[1];
    const node = { tag: m[3].toUpperCase(), val: m[4] || '', xref: m[2] || null, kids: [] };
    if (level === 0) {
      records.push(node);
      stack.length = 0;
      stack[0] = node;
    } else {
      const parent = stack[level - 1];
      if (!parent) continue;
      parent.kids.push(node);
      stack[level] = node;
      stack.length = level + 1;
    }
  }

  const first = (node, tag) => node && node.kids.find((k) => k.tag === tag);
  const val = (node) => (node ? node.val.replace(/@@/g, '@').trim() : '');
  const textOf = (node) => {
    if (!node || /^@[^@]+@$/.test(node.val.trim())) return '';
    const continued = node.kids
      .filter((k) => k.tag === 'CONC' || k.tag === 'CONT')
      .map((k) => (k.tag === 'CONT' ? '\n' : '') + k.val)
      .join('');
    return (node.val + continued).replace(/@@/g, '@').trim();
  };

  /** Fin d'une union : DIV, ou la balise de Lignée. */
  const unionEndOf = (f) => {
    const div = first(f, 'DIV');
    const own = first(f, '_UEND');
    const code = div ? 'divorce' : own && UNION_ENDS.includes(val(own)) ? val(own) : '';
    return code ? { end: code, endDate: fromGedDate(val(first(div || own, 'DATE'))) } : {};
  };

  /** Type d'une union : le code de Lignée, sinon déduit de TYPE (Heredis, Gramps…). */
  const unionTypeOf = (marr) => {
    if (!marr) return '';
    const code = val(first(marr, '_UTYPE'));
    if (UNION_TYPES.includes(code)) return code;
    const label = val(first(marr, 'TYPE'));
    if (/relig/i.test(label)) return 'religious';
    if (/pacs|civil (union|partner)/i.test(label)) return 'pacs';
    if (/concub|cohab|union libre/i.test(label)) return 'cohabiting';
    if (/mari|civil/i.test(label)) return 'married';
    return label ? 'other' : '';
  };

  // Sources : fiches SOUR, puis citations sous un fait
  const sourceRecords = new Map();
  for (const r of records) {
    if (r.tag !== 'SOUR' || !r.xref) continue;
    const kind = SOURCE_KINDS.includes(val(first(r, '_KIND'))) ? val(first(r, '_KIND')) : 'other';
    const title = textOf(first(r, 'TITL')) || textOf(first(r, 'ABBR'));
    // Titre généré à l'export depuis le type : inutile de le garder
    sourceRecords.set(r.xref, { kind, title: title === t('src.' + kind) ? '' : title, place: val(first(r, '_PLAC')) });
  }
  const citationsOf = (node, fact) => node.kids.filter((k) => k.tag === 'SOUR').map((k) => {
    const rec = sourceRecords.get(k.val.trim()) || { kind: 'other', title: textOf(k), place: '' };
    const data = first(k, 'DATA');
    return {
      id: rid('s'), fact, ...rec,
      ref: textOf(first(k, 'PAGE')),
      note: textOf(first(k, 'NOTE')) || textOf(data && first(data, 'TEXT')),
    };
  });

  // 2. Individus
  const idMap = new Map();
  const people = [];
  const now = Date.now();
  for (const r of records) {
    if (r.tag !== 'INDI' || !r.xref) continue;
    // Nom de naissance : le premier NAME qui n'est pas de TYPE married
    const names = r.kids.filter((k) => k.tag === 'NAME');
    const isMarried = (n) => /^married$/i.test(val(first(n, 'TYPE')));
    const nameNode = names.find((n) => !isMarried(n)) || names[0];
    const readName = (node) => {
      let g = '';
      let s = '';
      const mm = /^([^/]*)\/([^/]*)\/?(.*)$/.exec(node.val);
      if (mm) {
        g = (mm[1] + ' ' + mm[3]).trim();
        s = mm[2].trim();
      } else {
        g = node.val.trim();
      }
      const givn = first(node, 'GIVN');
      const surn = first(node, 'SURN');
      if (givn && givn.val.trim()) g = val(givn);
      if (surn && surn.val.trim()) s = val(surn);
      return { g, s: s.replace(/@@/g, '@') };
    };
    let givenName = '';
    let familyName = '';
    let maidenName = '';
    if (nameNode) {
      ({ g: givenName, s: familyName } = readName(nameNode));
      // Nom d'épouse : NAME de TYPE married, ou balise _MARNM (Geneanet, Heredis…)
      const marriedNode = names.find((n) => n !== nameNode && isMarried(n));
      const married = marriedNode ? readName(marriedNode).s : val(first(nameNode, '_MARNM') || first(r, '_MARNM'));
      if (married && married !== familyName && /^F/i.test(val(first(r, 'SEX')))) {
        maidenName = familyName;
        familyName = married;
      }
    }
    const event = (tag) => {
      const e = first(r, tag);
      return e ? { date: fromGedDate(val(first(e, 'DATE'))), place: val(first(e, 'PLAC')) } : null;
    };
    // Un baptême n'est pas une naissance, ni une inhumation un décès : ce sont des événements
    const birth = event('BIRT');
    const death = event('DEAT');
    const events = [];
    const sources = [...citationsOf(r, '')];
    for (const tag of ['BIRT', 'DEAT']) {
      const node = first(r, tag);
      if (node) sources.push(...citationsOf(node, tag === 'BIRT' ? 'birth' : 'death'));
    }
    // Le champ Profession prend une profession sans date, sinon la dernière datée ;
    // les professions datées restent des événements
    const jobs = r.kids.filter((k) => k.tag === 'OCCU');
    const plainJob = jobs.find((k) => !first(k, 'DATE'));
    for (const k of r.kids) {
      const type = TAG_EVENTS[k.tag];
      if (!type || k === plainJob) continue;
      const inline = /^y$/i.test(val(k)) ? '' : textOf(k);
      const e = {
        id: rid('e'), type, date: fromGedDate(val(first(k, 'DATE'))),
        place: val(first(k, 'PLAC')) || val(first(k, 'ADDR')),
        note: [inline, textOf(first(k, 'NOTE'))].filter(Boolean).join('\n'),
      };
      if (type === 'other' && val(first(k, 'TYPE')) !== t('ev.other')) e.label = val(first(k, 'TYPE'));
      events.push(e);
      sources.push(...citationsOf(k, e.id));
    }
    const sex = val(first(r, 'SEX')).toUpperCase();
    const situ = first(r, '_SITU');
    const situation = situ && SITUATIONS.some(([c]) => c === val(situ)) ? val(situ) : '';

    const id = rid('p');
    idMap.set(r.xref, id);
    people.push({
      id,
      data: {
        given: givenName,
        surname: familyName,
        maidenName: sex === 'F' ? maidenName : '',
        sex: sex === 'M' || sex === 'F' ? sex : 'U',
        birthDate: birth ? birth.date : '',
        birthPlace: birth ? birth.place : '',
        deathDate: death ? death.date : '',
        deathPlace: death ? death.place : '',
        deceased: !!(death || first(r, 'BURI') || first(r, 'CREM')),
        occupation: val(plainJob || jobs[jobs.length - 1]),
        situation,
        situationDate: situation ? fromGedDate(val(first(situ, 'DATE'))) : '',
        notes: textOf(first(r, 'NOTE')),
        fatherId: null,
        motherId: null,
        createdAt: now,
        updatedAt: now,
        ...(events.length ? { events } : {}),
        ...(sources.length ? { sources } : {}),
      },
    });
  }

  // 3. Familles : unions et filiations
  const byId = new Map(people.map((p) => [p.id, p]));
  const unions = [];
  for (const f of records) {
    if (f.tag !== 'FAM') continue;
    const husband = idMap.get(val(first(f, 'HUSB')));
    const wife = idMap.get(val(first(f, 'WIFE')));
    const marr = first(f, 'MARR');
    if (husband && wife) {
      const uid = rid('u');
      // Sources du mariage : portées par la fiche de l'un des deux conjoints
      const cited = [...citationsOf(f, 'union:' + uid), ...(marr ? citationsOf(marr, 'union:' + uid) : [])];
      if (cited.length) {
        const owner = byId.get(husband).data;
        owner.sources = [...(owner.sources || []), ...cited];
      }
      unions.push({
        id: uid,
        data: {
          a: husband,
          b: wife,
          type: unionTypeOf(marr),
          ...unionEndOf(f),
          date: marr ? fromGedDate(val(first(marr, 'DATE'))) : '',
          place: marr ? val(first(marr, 'PLAC')) : '',
          createdAt: now,
        },
      });
    }
    for (const c of f.kids.filter((k) => k.tag === 'CHIL')) {
      const child = byId.get(idMap.get(val(c)));
      if (!child) continue;
      if (husband) child.data.fatherId = husband;
      if (wife) child.data.motherId = wife;
    }
  }

  return { people, unions };
}
