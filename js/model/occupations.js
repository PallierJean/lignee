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
  ['Architecte', 'Architecte', 'Architect'],
  ['Artisan', 'Artisane', 'Craftsman'],
  ['Avocat', 'Avocate', 'Lawyer'],
  ['Banquier', 'Banquière', 'Banker'],
  ['Berger', 'Bergère', 'Shepherd'],
  ['Bijoutier', 'Bijoutière', 'Jeweller'],
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
  ['Comptable', 'Comptable', 'Accountant'],
  ['Cordonnier', 'Cordonnière', 'Shoemaker'],
  ['Couturier', 'Couturière', 'Dressmaker'],
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
  ['Horloger', 'Horlogère', 'Watchmaker'],
  ['Infirmier', 'Infirmière', 'Nurse'],
  ['Ingénieur', 'Ingénieure', 'Engineer'],
  ['Ingénieur intégration et déploiement continu', 'Ingénieure intégration et déploiement continu', 'Continuous integration and deployment engineer'],
  ['Instituteur', 'Institutrice', 'Primary school teacher'],
  ['Jardinier', 'Jardinière', 'Gardener'],
  ['Journalier', 'Journalière', 'Day labourer'],
  ['Avocat en droit des contrats', 'Avocate en droit des contrats', 'Contracts lawyer'],
  ['Laboureur', 'Laboureuse', 'Ploughman'],
  ['Maçon', 'Maçonne', 'Mason'],
  ['Maréchal-ferrant', 'Maréchale-ferrante', 'Farrier'],
  ['Marin', 'Marin', 'Sailor'],
  ['Mécanicien', 'Mécanicienne', 'Mechanic'],
  ['Médecin', 'Médecin', 'Doctor'],
  ['Menuisier', 'Menuisière', 'Joiner'],
  ['Meunier', 'Meunière', 'Miller'],
  ['Militaire', 'Militaire', 'Soldier'],
  ['Mineur', 'Mineuse', 'Miner'],
  ['Négociant en vin', 'Négociante en vin', 'Wine merchant'],
  ['Notaire', 'Notaire', 'Notary'],
  ['Ouvrier', 'Ouvrière', 'Worker'],
  ['Passementier', 'Passementière', 'Trimmings maker'],
  ['Pâtissier', 'Pâtissière', 'Pastry chef'],
  ['Pêcheur', 'Pêcheuse', 'Fisherman'],
  ['Peintre', 'Peintre', 'Painter'],
  ['Pharmacien', 'Pharmacienne', 'Pharmacist'],
  ['Plombier', 'Plombière', 'Plumber'],
  ['Policier', 'Policière', 'Police officer'],
  ['Professeur', 'Professeure', 'Teacher'],
  ['Retraité', 'Retraitée', 'Retired'],
  ['Sage-femme', 'Sage-femme', 'Midwife'],
  ['Sans profession', 'Sans profession', 'No occupation'],
  ['Secrétaire', 'Secrétaire', 'Secretary'],
  ['Serrurier', 'Serrurière', 'Locksmith'],
  ['Tailleur', 'Tailleuse', 'Tailor'],
  ['Tanneur', 'Tanneuse', 'Tanner'],
  ['Tisserand', 'Tisserande', 'Weaver'],
  ['Tonnelier', 'Tonnelière', 'Cooper'],
  ['Vigneron', 'Vigneronne', 'Winegrower'],
  ['Visiteur médical', 'Visiteuse médicale', 'Medical visitor'],
];

/** Comparison key: no case, no accents, no extra spaces. */
const key = (s) => norm(s).trim().replace(/\s+/g, ' ');

const FRENCH = new Map();
const ENGLISH = new Map();
for (const row of OCCUPATIONS) {
  for (const word of row.slice(0, 2)) if (!FRENCH.has(key(word))) FRENCH.set(key(word), row);
  if (!ENGLISH.has(key(row[2]))) ENGLISH.set(key(row[2]), row);
}

function translate(text, sex) {
  const k = key(text);
  if (getLang() === 'en') return !ENGLISH.has(k) && FRENCH.has(k) ? FRENCH.get(k)[2] : text;
  return !FRENCH.has(k) && ENGLISH.has(k) ? ENGLISH.get(k)[sex === 'F' ? 1 : 0] : text;
}

/** A person's occupation in the chosen language; "Baker / Boulanger" gives a single word. */
export function occupationLabel(p) {
  const parts = String((p && p.occupation) || '').split('/').map((x) => translate(x.trim(), p && p.sex)).filter(Boolean);
  return [...new Map(parts.map((x) => [key(x), x])).values()].join(' / ');
}
