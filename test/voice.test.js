import assert from 'node:assert/strict';
import { test, describe, before, after } from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseCommand, cleanCommand, cleanDate, commandFromText, splitName, parseReply, parseDetails, parseChoice, isGoodbye, isNoise, soundKey, fixName, SCHEMA, PROMPT, FIELDS } from '../js/model/voice.js';
import { createServer } from '../server.js';
import { loadTree, person, resetApp } from './helpers.js';

/** Only the fields said, to compare commands simply. */
const said = ({ union, ...c }) => ({
  ...c,
  person: Object.fromEntries(Object.entries(c.person).filter(([, v]) => v)),
  ...(union && (union.type || union.date || union.place) ? { union: Object.fromEntries(Object.entries(union).filter(([, v]) => v)) } : {}),
});

describe('voix : phrases connues', () => {
  test('chercher, ouvrir', () => {
    assert.deepEqual(said(parseCommand('Cherche Maury.')), { action: 'search', who: 'Maury', relation: '', person: {} });
    assert.deepEqual(said(parseCommand('ouvre la fiche de Jean Lacoste')), { action: 'open', who: 'Jean Lacoste', relation: '', person: {} });
    assert.equal(parseCommand('open the record of Jean Lacoste').who, 'Jean Lacoste');
  });

  test('ajouter une personne, avec naissance et décès', () => {
    assert.deepEqual(said(parseCommand('ajoute une personne : Louis Martin né en 1901 à Paris, mort le 2 mars 1980')), {
      action: 'add', who: '', relation: '',
      person: { given: 'Louis', surname: 'Martin', sex: 'M', birthDate: '1901', birthPlace: 'Paris', deathDate: '2 mars 1980' },
    });
    assert.deepEqual(said(parseCommand('ajoute Marie de la Borie née vers 1820')).person, { given: 'Marie', surname: 'De la Borie', sex: 'F', birthDate: 'vers 1820' });
  });

  test('ajouter un parent : « fille de », « est le père de », « ajoute le père de … : … », « fil » entendu pour « fils »', () => {
    assert.deepEqual(said(parseCommand('Ajoute à Anne Lacoste, née le 3 mai 1872 à Hautefort, fille de Marguerite Maury')), {
      action: 'add', who: 'Marguerite Maury', relation: 'child',
      person: { given: 'Anne', surname: 'Lacoste', sex: 'F', birthDate: '3 mai 1872', birthPlace: 'Hautefort' },
    });
    assert.deepEqual(said(parseCommand('Pierre Lacoste est le père de Jean Lacoste')), {
      action: 'add', who: 'Jean Lacoste', relation: 'father', person: { given: 'Pierre', surname: 'Lacoste', sex: 'M' },
    });
    const c = parseCommand('ajoute un fils à Jean Lacoste : Paul Lacoste né en 1880');
    assert.equal(c.who, 'Jean Lacoste');
    assert.equal(c.relation, 'child');
    assert.equal(c.person.sex, 'M');
    assert.equal(parseCommand('Ajoute Paul Bertrand, né en 1990, fil de Camille Bertrand.').relation, 'child');
  });

  test('modifier une personne ; le reste va au modèle de langage', () => {
    assert.deepEqual(said(parseCommand('Génie Desgorces est morte vers 1890 à la Borie')), {
      action: 'edit', who: 'Génie Desgorces', relation: '', person: { deathDate: 'vers 1890', deathPlace: 'La Borie' },
    });
    assert.deepEqual(said(parseCommand('Jean Maury était cultivateur')).person, { occupation: 'cultivateur' });
    assert.equal(parseCommand('Marguerite a eu un fils, Pierre, en 1875').person.birthDate, '1875', 'l’année : la naissance');
    assert.equal(parseCommand('ajoute Paul Bertrand qui est parti vivre à Paris en 1990').action, 'unknown', 'plus qu’un nom');
    assert.equal(parseCommand('quelle heure est-il').action, 'unknown');
  });

  test('« né » et « décédé » : le sexe et la modification (lettres accentuées en fin de mot)', () => {
    assert.equal(parseCommand('Ajoute Louis Martin, né le 12 mars 1901 à Saint-Pierre-de-Chignac.').person.sex, 'M');
    assert.equal(parseCommand('Ajoute Louis Martin, décédé en 1950').person.sex, 'M');
    assert.deepEqual(said(parseCommand('Jean Maury est né le 3 mai 1872 à Hautefort.')), {
      action: 'edit', who: 'Jean Maury', relation: '', person: { birthDate: '3 mai 1872', birthPlace: 'Hautefort' },
    });
    assert.deepEqual(said(parseCommand('Jean Maury est décédé le 1er janvier 1950 à Périgueux.')).person, { deathDate: '1 janvier 1950', deathPlace: 'Périgueux' });
  });

  test('métier dit après le nom ou après la naissance', () => {
    assert.deepEqual(said(parseCommand('Ajoute Louis Martin, cultivateur, né en 1901.')).person,
      { given: 'Louis', surname: 'Martin', sex: 'M', birthDate: '1901', occupation: 'cultivateur' });
    assert.equal(parseCommand('Ajoute Louis Martin né en 1901 il était cultivateur').person.occupation, 'cultivateur');
    assert.equal(parseCommand('Ajoute Louis Martin, à Paris').action, 'unknown', 'pas un métier');
  });

  test('« s’appelle », deux parents ; une phrase mal comprise va au modèle de langage', () => {
    assert.deepEqual(said(parseCommand('Le père de Jean Lacoste s’appelle Pierre Lacoste.')), {
      action: 'add', who: 'Jean Lacoste', relation: 'father', person: { given: 'Pierre', surname: 'Lacoste', sex: 'M' },
    });
    const c = parseCommand('Ajoute Jean-Baptiste Maury, fils de Pierre Maury et de Marie Dupont.');
    assert.equal(c.who, 'Pierre Maury', 'le premier parent ; le formulaire propose son conjoint');
    assert.equal(c.relation, 'child');
    assert.equal(parseCommand('Anne est la fille de Jean qui est parti vivre à Paris').action, 'unknown');
    assert.equal(parseCommand('Jean Maury était cultivateur à Hautefort').person.occupation, 'cultivateur');
  });

  test('frère, sœur, père, mère : « est », « comme », « a pour », « a un frère »', () => {
    const rel = (x) => { const c = parseCommand(x); return [c.who, c.relation, c.person.given, c.person.surname, c.person.sex].join('|'); };
    assert.equal(rel('Le père de Jean Lacoste est Pierre Lacoste.'), 'Jean Lacoste|father|Pierre|Lacoste|M');
    assert.equal(rel('La sœur de Jean Lacoste s’appelle Marie.'), 'Jean Lacoste|sibling|Marie||F');
    assert.equal(rel('Ajoute Pierre Lacoste comme père de Jean Lacoste'), 'Jean Lacoste|father|Pierre|Lacoste|M');
    assert.equal(rel('Jean Lacoste a pour mère Marguerite Maury'), 'Jean Lacoste|mother|Marguerite|Maury|F');
    assert.equal(rel('Jean Lacoste a un frère, Paul.'), 'Jean Lacoste|sibling|Paul||M');
    assert.equal(rel('Jean Lacoste a une soeur qui s’appelle Marie'), 'Jean Lacoste|sibling|Marie||F');
    assert.equal(parseCommand('La mère de Jean est cultivatrice').action, 'unknown', 'pas un nom');
    assert.equal(parseCommand('Le père de Jean Lacoste est mort en 1900').action, 'unknown');
  });

  test('lieux dits : commune, département, pays', async () => {
    const { parseSpokenPlace } = await import('../js/model/places.js');
    const { loadCommunes, findCommune } = await import('../js/model/communes.js');
    const place = (x) => { const p = parseSpokenPlace(x); return [p.hamlet, p.city, p.dept, p.country].join('|'); };
    assert.equal(place('Confolens, 16'), '|Confolens|16|');
    assert.equal(place('Confolens en Charente'), '|Confolens|16|');
    assert.equal(place('Confolens dans la Haute-Vienne'), '|Confolens|87|');
    assert.equal(place('la Borie, Hautefort (24)'), 'la Borie|Hautefort|24|');
    assert.equal(place('Bruxelles en Belgique'), '|Bruxelles||Belgique');
    assert.equal(place('Bourg en Bresse'), '|Bourg en Bresse||', 'pas un département');
    await loadCommunes();
    assert.deepEqual(findCommune('Confoland', '87'), { city: 'Confolens', dept: '16' });
    assert.deepEqual(findCommune('perigueux'), { city: 'Périgueux', dept: '24' });
    assert.deepEqual(findCommune('Saint-Pierre'), { city: 'Saint-Pierre', dept: '' }, 'plusieurs départements : aucun');
    assert.equal(findCommune('Zzyzx'), null);
  });

  test('unions : mariage, pacs, concubinage ; date et lieu de l’union', () => {
    assert.deepEqual(said(parseCommand('Jean Tellier a épousé Marie Dupont le 3 juin 1990 à Confolens')), {
      action: 'add', who: 'Jean Tellier', relation: 'spouse', person: { given: 'Marie', surname: 'Dupont' },
      union: { type: 'married', date: '3 juin 1990', place: 'Confolens' },
    });
    assert.deepEqual(said(parseCommand('Jean Tellier et Marie Dupont se sont mariés en 1990')).union, { type: 'married', date: '1990' });
    assert.deepEqual(said(parseCommand('Jean Tellier est pacsé avec Paul Martin')).union, { type: 'pacs' });
    assert.deepEqual(said(parseCommand('Jean Tellier vit en concubinage avec Sophie Martin')).union, { type: 'cohabiting' });
    const c = said(parseCommand('Sophie Martin est la concubine de Jean Tellier'));
    assert.deepEqual([c.who, c.relation, c.person.sex, c.union.type], ['Jean Tellier', 'spouse', 'F', 'cohabiting']);
    assert.equal(said(parseCommand('Ajoute le compagnon d’Odette Morel : Paul Morel')).union.type, 'cohabiting');
    assert.equal(said(parseCommand('Ajoute la femme de Jean Tellier : Marie Dupont')).union, undefined, '« femme » : sans type');
    assert.equal(parseCommand('Jean Tellier vit à Paris').action, 'unknown');
    assert.equal(cleanCommand({ action: 'add', who: 'Jean', relation: 'child', person: { given: 'Anne' }, union: { type: 'married' } }).union.type, '', 'une union pour un conjoint seulement');
  });

  test('lieux : petits mots en minuscules', () => {
    assert.equal(parseCommand('Ajoute Anne Lacoste, née en 1872 à Hautefort en Dordogne').person.birthPlace, 'Hautefort en Dordogne');
    assert.equal(parseCommand('Ajoute Anne Lacoste, née en 1872 à saint-pierre-de-chignac').person.birthPlace, 'Saint-Pierre-de-Chignac');
  });

  test('noms entendus : le nom de famille à sa place, écrit comme dans l’arbre', () => {
    assert.equal(soundKey('Tellier'), soundKey('Telié'));
    assert.equal(soundKey('Tellier'), soundKey('Telier'));
    assert.notEqual(soundKey('Tellier'), soundKey('Pelletier'));
    assert.equal(soundKey('Tellier'), soundKey('Delié'), 'Whisper confond t et d, p et b…');
    assert.equal(soundKey('Grossmann'), soundKey('Krosman'));
    assert.equal(fixName({ given: 'Sophie', surname: 'Delié' }, ['Tellier']).surname, 'Tellier', 'écrit comme dans l’arbre');
    const known = ['Tellier', 'Lamborre', 'Freyssinet'];
    assert.deepEqual(fixName({ given: 'Marc-Anatole-Octave-Tellier', surname: '' }, known), { given: 'Marc-Anatole-Octave', surname: 'Tellier' });
    assert.deepEqual(fixName({ given: 'Jean-Tellier', surname: 'Tellier' }, known), { given: 'Jean', surname: 'Tellier' });
    assert.deepEqual(fixName({ given: 'Sophie', surname: 'Telié' }, known), { given: 'Sophie', surname: 'Tellier' });
    assert.deepEqual(fixName({ given: 'Marie', surname: 'Lambore' }, known), { given: 'Marie', surname: 'Lamborre' });
    assert.deepEqual(fixName({ given: 'Jean-Pierre', surname: '' }, known), { given: 'Jean-Pierre', surname: '' }, 'un prénom composé reste');
    assert.deepEqual(fixName({ given: 'Paul', surname: 'Martin' }, known), { given: 'Paul', surname: 'Martin' }, 'un nom nouveau reste');
    assert.deepEqual(fixName({ given: 'Marc-Otave-Anatole-Telier', surname: '' }, []), { given: 'Marc-Otave-Anatole', surname: 'Telier' }, 'arbre vide : la chaîne de tirets');
  });

  test('noms : prénoms puis nom, particules avec le nom', () => {
    assert.deepEqual(splitName('anne marie lacoste'), { given: 'Anne Marie', surname: 'Lacoste' });
    assert.deepEqual(splitName('jean-pierre de la borie'), { given: 'Jean-Pierre', surname: 'De la Borie' });
    assert.deepEqual(splitName('Odette'), { given: 'Odette', surname: '' });
  });
});

