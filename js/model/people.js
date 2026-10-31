/**
 * Modèle : personnes, noms, dates de vie et liens de parenté.
 *
 * Une personne : { given, surname, maidenName, sex ('M'|'F'|'U'), birthDate, birthPlace,
 *   deathDate, deathPlace, deceased, occupation, situation, situationDate, notes, fatherId, motherId,
 *   createdAt, updatedAt, photo?, example? }
 *   situation est la situation familiale (code de SITUATIONS, ou vide) ; situationDate,
 *   la date ou l'année du mariage ou du pacs (facultative).
 *   photo est une image JPEG réduite (facultative) : intégrée en data URL, ou, avec le
 *   serveur local, « photos/<fichier> » dans le dossier des photos de l'arbre.
 *   surname est le nom d'usage ; maidenName, le nom de jeune fille d'une femme (facultatif).
 *   events (facultatif) : autres événements [{ id, type, date, place, note, label? }].
 *   sources (facultatif) : actes cités [{ id, fact, kind, title, place, ref, note, photo? }] ;
 *   fact est le fait appuyé : 'birth', 'death', l'id d'un événement, 'union:<id d'union>',
 *   ou vide pour la fiche en général.
 *   media (facultatif) : galerie [{ id, photo, title, date, note, tags: [{ id, x, y }] }] ;
 *   tags : personnes identifiées sur l'image (x, y en pourcentage).
 * Une union : { a, b, type?, date, place, end?, endDate?, createdAt, example? } ; type : code de
 * UNION_TYPES ; end : fin de l'union, code de UNION_ENDS (absent tant qu'elle dure).
 */
import { S, idx } from '../state.js';
import { yearOf, shortDate, longDate, fullDate, dateBounds } from '../utils/dates.js';
import { norm } from '../utils/helpers.js';
import { t, getLang } from '../i18n.js';

/* ---------- Accès et noms ---------- */

export const P = (id) => (id ? S.people.get(id) : undefined);
export const given = (p) => String((p && p.given) || '').trim();
export const surname = (p) => String((p && p.surname) || '').trim().toUpperCase();

/** Nom de jeune fille, seulement pour une femme et s'il diffère du nom d'usage. */
export function maiden(p) {
  if (!p || p.sex !== 'F') return '';
  const m = String(p.maidenName || '').trim().toUpperCase();
  return m && m !== surname(p) ? m : '';
}

/** Nom d'une famille : noms de naissance des deux parents, « DURAND – ROCHE » (un seul s'ils sont identiques). */
export function coupleName(father, mother) {
  const names = [father, mother].filter(Boolean).map((p) => maiden(p) || surname(p)).filter(Boolean);
  return [...new Set(names)].join(' – ');
}

/** Nom de la famille dont une personne est l'enfant, d'après son père et sa mère ; vide s'ils sont inconnus. */
export function parentsName(id) {
  const p = P(id);
  return p ? coupleName(P(p.fatherId), P(p.motherId)) : '';
}

/** Nom de naissance déduit des parents : celui du père, à défaut celui de naissance de la mère. */
export function birthSurname(fatherId, motherId) {
  const f = P(fatherId);
  if (f && surname(f)) return f.surname.trim();
  const m = P(motherId);
  if (!m) return '';
  return (maiden(m) ? m.maidenName : m.surname || '').trim();
}

/* ---------- Situation familiale ---------- */

/** Codes des situations ; libellés [masculin, féminin] dans i18n.js (« situ.<code> »). */
export const SITUATIONS = [['single'], ['cohabiting'], ['pacs'], ['married'], ['remarried'], ['separated'], ['divorced'], ['widowed']];

/** Situations pour lesquelles on peut indiquer une date. */
export const DATED_SITUATIONS = new Set(['married', 'remarried', 'pacs']);

/** Libellé accordé au sexe : « Mariée », « Pacsé(e) » si le sexe n'est pas précisé. */
export function situationLabel(code, sex) {
  if (!SITUATIONS.some(([c]) => c === code)) return '';
  const [m, f] = t('situ.' + code);
  if (sex === 'M') return m;
  if (sex === 'F' || m === f) return f;
  return m + ' / ' + f;
}

/**
 * Situation du moment, d'après la dernière union : Veuve, Divorcé, Séparée, Mariée, Remarié…
 * Sans union renseignée, c'est la situation saisie sur la fiche.
 */
