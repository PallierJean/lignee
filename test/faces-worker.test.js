import assert from 'node:assert/strict';
import { test, describe, before, after } from 'node:test';
import { mkdtemp, writeFile, chmod, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// A fake Python in place of OpenCV: it notes each run and gives every image one face, the same one
let dir;
let faces;
const runs = async () => (await readFile(path.join(dir, 'runs.txt'), 'utf8').catch(() => '')).trim().split('\n').filter(Boolean);

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'lignee-faces-worker-'));
  const python = path.join(dir, 'python');
  await writeFile(python, `#!/bin/sh
[ "$1" = "-c" ] && exit 0
shift 3
echo "$#" >> "${dir}/runs.txt"
for f in "$@"; do
  case "$f" in
    *broken*) echo '{"error": "unreadable image"}' ;;
    *) echo '{"size": [1000, 800], "faces": [{"box": [0.1, 0.1, 0.2, 0.2], "score": 0.9, "vec": [1, 0, 0]}]}' ;;
  esac
done
`);
  await chmod(python, 0o755);
  for (const f of ['new.jpg', 'old.jpg', 'broken.jpg']) await writeFile(path.join(dir, f), 'x');
  process.env.LIGNEE_FACES = python;
  process.env.LIGNEE_FACES_MODELS = dir;
  faces = await import('../faces.js');
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('visages : programme de l’ordinateur', { skip: process.platform === 'win32' }, () => {
  test('sans les modèles : indisponible ; avec : les visages connus comparés, une seule lecture par image', async () => {
    assert.deepEqual(await faces.facesStatus(), { ready: false });
    await assert.rejects(faces.findFaces(path.join(dir, 'new.jpg'), [], []), (e) => e.status === 503);
    for (const m of ['face_detection_yunet_2023mar.onnx', 'face_recognition_sface_2021dec.onnx']) await writeFile(path.join(dir, m), '');
    assert.deepEqual(await faces.facesStatus(), { ready: true });

    const refs = [
      { id: 'a', file: path.join(dir, 'old.jpg'), x: 20, y: 20 },
      { id: 'b', file: path.join(dir, 'broken.jpg') },
      { id: 'c', file: path.join(dir, 'gone.jpg') },
    ];
    assert.deepEqual(await faces.findFaces(path.join(dir, 'new.jpg'), refs, []), [{ x: 20, y: 20, w: 20, box: [0.1, 0.1, 0.2, 0.2], id: 'a', score: 1 }]);
    assert.deepEqual(await runs(), ['3'], 'une image disparue n’est pas lue');
    assert.deepEqual(await faces.findFaces(path.join(dir, 'new.jpg'), refs, [{ id: 'a', x: 20, y: 20 }]), [], 'visage déjà repéré');
    assert.deepEqual(await runs(), ['3'], 'déjà lues : gardées en mémoire');

    // Toute la galerie : le visage de « new » ressemble à celui d'Anne ; portrait de Bruno sur « old »
    await writeFile(path.join(dir, 'other.jpg'), 'x');
    const images = [{ photo: 'photos/new.jpg', file: path.join(dir, 'new.jpg'), tags: [] }, { photo: 'photos/other.jpg', file: path.join(dir, 'other.jpg'), tags: [] }];
    const o = await faces.faceOverview(images, [{ id: 'b', photo: 'photos/old.jpg', file: path.join(dir, 'old.jpg'), x: 20, y: 20 }], new Set(['b']));
    assert.deepEqual(o.groups, [], 'semblables à un visage connu : pas des inconnus');
    assert.deepEqual(o.portraits, [{ id: 'b', photo: 'photos/old.jpg', x: 20, y: 20, w: 20, box: [0.1, 0.1, 0.2, 0.2] }]);
    const alone = await faces.faceOverview(images, [], new Set());
    assert.equal(alone.groups.length, 1, 'sans visage connu : les deux visages semblables groupés');
    assert.deepEqual(await runs(), ['3', '1'], 'seule l’image nouvelle est lue');
  });
});