describe('voix : la réponse, une fois le formulaire rempli', () => {
  test('oui, non, ou une précision', () => {
    for (const x of ['Oui.', 'oui, enregistre', 'C’est bon, merci !', 'Valide', 'ok vas-y', 'yes please']) assert.equal(parseReply(x).reply, 'yes', x);
    for (const x of ['Non.', 'annule', 'laisse tomber', 'non non', 'cancel']) assert.equal(parseReply(x).reply, 'no', x);
    assert.deepEqual(parseReply('Non, elle est née en 1873.'), { reply: 'more', rest: 'elle est née en 1873.', lead: 'no' });
    assert.deepEqual(parseReply('Oui et elle était couturière'), { reply: 'more', rest: 'elle était couturière', lead: 'yes' });
    assert.equal(parseReply('Ouistreham').reply, 'more', 'un mot entier');
    assert.equal(parseReply('Oui, à l’île.').lead, 'yes', 'un « oui » suivi d’un bruit');
    assert.equal(parseReply('Non, euh').lead, 'no');
    assert.equal(parseReply('née en 1873').lead, '');
  });

  test('ce que Whisper invente sur un bruit ne compte pas', () => {
    for (const x of ['Sous-titres réalisés par la communauté d’Amara.org', 'Merci d’avoir regardé cette vidéo !', '...', '[Musique]', ' ']) assert.equal(isNoise(x), true, x);
    for (const x of ['oui', 'Non, elle est née en 1873', 'Ajoute Anne Lacoste']) assert.equal(isNoise(x), false, x);
  });

  test('choisir parmi des homonymes : rang, année, prénom, nouvelle personne', () => {
    assert.deepEqual(parseChoice('Le premier.'), { index: 0 });
    assert.deepEqual(parseChoice('la deuxième'), { index: 1 });
    assert.deepEqual(parseChoice('deux'), { index: 1 });
    assert.deepEqual(parseChoice('le dernier'), { index: -1 });
    assert.deepEqual(parseChoice('celui né en 1961'), { year: 1961 });
    assert.deepEqual(parseChoice('Marc'), { words: 'marc' });
    assert.deepEqual(parseChoice('une nouvelle personne'), { fresh: true });
    assert.equal(parseChoice(''), null);
  });

  test('la fin de la conversation', () => {
    for (const x of ['C’est tout, merci.', 'merci', 'Non.', 'fini', 'that’s all']) assert.equal(isGoodbye(x), true, x);
    for (const x of ['Ajoute Paul Lacoste', 'cherche Maury', 'Merciers']) assert.equal(isGoodbye(x), false, x);
  });

  test('les précisions sur la fiche ouverte', () => {
    assert.deepEqual(parseDetails('elle est née le 1er mai 1873 à Hautefort'), { birthDate: '1 mai 1873', birthPlace: 'Hautefort' });
    assert.deepEqual(parseDetails('il est mort en 1950 et il était maçon'), { deathDate: '1950', occupation: 'maçon' });
    assert.deepEqual(parseDetails('elle s’appelle Anne Marie Lacoste', { surname: 'Lacoste' }), { given: 'Anne Marie', surname: 'Lacoste' });
    assert.deepEqual(parseDetails('elle s’appelle Anne Marie', { surname: 'Lacoste' }), { given: 'Anne Marie' });
    assert.deepEqual(parseDetails('son prénom est Jeanne'), { given: 'Jeanne' });
    assert.deepEqual(parseDetails('euh je sais pas'), {});
  });
});

