// Checks that every commit shown in the release notes carries an `Fr:` trailer with its French text.
// Usage: node scripts/check-french.mjs <from> <to>
// Without a known <from> (new branch, rewritten history), only <to> is checked.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseCommit } from './release-notes.mjs';

/** Types listed in the release notes: they need the French text. */
export const NOTED = new Set(['feat', 'fix', 'perf', 'refactor', 'revert']);

/** Subjects of the commits that are listed in the notes but have no `Fr:` trailer. */
export function missingFrench(messages) {
  return messages
    .map((message) => ({ message, entry: parseCommit(message) }))
    .filter(({ entry }) => entry && NOTED.has(entry.type) && !entry.translated)
    .map(({ message }) => message.trim().split('\n')[0]);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

/** Messages of the non-merge commits between `from` (excluded) and `to`. */
export function commitMessages(from, to) {
  let known = /^[0-9a-f]+$/i.test(from || '') && !/^0+$/.test(from);
  if (known) {
    try {
      git('cat-file', '-e', `${from}^{commit}`);
    } catch {
      known = false;
    }
  }
  const range = known ? [`${from}..${to}`] : ['-1', to];
  return git('log', '--no-merges', '--format=%B%x00', ...range)
    .split('\0')
    .map((message) => message.trim())
    .filter(Boolean);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [from, to = 'HEAD'] = process.argv.slice(2);
  const missing = missingFrench(commitMessages(from, to));
  if (missing.length) {
    console.error('These commits need an "Fr: <French text>" trailer for the release notes:');
    for (const subject of missing) console.error('  - ' + subject);
    process.exit(1);
  }
  console.log('Every commit shown in the release notes has its French text.');
}
