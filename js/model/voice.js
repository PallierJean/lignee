/**
 * Voice commands: what a spoken sentence asks for, as a command the application can carry out.
 *
 * A command: { action, who, relation, person }
 * - action: 'search' (find people), 'open' (show a record), 'add' (a new person),
 *   'edit' (change a person), or 'unknown';
 * - who: the name of the person already in the tree that the sentence speaks of (the one to open,
 *   to change, or whose relative is added), or the words to search for;
 * - relation (add): what the new person is to `who`: father, mother, child, spouse, sibling;
 * - person: the fields said (add, edit): given, surname, sex, birthDate, birthPlace, deathDate,
 *   deathPlace, occupation. Dates are kept as said ("12 mars 1820", "vers 1850"): the form reads them.
 *
 * A language model understands free sentences (on this computer with Ollama, or in the browser);
 * without one, `parseCommand` recognises a few fixed sentences. Pure: used by the page and server.js.
 */

export const ACTIONS = ['search', 'open', 'add', 'edit', 'unknown'];
export const RELATIONS = ['father', 'mother', 'child', 'spouse', 'sibling'];
export const FIELDS = ['given', 'surname', 'sex', 'birthDate', 'birthPlace', 'deathDate', 'deathPlace', 'occupation'];

const str = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const blank = () => Object.fromEntries(FIELDS.map((f) => [f, '']));
const UNKNOWN = () => ({ action: 'unknown', who: '', relation: '', person: blank() });

// Word edges that know accented letters (\b doesn't: "né" never ended a word)
const L = String.raw`(?<![\p{L}\d])`;
const R = String.raw`(?![\p{L}\d])`;

const PARTICLES = new Set(['de', 'du', 'des', 'le', 'la', 'van', 'von', 'da', 'di', "d'", 'd’']);
// Small words kept in lower case inside a name or a place ("Saint-Pierre-de-Chignac", "Hautefort en Dordogne")
const LOWER = new Set([...PARTICLES, 'en', 'sur', 'sous', 'lès', 'lez', 'les', 'aux', 'au', 'et']);
const capWord = (w) => w.split('-').map((part, j) => (j && LOWER.has(part.toLowerCase()) ? part.toLowerCase()
  : part.replace(/^\p{L}/u, (l) => l.toUpperCase()))).join('-');
/** Capitals at the start of each word, except small words inside a name ("Marie de la Borie"). */
const cap = (s) => s.split(' ').map((w, i) => (i && LOWER.has(w.toLowerCase()) ? w.toLowerCase() : capWord(w))).join(' ');
/** Only a text said all in lower case gets capitals: a casing chosen by the speaker stays. */
const capLower = (s) => (s && s === s.toLowerCase() ? cap(s) : s);

/**
 * A date as the form reads it: "le 3 mai 1872" → "3 mai 1872", "vers le 1er mai 1850" → "vers 1 mai 1850",
 * "en 1901" → "1901".
 */
export function cleanDate(s) {
  return str(s).replace(/[.,;]+$/, '')
    .replace(/^(?:(vers|avant|apr[eè]s|about|before|after)\s+)?(?:le|en|on|in|the)\s+/i, (all, q) => (q ? q + ' ' : ''))
    .replace(new RegExp(String.raw`${L}premier${R}`, 'iu'), '1')
    .replace(new RegExp(String.raw`${L}(\d{1,2})(?:er|st|nd|rd|th)${R}`, 'iu'), '$1');
}

/** JSON schema of a command, for the language model's constrained output. */
export const SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ACTIONS },
    who: { type: 'string' },
    relation: { type: 'string', enum: ['', ...RELATIONS] },
    person: {
      type: 'object',
      properties: Object.fromEntries(FIELDS.map((f) => [f, f === 'sex' ? { type: 'string', enum: ['', 'M', 'F'] } : { type: 'string' }])),
      required: FIELDS,
      additionalProperties: false,
    },
  },
  required: ['action', 'who', 'relation', 'person'],
  additionalProperties: false,
};

