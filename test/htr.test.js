import assert from 'node:assert/strict';
import { test, describe, before, after } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseAlto } from '../htr.js';
import { createServer } from '../server.js';
import { loadTree, person, resetApp } from './helpers.js';

const ALTO = `<?xml version="1.0"?><alto><Layout>
<Page WIDTH="1000" HEIGHT="500" ID="page_0"><PrintSpace><TextBlock>
<TextLine ID="l1" HPOS="100" VPOS="50" WIDTH="400" HEIGHT="25"><Shape><Polygon POINTS="1 2"/></Shape>
  <String ID="s1" CONTENT="L&apos;an mil" HPOS="100" VPOS="70" WIDTH="0" HEIGHT="0" WC="0.98"/><SP/>
  <String ID="s2" CONTENT="huit cent" HPOS="200" VPOS="70" WIDTH="0" HEIGHT="0" WC="0.41"/>
</TextLine>
<TextLine ID="l2" HPOS="0" VPOS="100" WIDTH="10" HEIGHT="10"><String CONTENT="" WC="0.5"/></TextLine>
<TextLine ID="l3" HPOS="120" VPOS="90" WIDTH="300" HEIGHT="20"><String CONTENT="époux &amp; c&#xe9;libataire"/></TextLine>
</TextBlock></PrintSpace></Page></Layout></alto>`;

describe('lecture : fichier ALTO de Kraken', () => {
  test('lignes en fractions de l’image, texte recomposé (NFC, entités), confiance la plus basse ; lignes vides ignorées', () => {
    assert.deepEqual(parseAlto(ALTO), [
      { box: [0.1, 0.1, 0.4, 0.05], text: 'L\'an mil huit cent', conf: 0.41 },
      { box: [0.12, 0.18, 0.3, 0.04], text: 'époux & célibataire', conf: 1 },
    ]);
    assert.deepEqual(parseAlto('<alto></alto>'), [], 'sans page : rien');
  });
});

describe('lecture : serveur local', () => {
  let dataDir;
  let srv;
  let url;
  const asked = [];
  before(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'lignee-htr-'));
    await mkdir(path.join(dataDir, 'arbre', 'photos'), { recursive: true });
    await writeFile(path.join(dataDir, 'arbre', 'photos', 'Acte-1.jpg'), 'x');
    const htr = {
      status: async () => ({ ready: true, model: 'ManuMcFrenchV3' }),
      read: async (file) => {
        asked.push(file);
        return { model: 'ManuMcFrenchV3', lines: [{ box: [0, 0, 1, 0.1], text: 'Acte', conf: 0.9 }] };
      },
    };
    srv = createServer({ dataDir, htr });
    await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
    url = (rel) => `http://127.0.0.1:${srv.address().port}/${rel}`;
  });
  after(async () => {
    srv.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  test('état, lecture d’une photo de l’arbre ; nom invalide, photo absente, méthode refusée', async () => {
    assert.deepEqual(await (await fetch(url('api/htr'))).json(), { ready: true, model: 'ManuMcFrenchV3' });
    assert.equal((await fetch(url('api/htr'), { method: 'POST' })).status, 405);
    const r = await fetch(url('api/trees/arbre/photos/Acte-1.jpg/read'), { method: 'POST' });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).lines[0].text, 'Acte');
    assert.deepEqual(asked, [path.join(dataDir, 'arbre', 'photos', 'Acte-1.jpg')]);
    assert.equal((await fetch(url('api/trees/arbre/photos/..%2Fsecret.jpg/read'), { method: 'POST' })).status, 400);
    assert.equal((await fetch(url('api/trees/arbre/photos/absente.jpg/read'), { method: 'POST' })).status, 404);
    assert.equal((await fetch(url('api/trees/arbre/photos/Acte-1.jpg/read'))).status, 405);
    assert.equal(asked.length, 1);
  });
});

