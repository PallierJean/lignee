import assert from 'node:assert/strict';
import { test, describe, before, after } from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseCommand, cleanCommand, cleanDate, commandFromText, splitName, parseReply, parseDetails, isGoodbye, isNoise, SCHEMA, PROMPT, FIELDS } from '../js/model/voice.js';
import { createServer } from '../server.js';
import { loadTree, person, resetApp } from './helpers.js';

/** Only the fields said, to compare commands simply. */
const said = (c) => ({ ...c, person: Object.fromEntries(Object.entries(c.person).filter(([, v]) => v)) });

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
    assert.equal(parseCommand('Marguerite a eu un fils, Pierre, en 1875').action, 'unknown');
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
    assert.equal(parseCommand('Jean Maury était cultivateur à Hautefort').action, 'unknown');
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

  test('lieux : petits mots en minuscules', () => {
    assert.equal(parseCommand('Ajoute Anne Lacoste, née en 1872 à Hautefort en Dordogne').person.birthPlace, 'Hautefort en Dordogne');
    assert.equal(parseCommand('Ajoute Anne Lacoste, née en 1872 à saint-pierre-de-chignac').person.birthPlace, 'Saint-Pierre-de-Chignac');
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
    assert.deepEqual(parseReply('Non, elle est née en 1873.'), { reply: 'more', rest: 'elle est née en 1873.' });
    assert.deepEqual(parseReply('Oui et elle était couturière'), { reply: 'more', rest: 'elle était couturière' });
    assert.equal(parseReply('Ouistreham').reply, 'more', 'un mot entier');
  });

  test('ce que Whisper invente sur un bruit ne compte pas', () => {
    for (const x of ['Sous-titres réalisés par la communauté d’Amara.org', 'Merci d’avoir regardé cette vidéo !', '...', '[Musique]', ' ']) assert.equal(isNoise(x), true, x);
    for (const x of ['oui', 'Non, elle est née en 1873', 'Ajoute Anne Lacoste']) assert.equal(isNoise(x), false, x);
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
    const c = cleanCommand({ action: 'add', person: { given: 'anne', surname: 'de la borie', birthDate: 'le 3 mai 1872', birthPlace: 'hautefort', deathPlace: 'La Roche-Chalais' } });
    assert.deepEqual([c.person.given, c.person.surname, c.person.birthDate, c.person.birthPlace, c.person.deathPlace],
      ['Anne', 'De la Borie', '3 mai 1872', 'Hautefort', 'La Roche-Chalais']);
  });

  test('le schéma demande tous les champs ; la consigne montre des exemples valides', () => {
    assert.deepEqual(SCHEMA.required, ['action', 'who', 'relation', 'person']);
    assert.deepEqual(SCHEMA.properties.person.required, FIELDS);
    assert.match(PROMPT, /"relation":"child"/);
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

    await voice.understand('Odette a eu une fille, Anne Morel, en 1960');
    assert.deepEqual(asked, ['Odette a eu une fille, Anne Morel, en 1960'], 'phrase libre : le modèle du serveur');
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
    const bubble = () => document.getElementById('voiceBubble').innerHTML;
    const people = S.people.size;

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

    await voice.understand('Odette Morel a une fille, Anne Morel');
    assert.match(bubble(), /Plusieurs personnes de l’arbre s’appellent « Anne Morel »/);
    assert.match(bubble(), /data-act="voice-pick" data-id="a2"/);
    voice.pickVoice('a2');
    assert.equal(S.edit.id, 'a2');
    assert.equal(S.edit.draft.motherId, 'o');
    A.cancelEdit();
    await voice.understand('Odette Morel a une fille, Anne Morel');
    voice.newVoice();
    assert.equal(S.edit.rel, 'child', 'une nouvelle personne');
    assert.equal(S.people.size, people, 'rien n’est enregistré avant Enregistrer');
    A.cancelEdit();
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
      for (const [id, k] of [['f-given', 'given'], ['f-surname', 'surname'], ['f-mother', 'motherId'], ['f-father', 'fatherId'], ['f-bdate', 'birthDate'], ['f-occ', 'occupation']]) {
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

    fill();
    const before = S.people.size;
    await voice.reply('oui, enregistre', undefined, true);
    await settle();
    assert.equal(S.edit, null);
    assert.equal(S.people.size, before + 1);
    const anne = [...S.people.values()].find((p) => p.given === 'Anne');
    assert.equal(anne.motherId, 'm');
    assert.equal(anne.birthDate, '3 mai 1872');
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
});
