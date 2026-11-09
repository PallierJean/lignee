// semantic-release plugin: release notes in English, then in French, from the commits.
// The French text comes from an `Fr:` trailer in the commit body; without it the English line is reused.
// Each line starts with a capital letter. No dependency: it reads the commits semantic-release passes.

const SECTIONS = [
  { type: 'feat', en: 'Features', fr: 'Nouveautés' },
  { type: 'fix', en: 'Bug Fixes', fr: 'Corrections' },
  { type: 'perf', en: 'Performance Improvements', fr: 'Performances' },
  { type: 'revert', en: 'Reverts', fr: 'Annulations' },
];
const BREAKING = { en: '⚠ BREAKING CHANGES', fr: '⚠ Changements incompatibles' };

const HEADER = /^(\w+)(?:\(([^)]*)\))?(!)?: (.+)$/;
const FRENCH = /^Fr:[ \t]*(.+)$/im;
// The note runs until a blank line, another trailer or the end of the message
const BREAKING_NOTE = /^BREAKING[ -]CHANGE:[ \t]*([\s\S]+?)(?=\n[ \t]*\n|\n[\w-]+: |(?![\s\S]))/m;

export const capitalize = (text) => text.charAt(0).toLocaleUpperCase('fr') + text.slice(1);

/** https://github.com/owner/repo, from the remote URL (https, ssh or git+https, credentials removed). */
export function repoHttpUrl(url = '') {
  return url
    .replace(/^git\+/, '')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/\/\/[^/@]+@/, '//')
    .replace(/\.git$/, '');
}

/** Commit message → { type, scope, en, fr, breaking } or null when it is not a conventional commit. */
export function parseCommit(message) {
  const [header, ...rest] = message.trim().split('\n');
  const match = HEADER.exec(header);
  if (!match) return null;
  const [, type, scope, bang, subject] = match;
  const body = rest.join('\n');
  const fr = FRENCH.exec(body)?.[1].trim();
  const note = BREAKING_NOTE.exec(body)?.[1].trim().replace(/\s*\n\s*/g, ' ');
  return {
    type: type.toLowerCase(),
    scope,
    en: subject.trim(),
    fr: fr || subject.trim(),
    breaking: note || (bang ? subject.trim() : null),
  };
}

export function generateNotes(pluginConfig, context) {
  const { commits = [], lastRelease = {}, nextRelease, options = {} } = context;
  const repo = repoHttpUrl(options.repositoryUrl);
  const date = new Date().toISOString().slice(0, 10);
  const title = lastRelease.gitTag
    ? `[${nextRelease.version}](${repo}/compare/${lastRelease.gitTag}...${nextRelease.gitTag})`
    : nextRelease.version;

  const entries = commits
    .map((commit) => ({ ...parseCommit(commit.message), hash: commit.hash }))
    .filter((entry) => entry.type);

  const link = ({ hash }) => `([${hash.slice(0, 7)}](${repo}/commit/${hash}))`;
  const line = (entry, text) => {
    const scope = entry.scope ? `**${entry.scope}:** ` : '';
    return `* ${scope}${capitalize(text)} ${link(entry)}`;
  };
  const sections = (lang) => {
    const out = [];
    const breaking = entries.filter((entry) => entry.breaking);
    if (breaking.length) {
      out.push(`### ${BREAKING[lang]}`, '', ...breaking.map((entry) => line(entry, entry.breaking)), '');
    }
    for (const section of SECTIONS) {
      const list = entries.filter((entry) => entry.type === section.type);
      if (list.length) out.push(`### ${section[lang]}`, '', ...list.map((entry) => line(entry, entry[lang])), '');
    }
    return out;
  };

  const english = sections('en');
  if (!english.length) return `## ${title} (${date})\n`;
  return [`## ${title} (${date})`, '', ...english, '---', '', ...sections('fr')].join('\n');
}