describe('lecture : fenêtre du document', () => {
  const nativeFetch = globalThis.fetch;
  after(() => { globalThis.fetch = nativeFetch; });

  test('lire, voir les lignes, corriger (vérifiée), annuler ; lien selon l’état ; lecture de tous', async () => {
    const { S } = await import('../js/state.js');
    const reading = await import('../js/ui/reading.js');
    const { readingOf } = await import('../js/model/sources.js');
    const { undoAction } = await import('../js/services/storage.js');
    const { checkHtr } = await import('../js/services/htr.js');
    resetApp();
    const reads = [];
    globalThis.fetch = async (u, init) => {
      if (String(u) === 'api/htr') return new Response(JSON.stringify({ ready: true, model: 'ManuMcFrenchV3' }));
      if (String(u).endsWith('/read') && init && init.method === 'POST') {
        reads.push(String(u));
        return new Response(JSON.stringify({ model: 'ManuMcFrenchV3', lines: [{ box: [0.1, 0.1, 0.5, 0.05], text: 'L an mil', conf: 0.9 }, { box: [0.1, 0.2, 0.5, 0.05], text: 'huit cnet', conf: 0.3 }] }));
      }
      return new Response('{}');
    };
    loadTree([person('a', { given: 'Anne', surname: 'Roux', citations: [{ id: 'c1', source: 'S1', fact: '' }, { id: 'c2', source: 'S2', fact: 'birth' }] })]);
    S.sources = new Map([
      ['S1', { kind: 'notary', title: 'Contrat', photo: 'photos/Contrat.jpg', back: 'photos/Contrat-v.jpg' }],
      ['S2', { kind: 'birth', title: 'Acte', photo: 'data:image/png;base64,A' }],
    ]);
    S.mode = 'local';
    assert.equal(reading.readLink('S1', S.sources.get('S1')), '', 'sans serveur qui lit, rien à proposer');
    S.mode = 'file';
    S.tree = 'arbre';
    await checkHtr();
    assert.match(reading.readLink('S1', S.sources.get('S1')), /data-act="read-open" data-source="S1" data-back="0">Lire le texte/);
    assert.equal(reading.readLink('S2', S.sources.get('S2')), '', 'une image intégrée ne se lit pas ici');
    assert.deepEqual(reading.unread(), [['S1', false], ['S1', true]], 'recto et verso à lire');

    reading.openReading('S1');
    const card = () => document.getElementById('readCard').innerHTML;
    assert.match(card(), /data-act="read-run">Lire le texte/);
    assert.match(card(), /data-act="read-side" data-back="1"/, 'recto / verso');
    await reading.runReading();
    assert.equal(reads[0], 'api/trees/arbre/photos/Contrat.jpg/read');
    const r = readingOf(S.sources.get('S1'));
    assert.equal(r.of, 'photos/Contrat.jpg');
    assert.equal(r.model, 'ManuMcFrenchV3');
    assert.equal(r.lines.length, 2);
    assert.match(card(), /2 lignes lues, dont 1 à vérifier/);
    assert.match(card(), /<li data-line="1" class="doubt"><input type="text" data-rd-line="1" value="huit cnet"/);
    assert.match(card(), /class="rd-box" data-line="0"/);
    assert.match(reading.readLink('S1', S.sources.get('S1')), />Texte lu</);

    await reading.editLine(1, '  huit  cent ');
    assert.deepEqual(readingOf(S.sources.get('S1')).lines[1], { box: [0.1, 0.2, 0.5, 0.05], text: 'huit cent', conf: 0.3, ok: true });
    await undoAction();
    assert.equal(readingOf(S.sources.get('S1')).lines[1].text, 'huit cnet', 'Ctrl+Z défait la correction');

    // Une autre image à la place : le texte lu ne vaut plus
    assert.equal(readingOf({ ...S.sources.get('S1'), photo: 'photos/Autre.jpg' }), null);

    reading.readingSide(true);
    assert.match(card(), /Ce document n’a pas encore été lu/);
    reading.closeReading();
    assert.equal(reading.readingOpen(), false);

    await reading.readAll();
    assert.equal(reads.at(-1), 'api/trees/arbre/photos/Contrat-v.jpg/read', 'le verso restant');
    assert.ok(readingOf(S.sources.get('S1'), true));
    assert.deepEqual(reading.unread(), []);
    S.mode = 'local';
  });
});
