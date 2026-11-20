/**
 * Occupation translation: the value entered is free text, kept as is.
 * When displayed, an occupation known to this dictionary is shown in the chosen language;
 * a missing title, or one already in the right language, is unchanged.
 */
import { getLang } from '../i18n.js';
import { norm } from '../utils/helpers.js';

/** [masculine, feminine, English]; several French occupations may share an English word. */
const OCCUPATIONS = [
  ['Agriculteur', 'Agricultrice', 'Farmer'],
  ['Cultivateur', 'Cultivatrice', 'Farmer'],
  ['Ajusteur', 'Ajusteuse', 'Fitter'],
  ['Assistant social', 'Assistante sociale', 'Social worker'],
  ['Architecte', 'Architecte', 'Architect'],
  ['Artisan', 'Artisane', 'Craftsman'],
  ['Avocat', 'Avocate', 'Lawyer'],
  ['Banquier', 'Banquière', 'Banker'],
  ['Berger', 'Bergère', 'Shepherd'],
  ['Bijoutier', 'Bijoutière', 'Jeweller'],
  ['Bourrelier', 'Bourrelière', 'Saddler'],
  ['Cadre bancaire', 'Cadre bancaire', 'Bank executive'],
  ['Boucher', 'Bouchère', 'Butcher'],
  ['Boulanger', 'Boulangère', 'Baker'],
  ['Brasseur', 'Brasseuse', 'Brewer'],
  ['Charbonnier', 'Charbonnière', 'Charcoal burner'],
  ['Charcutier', 'Charcutière', 'Pork butcher'],
  ['Charpentier', 'Charpentière', 'Carpenter'],
  ['Charretier', 'Charretière', 'Carter'],
  ['Chauffeur', 'Chauffeuse', 'Driver'],
  ['Chef de projet informatique', 'Cheffe de projet informatique', 'IT project manager'],
  ['Cheminot', 'Cheminote', 'Railway worker'],
  ['Chirurgien', 'Chirurgienne', 'Surgeon'],
  ['Coiffeur', 'Coiffeuse', 'Hairdresser'],
  ['Commerçant', 'Commerçante', 'Shopkeeper'],
  ['Coach et formateur', 'Coach et formatrice', 'Coach and trainer'],
  ['Conseiller général', 'Conseillère générale', 'General councillor'],
  ['Comptable', 'Comptable', 'Accountant'],
  ['Cordonnier', 'Cordonnière', 'Shoemaker'],
  ['Couturier', 'Couturière', 'Dressmaker'],
  ['Curé', 'Curé', 'Parish priest'],
  ['Cuisinier', 'Cuisinière', 'Cook'],
  ['Dentiste', 'Dentiste', 'Dentist'],
  ['Domestique', 'Domestique', 'Servant'],
  ['Électricien', 'Électricienne', 'Electrician'],
  ['Embouteilleur de bière et de limonade', 'Embouteilleuse de bière et de limonade', 'Beer and lemonade bottler'],
  ['Employé', 'Employée', 'Clerk'],
  ['Enseignant', 'Enseignante', 'Teacher'],
  ['Épicier', 'Épicière', 'Grocer'],
  ['Facteur', 'Factrice', 'Postman'],
  ['Fermier', 'Fermière', 'Tenant farmer'],
  ['Forgeron', 'Forgeronne', 'Blacksmith'],
  ['Fonctionnaire', 'Fonctionnaire', 'Civil servant'],
  ['Garçon de labour', 'Fille de labour', 'Ploughman’s assistant'],
  ['Gendarme', 'Gendarme', 'Gendarme'],
  ['Greffier de la justice de paix', 'Greffière de la justice de paix', 'Clerk of the justice of the peace'],
  ['Horloger', 'Horlogère', 'Watchmaker'],
  ['Infirmier', 'Infirmière', 'Nurse'],
  ['Ingénieur', 'Ingénieure', 'Engineer'],
  ['Ingénieur intégration et déploiement continu', 'Ingénieure intégration et déploiement continu', 'Continuous integration and deployment engineer'],
  ['Ingénieur en informatique', 'Ingénieure en informatique', 'Software engineer'],
  ['Ingénieur d’étude et de développement', 'Ingénieure d’étude et de développement', 'Software development engineer'],
  ['Instituteur', 'Institutrice', 'Primary school teacher'],
  ['Jardinier', 'Jardinière', 'Gardener'],
  ['Journalier', 'Journalière', 'Day labourer'],
  ['Avocat en droit des contrats', 'Avocate en droit des contrats', 'Contracts lawyer'],
  ['Laboureur', 'Laboureuse', 'Ploughman'],
  ['Maire', 'Maire', 'Mayor'],
  ['Maçon', 'Maçonne', 'Mason'],
  ['Maréchal-ferrant', 'Maréchale-ferrante', 'Farrier'],
  ['Marin', 'Marin', 'Sailor'],
  ['Mécanicien', 'Mécanicienne', 'Mechanic'],
  ['Mécanicien automobile', 'Mécanicienne automobile', 'Car mechanic'],
  ['Médecin', 'Médecin', 'Doctor'],
  ['Docteur', 'Docteure', 'Doctor'],
  ['Docteur en médecine', 'Docteure en médecine', 'Doctor of medicine'],
  ['Menuisier', 'Menuisière', 'Joiner'],
  ['Meunier', 'Meunière', 'Miller'],
  ['Militaire', 'Militaire', 'Soldier'],
  ['Mineur', 'Mineuse', 'Miner'],
  ['Naturopathe et doula', 'Naturopathe et doula', 'Naturopath and doula'],
  ['Négociant en vin', 'Négociante en vin', 'Wine merchant'],
  ['Notaire', 'Notaire', 'Notary'],
  ['Ouvrier', 'Ouvrière', 'Worker'],
  ['Passementier', 'Passementière', 'Trimmings maker'],
  ['Percepteur', 'Perceptrice', 'Tax collector'],
  ['Pâtissier', 'Pâtissière', 'Pastry chef'],
  ['Pêcheur', 'Pêcheuse', 'Fisherman'],
  ['Peintre', 'Peintre', 'Painter'],
  ['Pharmacien', 'Pharmacienne', 'Pharmacist'],
  ['Plombier', 'Plombière', 'Plumber'],
  ['Policier', 'Policière', 'Police officer'],
  ['Professeur', 'Professeure', 'Teacher'],
  ['Propriétaire', 'Propriétaire', 'Landowner'],
  ['Retraité', 'Retraitée', 'Retired'],
  ['Sage-femme', 'Sage-femme', 'Midwife'],
  ['Sans profession', 'Sans profession', 'No occupation'],
  ['Secrétaire', 'Secrétaire', 'Secretary'],
  ['Serrurier', 'Serrurière', 'Locksmith'],
  ['Tailleur', 'Tailleuse', 'Tailor'],
  ['Tanneur', 'Tanneuse', 'Tanner'],
  ['Tisserand', 'Tisserande', 'Weaver'],
  ['Tonnelier', 'Tonnelière', 'Cooper'],
  ['Valet de labour', 'Servante de labour', 'Farmhand'],
  ['Vigneron', 'Vigneronne', 'Winegrower'],
  ['Visiteur médical', 'Visiteuse médicale', 'Medical visitor'],
];