const EXAMPLES = [
  ['cherche les Maury nés à Hautefort', { action: 'search', who: 'Maury Hautefort' }],
  ['ouvre la fiche de Jean Lacoste', { action: 'open', who: 'Jean Lacoste' }],
  ['ajoute Anne Lacoste, née le 3 mai 1872 à Hautefort, fille de Marguerite Maury',
    { action: 'add', who: 'Marguerite Maury', relation: 'child', person: { given: 'Anne', surname: 'Lacoste', sex: 'F', birthDate: '3 mai 1872', birthPlace: 'Hautefort' } }],
  ['Pierre Lacoste est le père de Jean Lacoste, il était cultivateur',
    { action: 'add', who: 'Jean Lacoste', relation: 'father', person: { given: 'Pierre', surname: 'Lacoste', sex: 'M', occupation: 'cultivateur' } }],
  ['Odette a eu une fille, Anne Morel, en 1960', { action: 'add', who: 'Odette', relation: 'child', person: { given: 'Anne', surname: 'Morel', sex: 'F', birthDate: '1960' } }],
  ['Génie Desgorces est morte vers 1890 à la Borie', { action: 'edit', who: 'Génie Desgorces', person: { deathDate: 'vers 1890', deathPlace: 'la Borie' } }],
  ['ajoute une personne : Louis Martin, né en 1901', { action: 'add', person: { given: 'Louis', surname: 'Martin', sex: 'M', birthDate: '1901' } }],
  ['le père de Jean Lacoste s\'appelle Pierre Lacoste', { action: 'add', who: 'Jean Lacoste', relation: 'father', person: { given: 'Pierre', surname: 'Lacoste', sex: 'M' } }],
  ['Paul Maury, fils de Pierre Maury et de Marie Dupont, est né le 1er mai 1880', { action: 'add', who: 'Pierre Maury', relation: 'child', person: { given: 'Paul', surname: 'Maury', sex: 'M', birthDate: '1 mai 1880' } }],
];

/** Instructions for the language model. */
export const PROMPT = `You turn a sentence spoken to a family tree application into one JSON command.
The sentence is usually in French, sometimes in English. Keep names, places and dates exactly as said.

action:
- "search": find people; "who" = the words to look for (names, places).
- "open": show the record of one person; "who" = their name.
- "add": a new person; "person" = what is said about them. If they are the relative of someone,
  "who" = that someone's name and "relation" = what the NEW person is to them:
  "father", "mother", "child" (son, daughter), "spouse" (husband, wife), "sibling" (brother, sister).
  "X a eu un fils / une fille Y" means Y is the child of X: who = X, relation = "child".
  With two parents named, "who" = the first one.
- "edit": facts about a person already in the tree; "who" = their name, "person" = only the facts said.
- "unknown": anything else.
person: given (first names), surname, sex ("M" or "F", from the words used, e.g. "née", "fille", "il"),
birthDate, birthPlace, deathDate, deathPlace, occupation. Dates without "le" or "en": "12 mars 1820", "1 mai 1880"
(not "1er"), "vers 1850", "1901". A place is only the town ("à Hautefort" → "Hautefort").
Leave unsaid fields empty (""). Never invent anything.

Examples:
${EXAMPLES.map(([s, c]) => `"${s}" → ${JSON.stringify(cleanCommand(c))}`).join('\n')}`;

/** A command, with only known values (from a language model, which may stray). */
export function cleanCommand(c) {
  const o = c && typeof c === 'object' ? c : {};
  const action = ACTIONS.includes(o.action) ? o.action : 'unknown';
  const relation = action === 'add' && RELATIONS.includes(o.relation) ? o.relation : '';
  const p = o.person && typeof o.person === 'object' ? o.person : {};
  const person = Object.fromEntries(FIELDS.map((f) => [f, str(p[f])]));
  for (const f of ['birthDate', 'deathDate']) person[f] = cleanDate(person[f]);
  for (const f of ['given', 'surname', 'birthPlace', 'deathPlace']) person[f] = capLower(person[f]);
  person.sex = person.sex.toUpperCase();
  if (!['M', 'F'].includes(person.sex)) person.sex = '';
  if (relation === 'father') person.sex = 'M';
  if (relation === 'mother') person.sex = 'F';
  const who = str(o.who);
  // A command that names no one can't be carried out
  if ((action === 'search' || action === 'open' || action === 'edit') && !who) return UNKNOWN();
  if (action === 'add' && !person.given && !person.surname) return UNKNOWN();
  return { action, who, relation, person };
}