export function currentSituation(id) {
  const p = P(id);
  const list = partnersOf(id).filter((x) => x.uid && S.unions.has(x.uid));
  const last = list[list.length - 1];
  if (!p || !last) return (p && p.situation) || '';
  const u = S.unions.get(last.uid);
  const partner = P(last.id);
  const end = u.end || (partner && isDead(partner) && !isDead(p) ? 'death' : '');
  if (end) return { death: 'widowed', divorce: 'divorced', separation: 'separated' }[end] || p.situation || '';
  const type = unionType(u);
  if (type === 'married' || type === 'religious') {
    const before = list.slice(0, -1).some((x) => ['married', 'religious'].includes(unionType(S.unions.get(x.uid))));
    return before || p.situation === 'remarried' ? 'remarried' : 'married';
  }
  return type === 'pacs' || type === 'cohabiting' ? type : p.situation || '';
}

/** « Mariée (12 Mars 1956) » si une date est connue. Avec `id`, la situation du moment. */
export function situationText(p, id) {
  const code = id ? currentSituation(id) : p && p.situation;
  const label = situationLabel(code, p && p.sex);
  if (!label) return '';
  let date = code === p.situation ? p.situationDate : '';
  if (id && !date) {
    const last = partnersOf(id).filter((x) => x.uid).pop();
    date = last ? S.unions.get(last.uid).date : '';
  }
  const d = DATED_SITUATIONS.has(code) ? longDate(date) : '';
  return d ? label + ' (' + d + ')' : label;
}

/* ---------- Événements et sources ---------- */

/** Types d'union ; libellés dans i18n.js (« ut.<type> »). */
export const UNION_TYPES = ['married', 'religious', 'pacs', 'cohabiting', 'other'];

/**
 * Type d'une union : celui enregistré, sinon la situation d'un conjoint (Marié, Pacsé, En concubinage,
 * mêmes codes) dont c'est la dernière union. Vide si rien ne permet de le savoir.
 */
export function unionType(u) {
  if (!u) return '';
  if (UNION_TYPES.includes(u.type)) return u.type;
  for (const [id, other] of [[u.a, u.b], [u.b, u.a]]) {
    const situation = P(id) && P(id).situation;
    if (['married', 'remarried', 'pacs', 'cohabiting'].includes(situation)) {
      const last = partnersOf(id).pop();
      if (last && last.id === other) return situation === 'remarried' ? 'married' : situation;
    }
  }
  return '';
}

/** Fins d'union ; libellés dans i18n.js (« ue.<code> »). */
export const UNION_ENDS = ['death', 'divorce', 'separation'];

/** « Divorce, 1980 », ou vide si l'union n'a pas de fin renseignée. */
export function unionEndText(u) {
  if (!u || !UNION_ENDS.includes(u.end)) return '';
  return [t('ue.' + u.end), longDate(u.endDate)].filter(Boolean).join(', ');
}

/** Libellé du type d'une union, ou vide s'il n'est pas connu. */
export function unionTypeLabel(u) {
  const code = unionType(u);
  return code ? t('ut.' + code) : '';
}

/** Types d'événements ; libellés dans i18n.js (« ev.<type> »), balises dans gedcom.js. */
export const EVENT_TYPES = ['baptism', 'burial', 'cremation', 'census', 'residence', 'occupation', 'emigration',
  'immigration', 'naturalization', 'graduation', 'retirement', 'will', 'other'];

/** Types de sources ; libellés dans i18n.js (« src.<kind> »). */
export const SOURCE_KINDS = ['birth', 'baptism', 'marriage', 'death', 'burial', 'census', 'military', 'notary',
  'family', 'book', 'web', 'other'];

const listOf = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

export const sourcesOf = (p) => listOf(p && p.sources);
export const mediaList = (p) => listOf(p && p.media);

/** Galerie d'une personne : ses images, et celles où elle est identifiée : [{ owner, m }]. */
export function mediaOf(id) {
  const out = mediaList(P(id)).map((m) => ({ owner: id, m }));
  for (const [owner, p] of S.people) {
    if (owner === id) continue;
    for (const m of mediaList(p)) if (listOf(m.tags).some((x) => x.id === id)) out.push({ owner, m });
  }
  return out;
}

/** Toutes les images de l'arbre. */
export const allMedia = () => [...S.people].flatMap(([owner, p]) => mediaList(p).map((m) => ({ owner, m })));

/** Événements d'une personne, dans l'ordre des dates (sans date lisible : à la fin). */
export function eventsOf(p) {
  const key = (e) => {
    const b = dateBounds(e.date);
    return b && Number.isFinite(b.lo) ? b.lo : b ? b.hi : Infinity;
  };
  return listOf(p && p.events).sort((a, b) => key(a) - key(b));
}

export const eventLabel = (e) => (e.type === 'other' && e.label) || t(EVENT_TYPES.includes(e.type) ? 'ev.' + e.type : 'ev.other');