describe('voix : la voix de Lignée', () => {
  test('une voix installée, de France, la voix de base avant ses variantes ; jamais une voix en ligne', async () => {
    const { localVoice } = await import('../js/services/voice.js');
    const v = (name, lang, localService = true) => ({ name, lang, localService });
    const voices = [v('Google français', 'fr-FR', false), v('French (Belgium) espeak-ng', 'fr-BE'),
      v('French (France)+Adam espeak-ng', 'fr-FR'), v('French (France) espeak-ng', 'fr-FR'), v('English (Great Britain) espeak-ng', 'en-GB')];
    assert.equal(localVoice(voices, 'fr').name, 'French (France) espeak-ng');
    assert.equal(localVoice(voices, 'en').name, 'English (Great Britain) espeak-ng');
    assert.equal(localVoice([v('Google français', 'fr-FR', false)], 'fr'), null);
  });
});

describe('voix : modèles chargés d’avance', () => {
  const nativeFetch = globalThis.fetch;
  after(() => { globalThis.fetch = nativeFetch; });

  test('au chargement de la page, si le micro a servi ces sept derniers jours ; sinon à la première phrase', async () => {
    const voice = await import('../js/ui/voice.js');
    const { resetVoiceEngines } = await import('../js/services/voice.js');
    const A = await import('../js/actions.js');
    const warmed = [];
    globalThis.fetch = async (u) => {
      if (String(u) === 'api/voice/warm') warmed.push(1);
      return String(u) === 'api/voice' ? new Response('{"listen":true,"understand":true}', { headers: { 'Content-Type': 'application/json' } }) : new Response('{}');
    };
    const start = async (used) => {
      resetApp();
      resetVoiceEngines();
      localStorage.setItem('lignee.voice', JSON.stringify(used ? { used } : {}));
      await voice.initVoice(A);
      await new Promise((r) => setTimeout(r, 0));
    };
    await start(0);
    assert.equal(warmed.length, 0, 'jamais servi');
    await start(Date.now() - 8 * 24 * 3600 * 1000);
    assert.equal(warmed.length, 0, 'il y a plus d’une semaine');
    await start(Date.now() - 3600 * 1000);
    assert.equal(warmed.length, 1, 'servi il y a une heure');
    localStorage.removeItem('lignee.voice');
  });
});