/** The command as JSON text from a language model: the command, or null if it isn't JSON. */
export function commandFromText(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return cleanCommand(JSON.parse(m[0]));
  } catch (e) {
    return null;
  }
}

/* ---------- Fixed sentences, without a language model ---------- */

/** "anne marie lacoste" → { given: 'Anne Marie', surname: 'Lacoste' }; "de la borie": particles go with the surname. */
export function splitName(name) {
  const words = str(name).replace(/[.,;:!?]+$/, '').split(' ').filter(Boolean);
  if (words.length < 2) return { given: cap(words[0] || ''), surname: '' };
  let i = words.length - 1;
  while (i > 1 && PARTICLES.has(words[i - 1].toLowerCase())) i--;
  return { given: cap(words.slice(0, i).join(' ')), surname: cap(words.slice(i).join(' ')) };
}

// Relatives, as said: [words, relation, sex]
const KIN = [
  ['p[eè]re|father', 'father', 'M'], ['m[eè]re|mother', 'mother', 'F'],
  ['fils?|son', 'child', 'M'], ['fille|daughter', 'child', 'F'], ['enfant|child', 'child', ''],
  ['mari|[eé]poux|husband', 'spouse', 'M'], ['femme|[eé]pouse|wife', 'spouse', 'F'], ['conjoint|conjointe|spouse', 'spouse', ''],
  ['fr[eè]re|brother', 'sibling', 'M'], ['s(?:œ|oe)ur|sister', 'sibling', 'F'],
];
const KIN_RE = KIN.map(([w]) => w).join('|');
const kinOf = (word) => {
  const k = KIN.find(([w]) => new RegExp(`^(?:${w})$`, 'i').test(word));
  return k ? { relation: k[1], sex: k[2] } : null;
};

