import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNotes, parseCommit, repoHttpUrl, capitalize } from '../scripts/release-notes.mjs';

const REPO = 'https://github.com/PallierJean/lignee';
const context = (messages) => ({
  commits: messages.map((message, i) => ({ message, hash: `${i}abcdef0123456789` })),
  lastRelease: { gitTag: 'v1.20.0' },
  nextRelease: { version: '1.20.1', gitTag: 'v1.20.1' },
  options: { repositoryUrl: `${REPO}.git` },
});

test('release notes: English first, then French, each line capitalized', () => {
  const notes = generateNotes({}, context([
    'fix: let the side panel scroll on phones\n\nBody.\n\nFr: le panneau latéral défile sur téléphone\nCo-Authored-By: X <x@y>',
    'feat(gedcom): read the notes\n\nFr: lire les notes',
    'docs: move text\n\nFr: déplacer du texte',
    'Merge fix/something',
  ]));
  const date = new Date().toISOString().slice(0, 10);
  assert.equal(notes, [
    `## [1.20.1](${REPO}/compare/v1.20.0...v1.20.1) (${date})`,
    '',
    '### Features',
    '',
    `* **gedcom:** Read the notes ([1abcdef](${REPO}/commit/1abcdef0123456789))`,
    '',
    '### Bug Fixes',
    '',
    `* Let the side panel scroll on phones ([0abcdef](${REPO}/commit/0abcdef0123456789))`,
    '',
    '---',
    '',
    '### Nouveautés',
    '',
    `* **gedcom:** Lire les notes ([1abcdef](${REPO}/commit/1abcdef0123456789))`,
    '',
    '### Corrections',
    '',
    `* Le panneau latéral défile sur téléphone ([0abcdef](${REPO}/commit/0abcdef0123456789))`,
    '',
  ].join('\n'));
});

test('release notes: refactorings get their own section', () => {
  const notes = generateNotes({}, context(['refactor: split a module\n\nFr: découper un module']));
  assert.match(notes, /### Code Refactoring\n\n\* Split a module /);
  assert.match(notes, /### Refontes\n\n\* Découper un module /);
});

test('release notes: without an Fr trailer the English text is reused', () => {
  const notes = generateNotes({}, context(['fix: keep the order']));
  assert.match(notes, /### Corrections\n\n\* Keep the order /);
});

test('release notes: breaking changes come first in both languages', () => {
  const notes = generateNotes({}, context([
    'feat!: drop the old format\n\nBREAKING CHANGE: old files must be\nconverted first.\n\nFr: abandon de l\'ancien format',
  ]));
  assert.match(notes, /### ⚠ BREAKING CHANGES\n\n\* Old files must be converted first\. /);
  assert.match(notes, /### ⚠ Changements incompatibles\n\n\* Old files must be converted first\. /);
  assert.match(notes, /### Nouveautés\n\n\* Abandon de l'ancien format /);
});

test('release notes: first release and release without visible change', () => {
  const ctx = context(['chore: tidy']);
  ctx.lastRelease = {};
  assert.match(generateNotes({}, ctx), /^## 1\.20\.1 \(\d{4}-\d{2}-\d{2}\)\n$/);
});

test('release notes: helpers', () => {
  assert.equal(parseCommit('Merge branch x'), null);
  assert.equal(parseCommit('fix!: a').breaking, 'a');
  assert.equal(capitalize('écran'), 'Écran');
  assert.equal(repoHttpUrl('git@github.com:o/r.git'), 'https://github.com/o/r');
  assert.equal(repoHttpUrl('git+https://x-access-token:t@github.com/o/r.git'), 'https://github.com/o/r');
  assert.equal(repoHttpUrl('ssh://git@github.com/o/r.git'), 'https://github.com/o/r');
});