/** Libellé du fait appuyé par une source de la personne `id` ; vide pour la fiche en général. */
export function factLabel(id, fact) {
  if (fact === 'birth') return t('birth');
  if (fact === 'death') return t('death');
  if (String(fact || '').startsWith('union:')) {
    const u = S.unions.get(fact.slice(6));
    if (!u) return '';
    return t('with', fullName(P(u.a === id ? u.b : u.a)));
  }
  const e = listOf(P(id) && P(id).events).find((x) => x.id === fact);
  return e ? eventLabel(e) : '';
}

/** « DUPONT née FAURE », ou le nom seul. */
export function surnameLine(p) {
  const s = surname(p);
  const m = maiden(p);
  return s && m ? s + ' ' + t('nee') + ' ' + m : s || m;
}

/** Nom complet avec le nom de jeune fille : « Marguerite DUPONT née FAURE ». */
export function longName(p) {
  const m = maiden(p);
  return fullName(p) + (m && surname(p) ? ' ' + t('nee') + ' ' + m : '');
}

export const isPhotoData = (s) => /^data:image\/(jpeg|png|webp|gif);base64,/.test(String(s || ''));
/** Début du nom de fichier d'une photo : « PALLIER-Jean », « photo » pour une fiche sans nom. */
export function photoLabel(p) {
  const name = [surname(p) || String(p.maidenName || '').trim().toUpperCase(), given(p)].join(' ').normalize('NFC');
  return name.replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'photo';
}

export const isPhotoFile = (s) => /^photos\/[^/\\]+\.(jpg|png|webp|gif)$/.test(String(s || ''));

/**
 * Adresse affichable d'une photo enregistrée (champ photo d'une fiche), ou '' :
 * data URL telle quelle, fichier du serveur local, les autres adresses sont ignorées.
 */
export function photoSrc(s) {
  if (isPhotoData(s)) return s;
  if (isPhotoFile(s) && S.mode === 'file') {
    return `api/trees/${encodeURIComponent(S.tree)}/photos/${encodeURIComponent(s.slice(7))}`;
  }
  return '';
}

/** Photo de la personne (adresse affichable), ou ''. */
export const photoOf = (p) => photoSrc(p && p.photo);

const AVATARS = { F: 'images/avatar_femme.jpeg', M: 'images/avatar_homme.jpeg' };

/** Avatar par défaut selon le sexe, ou '' si le sexe n'est pas précisé. */
export const avatarOf = (sex) => AVATARS[sex] || '';

export function fullName(p) {
  if (!p) return t('unknownPerson');
  const g = given(p);
  const s = surname(p) || maiden(p);
  return g || s ? [g, s].filter(Boolean).join(' ') : t('noName');
}

export function cmpName(pa, pb) {
  return (surname(pa) || '~').localeCompare(surname(pb) || '~', getLang()) || given(pa).localeCompare(given(pb), getLang());
}

/* ---------- Recherche ---------- */

/** Mots de la recherche, en minuscules et sans accents. */
export const queryWords = (query) => norm(query).split(/\s+/).filter(Boolean);

/**
 * Vrai si chaque mot de la recherche figure dans le nom, les lieux, la profession
 * ou les dates de la personne, dans n'importe quel ordre.
 */
export function matchesWords(p, words) {
  if (!words.length) return true;
  const text = norm([given(p), surname(p), maiden(p), p.birthPlace, p.deathPlace, p.occupation, p.birthDate, p.deathDate].join(' '));
  return words.every((w) => text.includes(w));
}

/** Tri par année de naissance, puis par nom. */
export function byBirth(a, b) {
  const pa = P(a);
  const pb = P(b);
  const ya = yearOf(pa && pa.birthDate) || 9999;
  const yb = yearOf(pb && pb.birthDate) || 9999;
  if (ya !== yb) return ya - yb;
  return fullName(pa).localeCompare(fullName(pb), getLang());
}

/* ---------- Dates de vie ---------- */

export const isDead = (p) =>
  !!(String(p.deathDate || '').trim() || String(p.deathPlace || '').trim() || p.deceased);

/** « 1932 – 2004 », « ° 1958 » ou « † 1971 ». */
export function lifeYears(p) {
  const b = shortDate(p.birthDate);
  const d = shortDate(p.deathDate);
  if (b && d) return b + ' – ' + d;
  if (b) return '° ' + b;
  if (d) return '† ' + d;
  return '';
}

/** Ligne de dates d'une fiche de l'arbre. */
export function cardDates(p) {
  const b = shortDate(p.birthDate);
  const d = shortDate(p.deathDate);
  const out = [];
  if (b) out.push('° ' + b);
  if (d) out.push('† ' + d);
  else if (isDead(p)) out.push('†');
  return out.join('  ');
}