describe('voix : entendre quelqu’un parler', () => {
  test('un « oui » faible dans une pièce calme ; un clic n’est pas une voix ; une pièce bruyante comme avant', async () => {
    const { voiceGate } = await import('../js/services/voice.js');
    const run = (levels) => { const g = voiceGate(); return levels.map(g); };
    assert.deepEqual(run([0.001, 0.001, 0.01, 0.012, 0.011, 0.001]), [false, false, false, true, true, false], 'pièce calme : 0,01 suffit');
    assert.deepEqual(run([0.001, 0.001, 0.2, 0.001, 0.001]), [false, false, false, false, false], 'un clic seul');
    assert.deepEqual(run([0.01, 0.01, 0.015, 0.015, 0.03, 0.03]), [false, false, false, false, false, true], 'pièce bruyante : au-dessus de 0,02');
  });
});

describe('voix : réponse du modèle de langage', () => {
  test('seules les valeurs connues ; le sexe suit le lien ; une commande sans nom ne vaut rien', () => {
    const c = cleanCommand({ action: 'add', who: ' Jean ', relation: 'mother', person: { given: 'Anne', sex: 'M', extra: 'x', birthDate: 1872 } });
    assert.equal(c.who, 'Jean');
    assert.equal(c.person.sex, 'F', 'une mère est une femme');
    assert.equal(c.person.birthDate, '', 'pas une chaîne');
    assert.deepEqual(Object.keys(c.person), FIELDS);
    assert.equal(cleanCommand({ action: 'open', who: '' }).action, 'unknown');
    assert.equal(cleanCommand({ action: 'delete', who: 'Jean' }).action, 'unknown');
    assert.equal(cleanCommand({ action: 'edit', who: 'Jean', relation: 'child', person: {} }).relation, '', 'un lien seulement pour un ajout');
    assert.equal(commandFromText('voici : {"action":"open","who":"Jean"} fin').who, 'Jean');
    assert.equal(commandFromText('pas de JSON'), null);
    assert.equal(commandFromText('{cassé'), null);
  });

  test('dates et majuscules nettoyées, comme pour les phrases connues', () => {
    assert.equal(cleanDate('le 3 mai 1872.'), '3 mai 1872');
    assert.equal(cleanDate('en 1901'), '1901');
    assert.equal(cleanDate('vers le 1er mai 1850'), 'vers 1 mai 1850');
    assert.equal(cleanDate('premier janvier 1950'), '1 janvier 1950');
    assert.equal(cleanDate('on 2nd May 1890'), '2 May 1890');
    assert.equal(cleanDate('10-12-95'), '10/12/1995', 'en chiffres, comme Whisper les écrit');
    assert.equal(cleanDate('le 3.5.1872'), '03/05/1872');
    assert.equal(cleanDate('1/2/05'), '01/02/2005');
    const c = cleanCommand({ action: 'add', person: { given: 'anne', surname: 'de la borie', birthDate: 'le 3 mai 1872', birthPlace: 'hautefort', deathPlace: 'La Roche-Chalais' } });
    assert.deepEqual([c.person.given, c.person.surname, c.person.birthDate, c.person.birthPlace, c.person.deathPlace],
      ['Anne', 'De la Borie', '3 mai 1872', 'Hautefort', 'La Roche-Chalais']);
  });

  test('le schéma demande tous les champs ; la consigne montre des exemples valides', () => {
    assert.deepEqual(SCHEMA.required, ['action'], 'seule l’action : une réponse courte');
    assert.deepEqual(Object.keys(SCHEMA.properties.person.properties), FIELDS);
    assert.match(PROMPT, /"relation":"child"/);
    assert.doesNotMatch(PROMPT, /"birthPlace":""/, 'des exemples compacts : le modèle les recopie');
    assert.equal(commandFromText('{"action":"open","who":"Jean"}').person.given, '', 'les champs absents, remplis');
  });
});

