/**
 * voice.js with stand-ins: a fake Python (a shell script playing faster-whisper's worker) and a
 * fake Ollama (an HTTP server). The settings are read when voice.js loads: set before importing it.
 */
import assert from 'node:assert/strict';
import { test, describe, before, after } from 'node:test';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';

let dir;
let ollama;
const chats = [];
let voice;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'lignee-voice-engines-'));
  // Fake Python: "-c import faster_whisper" succeeds; as the worker, answers each request
  const py = path.join(dir, 'python');
  await writeFile(py, `#!/bin/sh
if [ "$1" = "-c" ]; then exit 0; fi
echo '{"ready": true}'
while read -r line; do
  case "$line" in
    *casse*) echo '{"error": "bad audio"}' ;;
    *) echo '{"text": " Ouvre la fiche de Jean "}' ;;
  esac
done
`);
  await chmod(py, 0o755);
  ollama = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'qwen2.5:7b' }] }));
      chats.push(JSON.parse(body));
      res.end(JSON.stringify({ message: { content: '{"action":"open","who":"Jean","relation":"","person":{}}' } }));
    });
  });
  await new Promise((r) => ollama.listen(0, '127.0.0.1', r));
  process.env.LIGNEE_WHISPER = py;
  process.env.LIGNEE_OLLAMA = `http://127.0.0.1:${ollama.address().port}/`;
  voice = await import('../voice.js');
});

after(async () => {
  voice.stopVoice();
  ollama.close();
  await rm(dir, { recursive: true, force: true });
});

describe('voix : moteurs de l’ordinateur', () => {
  test('état, écoute (texte nettoyé, erreur de Whisper), compréhension par Ollama, préchauffage', async () => {
    assert.deepEqual(await voice.voiceStatus(), { listen: true, understand: true, whisper: 'small', llm: 'qwen2.5:7b' });
    assert.deepEqual(await voice.transcribe(Buffer.from('RIFF....WAVE'), { lang: 'fr', hint: 'Maury' }), { text: 'Ouvre la fiche de Jean' });
    await assert.rejects(voice.transcribe(Buffer.from('RIFF....WAVE'), { hint: 'casse' }), /whisper : bad audio/);
    assert.deepEqual((await voice.transcribe(Buffer.from('RIFF....WAVE'))).text, 'Ouvre la fiche de Jean', 'le programme continue après une erreur');

    const { command } = await voice.understand('ouvre Jean');
    assert.equal(command.action, 'open');
    assert.equal(command.who, 'Jean');
    const chat = chats.at(-1);
    assert.equal(chat.model, 'qwen2.5:7b');
    assert.equal(chat.format.type, 'object', 'réponse contrainte par le schéma');
    assert.equal(chat.messages[1].content, 'ouvre Jean');

    await voice.warmUp();
    assert.equal(chats.at(-1).options.num_predict, 1, 'la consigne lue d’avance');
  });
});