/** Âge actuel ou âge au décès, ou null si on ne peut pas le calculer. */
export function ageInfo(p) {
  const by = yearOf(p.birthDate);
  if (!by) return null;
  const bf = fullDate(p.birthDate);

  if (isDead(p)) {
    const dy = yearOf(p.deathDate);
    if (!dy) return null;
    const df = fullDate(p.deathDate);
    if (bf && df) {
      let a = df.y - bf.y;
      if (df.m < bf.m || (df.m === bf.m && df.d < bf.d)) a--;
      return { label: t('ageDeath'), text: t('years', a), dead: true };
    }
    return { label: t('ageDeath'), text: t('about', dy - by), dead: true };
  }

  const now = new Date();
  const approx = now.getFullYear() - by;
  if (approx > 105 || approx < 0) return null;
  if (bf) {
    let a = now.getFullYear() - bf.y;
    const mm = now.getMonth() + 1;
    const dd = now.getDate();
    if (mm < bf.m || (mm === bf.m && dd < bf.d)) a--;
    return { label: t('age'), text: t('years', a) };
  }
  return { label: t('age'), text: t('about', approx) };
}

/* ---------- Liens de parenté ---------- */

/** Recalcule les index enfants et conjoints à partir des personnes et des unions. */
export function reindex() {
  idx.children = new Map();
  idx.partners = new Map();

  const addPartner = (a, b, uid) => {
    if (!a || !b || a === b) return;
    let m = idx.partners.get(a);
    if (!m) {
      m = new Map();
      idx.partners.set(a, m);
    }
    m.set(b, uid || m.get(b) || null);
  };

  // Unions déclarées
  for (const [uid, u] of S.unions) {
    if (S.people.has(u.a) && S.people.has(u.b)) {
      addPartner(u.a, u.b, uid);
      addPartner(u.b, u.a, uid);
    }
  }

  // Enfants, et couples déduits des parents communs
  for (const [id, p] of S.people) {
    const seen = new Set();
    for (const key of ['fatherId', 'motherId']) {
      const parent = p[key];
      if (parent && parent !== id && S.people.has(parent) && !seen.has(parent)) {
        seen.add(parent);
        if (!idx.children.has(parent)) idx.children.set(parent, []);
        idx.children.get(parent).push(id);
      }
    }
    if (p.fatherId && p.motherId && S.people.has(p.fatherId) && S.people.has(p.motherId)) {
      addPartner(p.fatherId, p.motherId, null);
      addPartner(p.motherId, p.fatherId, null);
    }
  }

  for (const list of idx.children.values()) list.sort(byBirth);
}

export const childrenOf = (id) => idx.children.get(id) || [];

/** Conjoints, triés par date d'union. `uid` est null pour un couple déduit des enfants. */
export function partnersOf(id) {
  const m = idx.partners.get(id);
  if (!m) return [];
  const list = [...m].map(([pid, uid]) => ({ id: pid, uid }));
  const key = (x) => {
    if (!x.uid) return 99999;
    const u = S.unions.get(x.uid);
    return yearOf(u && u.date) || (u && u.createdAt ? 5000 : 9000);
  };
  return list.sort((a, b) => key(a) - key(b));
}

/** Frères et sœurs, avec la mention « même père » ou « même mère » pour les demi. */
export function siblingsOf(id) {
  const p = P(id);
  if (!p || (!p.fatherId && !p.motherId)) return [];
  const out = [];
  for (const [k, q] of S.people) {
    if (k === id) continue;
    const sameFather = !!p.fatherId && q.fatherId === p.fatherId;
    const sameMother = !!p.motherId && q.motherId === p.motherId;
    if (sameFather || sameMother) {
      let half = '';
      if (!(sameFather && sameMother) && p.fatherId && p.motherId && q.fatherId && q.motherId) {
        half = t(sameFather ? 'sameFather' : 'sameMother');
      }
      out.push({ id: k, half });
    }
  }
  return out.sort((a, b) => byBirth(a.id, b.id));
}

export function unionBetween(a, b) {
  for (const u of S.unions.values()) {
    if ((u.a === a && u.b === b) || (u.a === b && u.b === a)) return true;
  }
  return false;
}

function ancestorCount(id, gen, limit) {
  if (gen >= limit) return 0;
  const p = P(id);
  if (!p) return 0;
  let n = 0;
  for (const key of ['fatherId', 'motherId']) {
    const q = p[key];
    if (q && S.people.has(q)) n += 1 + ancestorCount(q, gen + 1, limit);
  }
  return n;
}

/** Personne à centrer par défaut : celle qui a le plus d'ancêtres connus sur 3 générations. */
export function defaultFocus() {
  let best = null;
  let bestScore = -1;
  let bestYear = -1;
  for (const [id, p] of S.people) {
    const score = ancestorCount(id, 0, 3);
    const y = yearOf(p.birthDate) || 0;
    if (score > bestScore || (score === bestScore && y > bestYear)) {
      best = id;
      bestScore = score;
      bestYear = y;
    }
  }
  return best;
}