describe('voix : serveur local', () => {
  let dataDir;
  let srv;
  let url;
  const calls = [];
  before(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'lignee-voice-'));
    await mkdir(dataDir, { recursive: true });
    const voice = {
      status: async () => ({ listen: true, understand: true, whisper: 'small', llm: 'qwen2.5:7b' }),
      listen: async (wav, o) => { calls.push(['listen', wav.length, o]); return { text: 'ouvre Jean' }; },
      understand: async (text) => { calls.push(['understand', text]); return { command: parseCommand(text) }; },
      warm: async () => { calls.push(['warm']); },
    };
    srv = createServer({ dataDir, voice });
    await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
    url = (rel) => `http://127.0.0.1:${srv.address().port}/${rel}`;
  });
  after(async () => {
    srv.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  test('état, préchauffage, écoute d’un WAV, compréhension ; entrées refusées', async () => {
    assert.deepEqual(await (await fetch(url('api/voice'))).json(), { listen: true, understand: true, whisper: 'small', llm: 'qwen2.5:7b' });
    assert.equal((await fetch(url('api/voice'), { method: 'POST' })).status, 405);
    assert.equal((await fetch(url('api/voice/warm'), { method: 'POST' })).status, 200);
    const wav = Buffer.alloc(64);
    wav.write('RIFF', 0, 'latin1');
    wav.write('WAVE', 8, 'latin1');
    const r = await fetch(url('api/voice/listen?lang=fr&hint=Maury'), { method: 'POST', body: wav });
    assert.deepEqual(await r.json(), { text: 'ouvre Jean' });
    assert.deepEqual(calls.find((c) => c[0] === 'listen'), ['listen', 64, { lang: 'fr', hint: 'Maury' }]);
    assert.equal((await fetch(url('api/voice/listen?lang=xyz'), { method: 'POST', body: 'pas un wav' })).status, 400);
    const u = await fetch(url('api/voice/understand'), { method: 'POST', body: JSON.stringify({ text: 'cherche Maury' }) });
    assert.equal((await u.json()).command.action, 'search');
    assert.equal((await fetch(url('api/voice/understand'), { method: 'POST', body: '{' })).status, 400);
    assert.equal((await fetch(url('api/voice/understand'), { method: 'POST', body: '{"text":"  "}' })).status, 400);
    assert.equal((await fetch(url('api/voice/listen'))).status, 405);
    assert.equal((await fetch(url('api/voice/autre'), { method: 'POST' })).status, 404);
  });
});

