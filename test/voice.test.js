import assert from 'node:assert/strict';
import { test, describe, before, after } from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseCommand, cleanCommand, cleanDate, commandFromText, splitName, SCHEMA, PROMPT, FIELDS } from '../js/model/voice.js';
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
});
