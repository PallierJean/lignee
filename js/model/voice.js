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
- "edit": facts about a person already in the tree; "who" = their name, "person" = only the facts said.
- "unknown": anything else.
person: given (first names), surname, sex ("M" or "F", from the words used, e.g. "née", "fille", "il"),
birthDate, birthPlace, deathDate, deathPlace, occupation. Dates as said ("12 mars 1820", "vers 1850", "1901").
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
  person.sex = person.sex.toUpperCase();
  if (!['M', 'F'].includes(person.sex)) person.sex = '';
  if (relation === 'father') person.sex = 'M';
  if (relation === 'mother') person.sex = 'F';
  const who = str(o.who);
  // A command that names no one can't be carried out
  if ((action === 'search' || action === 'open' || action === 'edit') && !who) return { action: 'unknown', who: '', relation: '', person: blank() };
  if (action === 'add' && !person.given && !person.surname) return { action: 'unknown', who: '', relation: '', person: blank() };
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

const PARTICLES = new Set(['de', 'du', 'des', 'le', 'la', 'van', 'von', 'da', 'di', "d'", 'd’']);
/** Capitals at the start of each word, except particles inside a name ("Marie de la Borie"). */
const cap = (s) => s.split(' ').map((w, i) => (i && PARTICLES.has(w.toLowerCase()) ? w.toLowerCase()
  : w.replace(/(^|-)(\p{L})/gu, (all, sep, l) => sep + l.toUpperCase()))).join(' ');

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
  ['birth', new RegExp(String.raw`\b(?:n[ée]e?|born)\s+${DATE}${PLACE}(?=[,;.]|\s+(?:et|and|mort|morte|d[ée]c[ée]d[ée]e?|died|fils|fille|enfant|p[eè]re|m[eè]re|qui)\b|$)`, 'i')],
  ['death', new RegExp(String.raw`\b(?:mort|morte|d[ée]c[ée]d[ée]e?|died)\s+${DATE}${PLACE}(?=[,;.]|\s+(?:et|and|n[ée]e?|born|fils|fille|enfant|qui)\b|$)`, 'i')],
];

/** Birth and death said in `text`: fields of a person, and `text` without them. */
function facts(text) {
  const person = {};
  let rest = text;
  for (const [kind, re] of FACTS) {
    const m = re.exec(rest);
    if (!m) continue;
    person[kind + 'Date'] = m[1].replace(/^(le|en|on|in) /i, '');
    if (m[2]) person[kind + 'Place'] = cap(m[2].trim());
    if (/^(n[ée]e|morte|d[ée]c[ée]d[ée]e)\b/i.test(m[0])) person.sex = 'F';
    else if (!person.sex && /^(n[ée]|mort|d[ée]c[ée]d[ée])\b/i.test(m[0])) person.sex = 'M';
    rest = rest.replace(m[0], ' ');
  }
  const job = /\b(?:il|elle)?\s*(?:[ée]tait|est|was)\s+(?!n[ée]e?\b|mort|d[ée]c[ée]d)([a-zéèêàç-]+(?: [a-zéèêàç-]+)?)\s*$/i.exec(rest.replace(/[,;.\s]+$/, ''));
  if (job) {
    person.occupation = job[1];
    rest = rest.replace(job[0], ' ');
  }
  return { person, rest: rest.replace(/\s*[,;]\s*/g, ' ').replace(/\s+/g, ' ').trim() };
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
  // "Anne Lacoste, fille de Marguerite Maury", "Pierre Lacoste est le père de Jean Lacoste"
  m = new RegExp(String.raw`^(.+?)\s*,?\s+(?:(?:est|était|is|was)\s+)?(?:le |la |un |une |l['’]|the |a )?(${KIN_RE})\s+(?:de |d['’]|of )(.+)$`, 'i').exec(body);
  if (m) {
    // The relative's name ends where the facts about the new person start
    const tail = facts(m[3]);
    const head = facts(m[1]);
    return relative(m[1], kinOf(m[2]), tail.rest, { ...head.person, ...tail.person }, head.rest);
  }
  if (add) {
    const { person, rest } = facts(body);
    // More than a name: a sentence for the language model
    if (rest.split(' ').length > 4) return cleanCommand({});
    return cleanCommand({ action: 'add', person: { ...splitName(rest), ...person } });
  }
  // "Génie Desgorces est morte vers 1890"
  m = /^(.+?)\s+(?:est|était|is|was)\s+((?:n[ée]e?|mort|morte|d[ée]c[ée]d[ée]e?|born|died)\b.*)$/i.exec(s);
  if (m) {
    const { person } = facts(m[2]);
    if (Object.keys(person).length) return cleanCommand({ action: 'edit', who: m[1], person: { ...person, sex: '' } });
  }
  // "Jean Maury était cultivateur"
  m = /^(.+?)\s+(?:était|est|was|is)\s+(?:un |une |a |an )?([\p{L}-]+(?: [\p{L}-]+)?)$/iu.exec(s);
  if (m) return cleanCommand({ action: 'edit', who: m[1], person: { occupation: m[2] } });
  return cleanCommand({});
}

/** A new relative: `kin` = { relation, sex } of the new person, named `name` (with its facts). */
function relative(name, kin, who, known = null, cleanName = null) {
  const { person, rest } = known ? { person: known, rest: cleanName } : facts(name);
  const sex = person.sex || kin.sex;
  return cleanCommand({ action: 'add', who: facts(who).rest, relation: kin.relation, person: { ...splitName(rest), ...person, sex } });
}