describe('voix : dans la page', () => {
  const nativeFetch = globalThis.fetch;
  after(() => { globalThis.fetch = nativeFetch; });

  test('micro affiché avec le serveur ; ouvrir, chercher, ajouter (formulaire rempli), choisir parmi des homonymes, personne introuvable', async () => {
    const { S } = await import('../js/state.js');
    const voice = await import('../js/ui/voice.js');
    const { resetVoiceEngines } = await import('../js/services/voice.js');
    const A = await import('../js/actions.js');
    resetApp();
    resetVoiceEngines();
    const asked = [];
    globalThis.fetch = async (u, init = {}) => {
      if (String(u) === 'api/voice') return new Response('{"listen":true,"understand":true}', { headers: { 'Content-Type': 'application/json' } });
      if (String(u) === 'api/voice/understand') {
        asked.push(JSON.parse(init.body).text);
        return new Response(JSON.stringify({ command: { action: 'add', who: 'Odette', relation: 'child', person: { given: 'Anne', surname: 'Morel', sex: 'F', birthDate: '1960' } } }));
      }
      return new Response('{}');
    };
    loadTree([
      person('o', { given: 'Odette', surname: 'Morel', sex: 'F' }),
      person('j1', { given: 'Jean', surname: 'Lacoste', sex: 'M', birthDate: '1845' }),
      person('j2', { given: 'Jean', surname: 'Lacoste', sex: 'M', birthDate: '1870' }),
      person('m', { given: 'Marguerite', surname: 'Maury', sex: 'F' }),
    ]);
    S.focus = 'o';
    await voice.initVoice(A);
    assert.equal(document.getElementById('voiceBtn').hidden, false, 'le micro');
    const bubble = () => document.getElementById('voiceBubble').innerHTML;

    await voice.understand('ouvre la fiche de Marguerite Maury');
    assert.equal(S.focus, 'm');
    assert.match(bubble(), /Fiche de Marguerite/);
    assert.deepEqual(asked, [], 'phrase connue : sans modèle de langage');

    await voice.understand('cherche Lacoste');
    assert.equal(document.getElementById('find').value, 'Lacoste');

    await voice.understand('ajoute Anne Lacoste, née en 1872, fille de Marguerite Maury');
    assert.equal(S.edit.rel, 'child');
    assert.equal(S.edit.draft.motherId, 'm');
    assert.equal(S.edit.draft.given, 'Anne');
    assert.equal(S.edit.draft.birthDate, '1872');
    assert.match(bubble(), /Nouvelle personne : <b>Anne Lacoste<\/b>, fille de Marguerite/);
    await voice.understand('Odette Morel est morte en 2021');
    assert.match(bubble(), /Termine d’abord la fiche en cours/, 'un ajout ouvert');
    A.cancelEdit();

    await voice.understand('Odette a donné naissance à Anne Morel en 1960');
    assert.deepEqual(asked, ['Odette a donné naissance à Anne Morel en 1960'], 'phrase libre : le modèle du serveur');
    assert.equal(S.edit.draft.motherId, 'o');
    assert.match(bubble(), /fille d’Odette/);
    A.cancelEdit();

    await voice.understand('Jean Lacoste est mort en 1910');
    assert.match(bubble(), /Plusieurs personnes peuvent être « Jean Lacoste »/);
    assert.match(bubble(), /data-act="voice-pick" data-id="j1"/);
    voice.pickVoice('j2');
    assert.equal(S.edit.id, 'j2');
    assert.equal(S.edit.draft.deathDate, '1910');
    A.cancelEdit();

    await voice.understand('ouvre la fiche de Margerite Mauri');
    assert.equal(S.focus, 'm', 'un nom entendu un peu de travers');
    await voice.understand('ouvre la fiche de Personne Inconnue');
    assert.match(bubble(), /Je ne trouve personne qui s’appelle « Personne Inconnue »/);
    await voice.understand('ouvre la fiche de <img src=x>');
    assert.doesNotMatch(bubble(), /<img/);

    voice.closeVoice();
    assert.equal(document.getElementById('voiceBubble').hidden, true);
    assert.equal(voice.voiceOpen(), false);
  });
  test('un parent, un frère, un conjoint déjà dans l’arbre : la fiche est reliée, pas recréée', async () => {
    const { S } = await import('../js/state.js');
    const voice = await import('../js/ui/voice.js');
    const { resetVoiceEngines } = await import('../js/services/voice.js');
    const A = await import('../js/actions.js');
    resetApp();
    resetVoiceEngines();
    globalThis.fetch = async (u) => (String(u) === 'api/voice'
      ? new Response('{"listen":true,"understand":false}', { headers: { 'Content-Type': 'application/json' } }) : new Response('{}'));
    loadTree([
      person('j', { given: 'Jean', surname: 'Lacoste', sex: 'M', fatherId: 'p' }),
      person('p', { given: 'Pierre', surname: 'Lacoste', sex: 'M' }),
      person('m', { given: 'Marguerite', surname: 'Lacoste', maidenName: 'Maury', sex: 'F' }),
      person('s', { given: 'Marie', surname: 'Lacoste', sex: 'F' }),
      person('o', { given: 'Odette', surname: 'Morel', sex: 'F' }),
      person('a1', { given: 'Anne', surname: 'Morel', sex: 'F', birthDate: '1920' }),
      person('a2', { given: 'Anne', surname: 'Morel', sex: 'F', birthDate: '1960' }),
      person('n', { given: 'Noëlle', surname: 'Roux', sex: 'F' }),
    ]);
    await voice.initVoice(A);
    S.voiceReply = false; // the links only: no conversation here (see the next test)
    const bubble = () => document.getElementById('voiceBubble').innerHTML;
    const people = S.people.size;

    await voice.understand('Ajoute Marie Lacost, sœur de Jean Lacauste');
    assert.equal(S.edit.id, 's', 'les noms entendus de travers : Marie Lacoste, sœur de Jean Lacoste');
    A.cancelEdit();
    await voice.understand('Ajoute Paul-Lacoste, né en 1880');
    assert.deepEqual([S.edit.draft.given, S.edit.draft.surname], ['Paul', 'Lacoste'], 'le nom collé au prénom');
    A.cancelEdit();
    await voice.understand('Ajoute Paul Lacoste, né en 1880 à Confoland, 87, mort en 1950 à Hautefort');
    assert.equal(S.edit.draft.birthPlace, 'Confolens (16)', 'la commune mal entendue, et son département');
    assert.equal(S.edit.draft.deathPlace, 'Hautefort (24)', 'le département, quand il n’est pas dit');
    A.cancelEdit();
    await voice.understand('cherche les Lacost');
    assert.equal(document.getElementById('find').value, 'les Lacoste');

    await voice.understand('La mère de Jean Lacoste est Marguerite Maury');
    assert.equal(S.edit.id, 'j', 'la fiche de Jean, qui porte le lien');
    assert.equal(S.edit.draft.motherId, 'm', 'retrouvée par son nom de naissance');
    assert.match(bubble(), /déjà dans l’arbre, devient mère de Jean/);
    assert.match(bubble(), /data-act="voice-new"/);
    voice.newVoice();
    assert.equal(S.edit.id, null, 'une autre personne : une nouvelle fiche');
    assert.equal(S.edit.rel, 'mother');
    A.cancelEdit();

    await voice.understand('Pierre Lacoste est le père de Jean Lacoste');
    assert.equal(S.edit, null);
    assert.match(bubble(), /est déjà père de Jean/);

    await voice.understand('Marie Lacoste, née en 1872, est la sœur de Jean Lacoste');
    assert.equal(S.edit.id, 's', 'la sœur reçoit les parents de Jean');
    assert.equal(S.edit.draft.fatherId, 'p');
    assert.equal(S.edit.draft.birthDate, '1872', 'ce qui est dit d’elle va sur sa fiche');
    A.cancelEdit();

    await voice.understand('Odette Morel a une sœur, Noëlle Roux');
    assert.match(bubble(), /Aucun parent d’Odette MOREL n’est connu/, 'ni l’un ni l’autre n’a de parent');

    assert.equal(S.edit, null);

    await voice.understand('Ajoute la femme de Jean Lacoste : Noëlle Roux');
    assert.equal(S.edit.id, 'j');
    assert.equal(S.edit.unions.at(-1).other, 'n', 'l’union est proposée');
    A.cancelEdit();

    await voice.understand('Jean Lacoste a épousé Noëlle Roux le 3 juin 1890 à Confoland');
    assert.equal(S.edit.id, 'j');
    assert.deepEqual([S.edit.unions.at(-1).other, S.edit.unions.at(-1).type, S.edit.unions.at(-1).date, S.edit.unions.at(-1).place],
      ['n', 'married', '3 juin 1890', 'Confolens (16)'], 'le mariage, sa date, son lieu');
    assert.match(bubble(), /<dt>Union<\/dt><dd>Noëlle ROUX, mariage, 3 juin 1890 à Confolens \(16\)<\/dd>/);
    A.cancelEdit();
    await voice.understand('Odette Morel vit en concubinage avec Paul Martin');
    assert.equal(S.edit.rel, 'spouse', 'un nouveau conjoint');
    assert.equal(S.edit.unions[0].type, 'cohabiting');
    A.cancelEdit();

    await voice.understand('Odette Morel a une fille, Anne Morel');
    assert.match(bubble(), /Plusieurs personnes de l’arbre s’appellent « Anne Morel »/);
    assert.match(bubble(), /data-act="voice-pick" data-id="a2"/);
    voice.pickVoice('a2');
    assert.equal(S.edit.id, 'a2');
    assert.equal(S.edit.draft.motherId, 'o');
    A.cancelEdit();
    await voice.understand('Odette Morel a une fille, Anne Morel');
    voice.answerChoice('celle de 1920');
    assert.equal(S.edit.id, 'a1', 'choisie à la voix, par l’année');
    A.cancelEdit();
    await voice.understand('Odette Morel a une fille, Anne Morel');
    voice.answerChoice('euh');
    assert.match(bubble(), /Je n’ai pas su laquelle/);
    voice.answerChoice('la deuxième');
    assert.equal(S.edit.id, 'a2', 'par son rang');
    A.cancelEdit();
    await voice.understand('Odette Morel a une fille, Anne Morel');
    voice.answerChoice('une nouvelle personne');
    assert.equal(S.edit.id, null);
    assert.equal(S.edit.rel, 'child');
    A.cancelEdit();
    await voice.understand('Odette Morel a une fille, Anne Morel');
    voice.newVoice();
    assert.equal(S.edit.rel, 'child', 'une nouvelle personne');
    assert.equal(S.people.size, people, 'rien n’est enregistré avant Enregistrer');
    S.voiceReply = true;
    A.cancelEdit();
  });

  test('une fiche déjà là, retrouvée même sans le nom dit, ou abîmée : reliée, pas recréée', async () => {
    const { S } = await import('../js/state.js');
    const voice = await import('../js/ui/voice.js');
    const { resetVoiceEngines } = await import('../js/services/voice.js');
    const A = await import('../js/actions.js');
    resetApp();
    resetVoiceEngines();
    globalThis.fetch = async (u) => (String(u) === 'api/voice'
      ? new Response('{"listen":true,"understand":false}', { headers: { 'Content-Type': 'application/json' } }) : new Response('{}'));
    loadTree([
      person('v', { given: 'Véronique', surname: 'Dorvigné', sex: 'F' }),
      person('m', { given: 'Marc', surname: 'Tellier', sex: 'M' }),
      person('s', { given: 'Sophie', surname: 'Tellier', sex: 'F' }),
      person('x', { given: 'Marc-Anatole-Octave-Tellier', surname: '', sex: 'M' }),
      person('k', { given: 'Paul', surname: 'Tellier', sex: 'M' }),
    ], [{ a: 'v', b: 'm' }]);
    await voice.initVoice(A);
    S.voiceReply = false;

    await voice.understand('Ajoute une fille à Véronique Dorvigné : Sophie');
    assert.equal(S.edit && S.edit.id, 's', 'la fille porte le nom de son père, conjoint de Véronique');
    assert.equal(S.edit.draft.motherId, 'v');
    A.cancelEdit();
    await voice.understand('Sophie et la fille de Véronique Dorvigné');
    assert.equal(S.edit && S.edit.id, 's', '« et » entendu pour « est »');
    A.cancelEdit();
    await voice.understand('Marc Anatole Octave Tellier est le père de Paul Tellier');
    assert.equal(S.edit && S.edit.id, 'k', 'la fiche de Paul, qui porte le lien');
    assert.equal(S.edit.draft.fatherId, 'x', 'la fiche au nom collé aux prénoms, retrouvée');
    A.cancelEdit();
    S.voiceReply = true;
    voice.closeVoice();
  });

  test('la conversation : récapitulatif lu, « oui » enregistre, « non » ferme, une précision complète, puis la commande suivante ; boutons ; réglable', async () => {
    const { S } = await import('../js/state.js');
    const voice = await import('../js/ui/voice.js');
    const { resetVoiceEngines } = await import('../js/services/voice.js');
    const A = await import('../js/actions.js');
    resetApp();
    resetVoiceEngines();
    globalThis.fetch = async (u) => (String(u) === 'api/voice'
      ? new Response('{"listen":true,"understand":false}', { headers: { 'Content-Type': 'application/json' } }) : new Response('{}'));
    loadTree([person('m', { given: 'Marguerite', surname: 'Maury', sex: 'F' })]);
    await voice.initVoice(A);
    const bubble = () => document.getElementById('voiceBubble').innerHTML;
    // The fake page doesn't read the value="" of the form: the fields, as the page would hold them
    const fill = () => {
      for (const [id, k] of [['f-given', 'given'], ['f-surname', 'surname'], ['f-maiden', 'maidenName'], ['f-mother', 'motherId'], ['f-father', 'fatherId'], ['f-bdate', 'birthDate'], ['f-occ', 'occupation']]) {
        const el = document.getElementById(id);
        if (el) el.value = S.edit.draft[k] || '';
      }
    };
    // The microphone, for the answer (refused here: the conversation stops, the form stays)
    let asked = 0;
    globalThis.navigator.mediaDevices = { getUserMedia: async () => { asked++; throw new Error('pas de micro ici'); } };
    // The voice of Lignée: what it says
    const said = [];
    globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    let voices = [{ lang: 'fr-FR', localService: false }];
    globalThis.speechSynthesis = { speak: (u) => { said.push(u.text); u.onend(); }, cancel: () => {}, getVoices: () => voices };
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    await voice.understand('ajoute Anne Lacoste, fille de Marguerite Maury');
    await settle();
    assert.deepEqual([S.edit.draft.surname, S.edit.draft.maidenName], ['', 'Lacoste'], 'une femme : le nom dit est son nom de jeune fille');
    assert.equal(asked, 0, 'phrase tapée : pas de conversation');
    assert.deepEqual(said, []);
    assert.match(bubble(), /data-act="voice-save"/, 'Enregistrer dans la bulle');
    assert.match(bubble(), /data-act="voice-cancel"/);
    assert.match(bubble(), /data-act="voice-reply-pref" checked/);
    assert.match(bubble(), /<dt>Nom<\/dt><dd>Anne Lacoste<\/dd><dt>Mère<\/dt><dd>Marguerite MAURY<\/dd>/, 'le récapitulatif');
    A.cancelEdit();

    await voice.understand('ajoute Anne Lacoste, fille de Marguerite Maury', { spoken: true });
    await settle();
    assert.deepEqual(said, [], 'une voix en ligne seulement : Lignée ne parle pas (le texte partirait chez Google)');
    assert.equal(asked, 1, 'mais écoute la réponse');
    A.cancelEdit();
    voice.closeVoice();
    voices = [{ lang: 'fr-FR', localService: true }];
    await voice.understand('ajoute Anne Lacoste, fille de Marguerite Maury', { spoken: true });
    await settle();
    assert.equal(said.at(-1), 'Nom : Anne Lacoste. Mère : Marguerite MAURY. Je l’enregistre ?', 'lu à voix haute');
    assert.equal(asked, 2, 'puis la réponse est écoutée');
    assert.match(bubble(), /data-act="voice-save"/, 'sans micro : le formulaire reste, avec ses boutons');

    fill();
    await voice.reply('Non, elle est née le 3 mai 1872. Elle était couturière');
    assert.equal(S.edit.draft.birthDate, '3 mai 1872');
    assert.equal(S.edit.draft.occupation, 'couturière');
    assert.match(bubble(), /Formulaire complété/);
    assert.match(bubble(), /<dt>Née?<\/dt><dd>3 mai 1872<\/dd>/, "le sexe vient du formulaire (absent de la fausse page)");
    await voice.reply('euh attends');
    assert.match(bubble(), /Je n’ai pas compris la réponse/);
    await voice.reply('Non, euh');
    assert.ok(S.edit, '« non » suivi d’un bruit : on redemande, le formulaire reste');

    fill();
    const before = S.people.size;
    await voice.reply('oui, enregistre', undefined, true);
    await settle();
    assert.equal(S.edit, null);
    assert.equal(S.people.size, before + 1);
    const anne = [...S.people.values()].find((p) => p.given === 'Anne');
    assert.equal(anne.motherId, 'm');
    assert.equal(anne.birthDate, '03 Mai 1872', 'la date écrite comme les autres');
    assert.match(bubble(), /C’est enregistré/);
    assert.doesNotMatch(bubble(), /data-act="voice-save"/);
    assert.equal(said.at(-1), 'C’est enregistré. Autre chose ?');
    assert.equal(asked, 3, 'puis la commande suivante est écoutée');

    await voice.understand('ajoute Paul Lacoste, fils de Marguerite Maury');
    await voice.reply('annule', undefined, true);
    await settle();
    assert.equal(S.edit, null);
    assert.equal(S.people.size, before + 1, 'rien d’enregistré');
    assert.match(bubble(), /rien n’est enregistré/);
    assert.equal(asked, 4);

    await voice.understand('ajoute Paul Lacoste, fils de Marguerite Maury');
    document.getElementById('f-given').value = '';
    document.getElementById('f-surname').value = '';
    await voice.saveVoice();
    assert.match(bubble(), /Le formulaire n’est pas complet/, 'refusé : le formulaire dit pourquoi');
    await voice.cancelVoice();

    // The microphone, with the form filled in by the voice open: it answers the form
    await voice.understand('ajoute Paul Lacoste, fils de Marguerite Maury');
    const n = asked;
    await voice.startVoice();
    await settle();
    assert.equal(asked, n + 1, 'le micro s’ouvre');
    assert.equal(S.edit && S.edit.draft.given, 'Paul', 'pour répondre au formulaire, pas pour une autre commande');
    assert.match(bubble(), /data-act="voice-save"/);
    A.cancelEdit();

    voice.toggleVoiceReply(false);
    assert.equal(S.voiceReply, false);
    assert.match(localStorage.getItem('lignee.view.v1'), /"voiceReply":false/, 'retenu');
    await voice.understand('ajoute Paul Lacoste, fils de Marguerite Maury', { spoken: true });
    await settle();
    assert.equal(asked, 5, 'conversation coupée');
    voice.toggleVoiceReply(true);
    A.cancelEdit();
    voice.closeVoice();
    delete globalThis.SpeechSynthesisUtterance;
    delete globalThis.speechSynthesis;
    delete globalThis.navigator.mediaDevices;
  });

  test('ce qui paraît faux est dit avant d’enregistrer : à l’écran et à voix haute, sans bloquer', async () => {
    const { S } = await import('../js/state.js');
    const voice = await import('../js/ui/voice.js');
    const { resetVoiceEngines } = await import('../js/services/voice.js');
    const A = await import('../js/actions.js');
    resetApp();
    resetVoiceEngines();
    globalThis.fetch = async (u) => (String(u) === 'api/voice'
      ? new Response('{"listen":true,"understand":false}', { headers: { 'Content-Type': 'application/json' } }) : new Response('{}'));
    loadTree([person('m', { given: 'Marguerite', surname: 'Maury', sex: 'F', birthDate: '1900' })]);
    await voice.initVoice(A);
    S.voiceReply = true;
    const bubble = () => document.getElementById('voiceBubble').innerHTML;
    globalThis.navigator.mediaDevices = { getUserMedia: async () => { throw new Error('pas de micro ici'); } };
    const said = [];
    globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    globalThis.speechSynthesis = { speak: (u) => { said.push(u.text); u.onend(); }, cancel: () => {}, getVoices: () => [{ lang: 'fr-FR', localService: true }] };

    await voice.understand('ajoute Paul Lacoste, né en 1880, fils de Marguerite Maury', { spoken: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(bubble(), /class="vb-check"[^]*Marguerite MAURY est né\(e\) après son enfant Paul Lacoste/, 'à l’écran');
    assert.match(said.at(-1), /Né : 1880\. À vérifier : Marguerite MAURY est né\(e\) après son enfant Paul Lacoste\. .*Je l’enregistre \?$/, 'lu');
    assert.match(bubble(), /data-act="voice-save"/, 'Enregistrer reste possible');
    A.cancelEdit();
    voice.closeVoice();
    delete globalThis.SpeechSynthesisUtterance;
    delete globalThis.speechSynthesis;
    delete globalThis.navigator.mediaDevices;
  });
});