/** Comparison key: no case, no accents, no extra spaces, one kind of apostrophe. */
const key = (s) => norm(s).trim().replace(/\s+/g, ' ').replace(/[’‘]/g, "'");

const FRENCH = new Map();
const ENGLISH = new Map();
for (const row of OCCUPATIONS) {
  for (const word of row.slice(0, 2)) if (!FRENCH.has(key(word))) FRENCH.set(key(word), row);
  if (!ENGLISH.has(key(row[2]))) ENGLISH.set(key(row[2]), row);
}

function translateWord(text, sex) {
  const k = key(text);
  if (getLang() === 'en') return !ENGLISH.has(k) && FRENCH.has(k) ? FRENCH.get(k)[2] : text;
  return !FRENCH.has(k) && ENGLISH.has(k) ? ENGLISH.get(k)[sex === 'F' ? 1 : 0] : text;
}

/** Offices held "of" a place: "Maire d’Eyburie" ↔ "Mayor of Eyburie" (other occupations: "de" isn't a place). */
const OF_PLACE = new Set(['maire', 'cure', 'mayor', 'parish priest']);

/** "de X", or "d’X" before a vowel or a mute h. */
const ofFr = (place) => (/^[aeiouyhâàéèêëîïôöûüœ]/i.test(place) ? `d’${place}` : `de ${place}`);

/**
 * A known occupation, possibly followed by its place: "Cultivateur à X" ↔ "Farmer in X",
 * "Maire d’X" ↔ "Mayor of X".
 */
function translate(text, sex) {
  const whole = translateWord(text, sex);
  if (whole !== text) return whole;
  const en = getLang() === 'en';
  const at = text.match(en ? /^(.+?)\s+à\s+(.+)$/i : /^(.+?)\s+in\s+(.+)$/i);
  if (at) {
    const job = translateWord(at[1], sex);
    if (job !== at[1]) return `${job} ${en ? 'in' : 'à'} ${at[2]}`;
  }
  const of = text.match(en ? /^(.+?)(?:\s+de\s+|\s+d['’]\s*)(.+)$/i : /^(.+?)\s+of\s+(.+)$/i);
  if (of && OF_PLACE.has(key(of[1]))) {
    const job = translateWord(of[1], sex);
    if (job !== of[1]) return en ? `${job} of ${of[2]}` : `${job} ${ofFr(of[2])}`;
  }
  return text;
}

/**
 * A person's occupation in the chosen language, each one of a list translated: "Maire, conseiller général"
 * gives "Mayor, General councillor"; "Baker / Boulanger" (the same in two languages) gives a single word.
 */
export function occupationLabel(p) {
  const sex = p && p.sex;
  const parts = String((p && p.occupation) || '').split('/')
    .map((x) => x.split(',').map((y) => translate(y.trim(), sex)).filter(Boolean).join(', ')).filter(Boolean);
  return [...new Map(parts.map((x) => [key(x), x])).values()].join(' / ');
}

/** Edit distance between `a` and `b`: insertions, deletions, substitutions, and two letters swapped ("tn" for "nt"). */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Every spelling of the dictionary, French (both sexes) and English. */
const SPELLINGS = [...new Set(OCCUPATIONS.flat())];

/** The dictionary spelling `part` is probably a typo of, or ''; known or too far from any: ''. */
function closest(part) {
  const k = key(part);
  if (k.length < 6 || FRENCH.has(k) || ENGLISH.has(k)) return '';
  const most = k.length >= 10 ? 2 : 1; // one letter in a short word, two in a long one
  let best = '';
  let bestD = most + 1;
  for (const word of SPELLINGS) {
    const d = distance(k, key(word));
    if (d < bestD) [best, bestD] = [word, d];
  }
  return best;
}

/**
 * The occupation with its probable typos put right ("Enseignatne" → "Enseignante"), each
 * occupation of a list on its own; '' when nothing looks misspelt.
 */
export function occupationTypoFix(text) {
  let changed = false;
  const fixed = String(text || '').split('/').map((x) => x.split(',').map((part) => {
    const word = closest(part);
    if (!word) return part.trim();
    changed = true;
    return word;
  }).join(', ')).join(' / ');
  return changed ? fixed : '';
}