const DATE = String.raw`(?:le |en |on |in )?((?:vers |avant |après |about |before |after )?(?:\d{1,2}(?:er)? )?(?:[a-zéû]+ )?\d{4}|\d{1,2}\/\d{1,2}\/\d{4})`;
const PLACE = String.raw`(?: (?:à|a|au|en|at|in) ([^,;.]+?))?`;
const FACTS = [
  ['birth', new RegExp(String.raw`${L}(?:n[ée]e?|born)\s+${DATE}${PLACE}(?=[,;.]|\s+(?:et|and|il|elle|he|she|mort|morte|d[ée]c[ée]d[ée]e?|died|fils|fille|enfant|p[eè]re|m[eè]re|qui)${R}|$)`, 'iu')],
  ['death', new RegExp(String.raw`${L}(?:mort|morte|d[ée]c[ée]d[ée]e?|died)\s+${DATE}${PLACE}(?=[,;.]|\s+(?:et|and|il|elle|he|she|n[ée]e?|born|fils|fille|enfant|qui)${R}|$)`, 'iu')],
];
const FEMININE = new RegExp(String.raw`^(?:n[ée]e|morte|d[ée]c[ée]d[ée]e)${R}`, 'iu');
const MASCULINE = new RegExp(String.raw`^(?:n[ée]|mort|d[ée]c[ée]d[ée])${R}`, 'iu');
const JOB = new RegExp(String.raw`(?:${L}(?:il|elle|he|she)\s+)?${L}(?:[ée]tait|est|was)\s+(?!n[ée]e?${R}|mort|d[ée]c[ée]d)([\p{L}-]+(?: [\p{L}-]+)?)\s*$`, 'iu');
// Words that can't be part of a name: the sentence says more than a name
const NOT_NAME = new RegExp(String.raw`${L}(?:et|and|qui|who|est|était|is|was|a|eu|has|had|s['’]appel\p{L}*|appel[ée]e?|named|called|n[ée]e?|mort|morte)${R}|\d`, 'iu');
const ARTICLE = /^(?:le|la|les|l['’]|un|une|the|a|an)(?:\s|$)/i;
/** Could `s` be the name of a person? One to five words, not starting with an article, nothing else. */
const isName = (s) => { const n = str(s).split(' ').filter(Boolean).length; return n >= 1 && n <= 5 && !NOT_NAME.test(s) && !ARTICLE.test(str(s)); };

/** Birth and death said in `text`: fields of a person, and `text` without them (`raw`: commas kept). */
function facts(text) {
  const person = {};
  let rest = text;
  for (const [kind, re] of FACTS) {
    const m = re.exec(rest);
    if (!m) continue;
    person[kind + 'Date'] = m[1].replace(/^(le|en|on|in) /i, '');
    if (m[2]) person[kind + 'Place'] = cap(m[2].trim());
    if (FEMININE.test(m[0])) person.sex = 'F';
    else if (!person.sex && MASCULINE.test(m[0])) person.sex = 'M';
    rest = rest.replace(m[0], ' ');
  }
  const job = JOB.exec(rest.replace(/[,;.\s]+$/, ''));
  if (job) {
    person.occupation = job[1];
    rest = rest.replace(job[0], ' ');
  }
  return { person, raw: rest, rest: rest.replace(/\s*[,;]\s*/g, ' ').replace(/\s+/g, ' ').trim() };
}

/**
 * The command said with a few fixed sentences (French, English), or the 'unknown' command:
 * "cherche …", "ouvre (la fiche de) …", "ajoute (une personne) …[, fille de …]",
 * "ajoute le père de … : …", "… est le fils de …", "… est né(e) / mort(e) …".
 */
export function parseCommand(sentence) {
  const s = str(sentence).replace(/[.!?]+$/, '');
  let m;
  if ((m = /^(?:cherche|recherche|trouve|search(?: for)?|find)\s+(.+)$/i.exec(s))) return cleanCommand({ action: 'search', who: m[1] });
  if ((m = /^(?:ouvre|affiche|montre|va (?:à|a|sur)|open|show)\s+(?:la fiche (?:de |d['’])|the record of )?(.+)$/i.exec(s))) return cleanCommand({ action: 'open', who: m[1] });

  // "ajoute le père de Jean Lacoste : Pierre Lacoste", "ajoute un fils à Jean Lacoste : Paul"
  m = new RegExp(String.raw`^(?:ajoute|add)\s+(?:le |la |un |une |l['’]|the |a |an )?(${KIN_RE})\s+(?:de |d['’]|à |a |au |of |to )(.+?)\s*[:,]\s*(.+)$`, 'i').exec(s);
  if (m) return relative(m[3], kinOf(m[1]), m[2]);

  // ("ajoute à …": Whisper sometimes hears a stray "à")
  const add = /^(?:ajoute|ajouter|add)\s+(?:une personne|quelqu['’]un|a person|someone)?\s*:?\s*(?:(?:à|a)\s+)?(.+)$/i.exec(s);
  const body = add ? add[1] : s;
  // "le père de Jean Lacoste s'appelle Pierre Lacoste", "… est Pierre Lacoste" (a name: a capital, as Whisper writes it)
  m = new RegExp(String.raw`^(?:le |la |l['’]|the )?(${KIN_RE})\s+(?:de |d['’]|of )(.+?)\s+(?:(?:s['’]appel\p{L}*|is called|was called|is named|was named)\s+(.+)|(?:est|était|is|was)\s+(.+))$`, 'iu').exec(body);
  if (m && (m[3] || /^\p{Lu}/u.test(m[4]))) return relative(m[3] || m[4], kinOf(m[1]), m[2]);
  // "Jean Lacoste a pour père Pierre Lacoste", "Jean Lacoste a un frère, Paul", "… a une sœur qui s'appelle Marie"
  m = new RegExp(String.raw`^(.+?)\s+(?:a|avait|has|had)\s+(?:pour |comme |un |une |a |an )(${KIN_RE})\s*[,:]?\s+(?:(?:qui\s+)?s['’]appel\p{L}*\s+|named |called )?(.+)$`, 'iu').exec(body);
  if (m) return relative(m[3], kinOf(m[2]), m[1]);
  // "Anne Lacoste, fille de Marguerite Maury", "Pierre Lacoste est le père de Jean Lacoste"
  m = new RegExp(String.raw`^(.+?)\s*,?\s+(?:(?:est|était|is|was)\s+)?(?:(?:comme|as)\s+)?(?:le |la |un |une |l['’]|the |a )?(${KIN_RE})\s+(?:de |d['’]|of )(.+)$`, 'iu').exec(body);
  if (m) {
    // The relative's name ends where the facts about the new person start
    const tail = facts(m[3]);
    const head = facts(m[1]);
    return relative(m[1], kinOf(m[2]), tail.rest, { ...head.person, ...tail.person }, head.rest);
  }
  if (add) {
    const { person, raw } = facts(body);
    const [name = '', ...more] = raw.split(/\s*[,;:]\s*/).map(str).filter(Boolean);
    // "Louis Martin, cultivateur": a word or two after the name, the occupation
    if (more.length === 1 && !person.occupation && more[0].split(' ').length <= 2 && !/^(?:à|a|au|aux|en|le|la|les|de|du|des|in|at|the)\s/i.test(more[0]) && !NOT_NAME.test(more[0])) {
      person.occupation = more.pop();
    }
    // More than a name: a sentence for the language model
    if (more.length || !isName(name)) return UNKNOWN();
    return cleanCommand({ action: 'add', person: { ...splitName(name), ...person } });
  }
  // "Génie Desgorces est morte vers 1890"
  m = new RegExp(String.raw`^(.+?)\s+(?:est|était|is|was)\s+((?:n[ée]e?|mort|morte|d[ée]c[ée]d[ée]e?|born|died)${R}.*)$`, 'iu').exec(s);
  if (m && isName(m[1])) {
    const { person } = facts(m[2]);
    if (Object.keys(person).length) return cleanCommand({ action: 'edit', who: m[1], person: { ...person, sex: '' } });
  }
  // "Jean Maury était cultivateur"
  m = /^(.+?)\s+(?:était|est|was|is)\s+(?:un |une |a |an )?([\p{L}-]+(?: [\p{L}-]+)?)$/iu.exec(s);
  if (m && isName(m[1])) return cleanCommand({ action: 'edit', who: m[1], person: { occupation: m[2] } });
  return UNKNOWN();
}

/**
 * A new relative: `kin` = { relation, sex } of the new person, named `name` (with its facts).
 * Two parents said ("fils de Pierre Maury et de Marie Dupont"): the first one; the form proposes their spouse.
 * Anything else than names: the language model.
 */
function relative(name, kin, who, known = null, cleanName = null) {
  const { person, rest } = known ? { person: known, rest: cleanName } : facts(name);
  const of = facts(who).rest.split(/\s+(?:et|and)\s+(?:de\s+|d['’]\s*|of\s+)?/i)[0];
  if (!isName(rest) || !isName(of)) return UNKNOWN();
  const sex = person.sex || kin.sex;
  return cleanCommand({ action: 'add', who: of, relation: kin.relation, person: { ...splitName(rest), ...person, sex } });
}

/* ---------- The answer once the form is filled in ---------- */

const plain = (s) => str(s).toLowerCase().replace(/’/g, "'").replace(/[.,;:!?«»"]+/g, ' ').replace(/\s+/g, ' ').trim();
// Longest first: "c'est bon" before "c'est"
const phrases = (list) => list.sort((a, b) => b.length - a.length).map((w) => w.replace(/[-\s]/g, '[-\\s]'));
const YES = phrases(['oui', 'ouais', 'ok', 'okay', "d'accord", "c'est bon", "c'est ça", "c'est parfait", 'parfait', 'exact', 'exactement',
  'valide', 'valider', 'validé', 'validée', 'enregistre', 'enregistrer', 'enregistré', 'sauvegarde', 'sauvegarder', 'confirme', 'confirmer',
  'vas-y', 'yes', 'yeah', 'save', 'confirm', 'correct', "that's right", 'go ahead', 'right']);
const NO = phrases(['non', 'nan', 'annule', 'annuler', 'annulé', 'laisse tomber', 'oublie', 'arrête', 'ferme', 'pas du tout',
  'no', 'nope', 'cancel', 'never mind', 'stop']);
const FILLER = phrases(['merci', 'tu peux', 'la fiche', 'le formulaire', "s'il te plaît", "s'il vous plaît", 'please', 'thanks', 'thank you', 'it', 'et', 'and', 'mais', 'but']);
const START = (list) => new RegExp(`^(?:${list.join('|')})(?=\\s|$)\\s*`, 'iu');
const YES_START = START(YES);
const NO_START = START(NO);
const FILLER_START = START(FILLER);
const LEAD = new RegExp(`^[\\s,.;:!?«»"]*(?:${[...YES, ...NO, ...FILLER].join('|')})(?=[\\s,.;:!?]|$)[\\s,.;:!?]*`, 'iu');

/** Words said only made of `start` phrases (and polite words): true; anything else: false. */
function only(s, start) {
  let rest = s;
  let seen = false;
  for (let i = 0; i < 12 && rest; i++) {
    const m = start.exec(rest) || FILLER_START.exec(rest);
    if (!m) return false;
    if (start.test(rest)) seen = true;
    rest = rest.slice(m[0].length);
  }
  return seen && !rest;
}

/**
 * The answer to "Save?": { reply: 'yes' } (save), { reply: 'no' } (cancel), or { reply: 'more', rest }:
 * something to add to the form ("non, née en 1873", "oui et elle était couturière", "née en 1873").
 */
export function parseReply(text) {
  const s = plain(text);
  if (only(s, YES_START)) return { reply: 'yes', rest: '' };
  if (only(s, NO_START)) return { reply: 'no', rest: '' };
  // A yes or a no followed by more: the more, to add
  let rest = str(text).replace(/’/g, "'");
  for (let i = 0; i < 6; i++) {
    const m = LEAD.exec(rest);
    if (!m || !m[0]) break;
    rest = rest.slice(m[0].length);
  }
  return { reply: 'more', rest: str(rest) };
}

/**
 * Facts said about the person whose form is open: "née le 3 mai 1873 à Hautefort", "elle était couturière",
 * "il est mort en 1950", "elle s'appelle Anne Marie". Only the fields said; {} if none.
 * `surname`: the one in the form: "elle s'appelle Anne Marie Lacoste" ends with it, the rest are first names.
 */
export function parseDetails(text, { surname = '' } = {}) {
  let s = str(text).replace(/[.!?]+$/, '');
  const person = {};
  const named = new RegExp(String.raw`(?:^|\s)(?:(?:il|elle|he|she)\s+)?(?:s['’]appel\p{L}*|is called|is named)\s+(\p{L}[\p{L}' -]*?)(?=[,;]|$)`, 'iu').exec(s);
  if (named) {
    const name = cap(str(named[1]));
    const last = surname && new RegExp(`\\s+${surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'iu').exec(name);
    if (last) Object.assign(person, { given: name.slice(0, last.index), surname: name.slice(last.index).trim() });
    else person.given = name;
    s = s.replace(named[0], ' ');
  }
  const first = /(?:son |her |his )(prénom|nom|first name|surname|last name)\s+(?:est|is|c['’]est)\s+([\p{L}' -]+?)(?=[,;]|$)/iu.exec(s);
  if (first) {
    person[/pr[ée]nom|first/i.test(first[1]) ? 'given' : 'surname'] = cap(str(first[2]));
    s = s.replace(first[0], ' ');
  }
  // "elle est née …": "est" is only the tense
  const found = facts(s.replace(new RegExp(String.raw`${L}(?:est|était|is|was)\s+(?=n[ée]e?${R}|mort|d[ée]c[ée]d|born|died)`, 'giu'), ''));
  Object.assign(person, found.person);
  delete person.sex;
  for (const f of ['birthDate', 'deathDate']) if (person[f]) person[f] = cleanDate(person[f]);
  return Object.fromEntries(Object.entries(person).filter(([f, v]) => FIELDS.includes(f) && v));
}
