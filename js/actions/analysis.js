/** Analysis tab actions: kinship, timeline, anniversaries, duplicates, places, INSEE deaths. */
import { S, savePrefs } from '../state.js';
import { P, sourcesOf, isDead } from '../model/people.js';
import { tagsOf, hasPlace } from '../model/media.js';
import { opSet, opUpdate, opDelete, inBatch, beginAction, commitAction } from '../services/storage.js';
import { closeUnionsAtDeath } from '../services/person-save.js';
import { relationship } from '../model/kinship.js';
import { mergedData } from '../model/duplicates.js';
import { sourcesOfPerson } from '../model/sources.js';
import { renamePatches } from '../model/places.js';
import { deathDifferences } from '../model/insee.js';
import { inseeMatch, ignoreInsee, confirmInsee } from '../services/insee.js';
import { ignorePair } from '../services/dup-ignore.js';
import { renderTree, scrollToFocus, scrollToPerson } from '../tree/render.js';
import { renderSide, renderRecord, afterData } from '../ui/render.js';
import { renderControls } from '../ui/header.js';
import { captureDraft } from '../ui/form.js';
import { toast, reportError } from '../ui/toast.js';
import { t } from '../i18n.js';
import { showSide } from './view.js';

/* ---------- Analysis ---------- */

export function setAnalysisView(view) {
  S.analysis = view;
  renderSide();
}

export function setTimeScope(family) {
  S.timeFamily = family;
  renderSide();
}

/** Anniversaries: previous (-1) or next (+1) month. */
export function shiftMonth(step) {
  const current = S.calMonth || new Date().getMonth() + 1;
  S.calMonth = ((current - 1 + step + 12) % 12) + 1;
  renderSide();
}

/** Opens the kinship view, with person `id` first. */
export function openKin(id) {
  S.kinA = id;
  S.analysis = 'kin';
  S.tab = 'analysis';
  renderSide();
  showSide();
}

export function setKin(side, id) {
  S[side] = id;
  if (S.kinShow) renderTree();
  renderSide();
}

/** Highlights the path in the whole tree, the only view where it is surely visible in full. */
export function showKin() {
  const { path } = relationship(S.kinA, S.kinB);
  if (!path.length) return;
  if (!S.kinShow) S.kinWasFull = S.full;
  S.kinShow = true;
  S.full = true;
  S.fan = false;
  renderControls();
  renderTree();
  renderSide();
  requestAnimationFrame(() => scrollToPerson(path[Math.floor(path.length / 2)]));
}

export function hideKin() {
  S.kinShow = false;
  S.full = S.kinWasFull;
  S.scrollPending = true;
  renderControls();
  renderTree();
  renderSide();
  requestAnimationFrame(scrollToFocus);
}

/* ---------- Duplicates ---------- */

/** "Not a duplicate": the pair is no longer suggested, even after a reload. */
export function ignoreDuplicate(key) {
  ignorePair(key);
  renderSide();
}

/** Merges `drop` into `keep`: links, unions and children move to `keep`, then `drop` disappears. */
export async function mergePeople(keep, drop) {
  if (!S.canWrite || S.busy || !S.people.has(keep) || !S.people.has(drop)) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  S.busy = true;
  beginAction('hist.merge');
  try {
    await inBatch(async () => {
      // Both records' documents, read before the unions change: a union merged into its twin
      // goes, and the marriage documents it cites must not go with it
      const docs = { keep, drop, keepDocs: sourcesOfPerson(keep), dropDocs: sourcesOfPerson(drop) };
      const unionIds = new Map();
      for (const [uid, u] of [...S.unions]) {
        if (u.a !== drop && u.b !== drop) continue;
        const other = u.a === drop ? u.b : u.a;
        const twin = [...S.unions].find(([k, x]) => k !== uid && ((x.a === keep && x.b === other) || (x.a === other && x.b === keep)));
        if (other === keep) await opDelete('unions', uid);
        else if (twin) {
          const [tid, tu] = twin;
          unionIds.set(uid, tid);
          await opUpdate('unions', tid, {
            type: tu.type || u.type || '', date: tu.date || u.date || '', place: tu.place || u.place || '',
            end: tu.end || u.end || '', endDate: tu.endDate || u.endDate || '',
            cause: tu.cause || u.cause || '', formerId: tu.formerId || u.formerId || '',
          });
          await opDelete('unions', uid);
        } else await opUpdate('unions', uid, u.a === drop ? { a: keep } : { b: keep });
      }
      for (const [uid, u] of [...S.unions]) {
        if (u.formerId === drop) await opUpdate('unions', uid, { formerId: keep });
      }
      for (const [id, p] of [...S.people]) {
        if (id === drop || id === keep) continue;
        const patch = {};
        if (p.fatherId === drop) patch.fatherId = keep;
        if (p.motherId === drop) patch.motherId = keep;
        // Marriage sources carried by a spouse: they follow the union kept
        const moved = (s) => String(s.fact || '').startsWith('union:') && unionIds.has(s.fact.slice(6));
        if (sourcesOf(p).some(moved)) {
          patch.sources = sourcesOf(p).map((s) => (moved(s) ? { ...s, fact: 'union:' + unionIds.get(s.fact.slice(6)) } : s));
        }
        if (Object.keys(patch).length) await opUpdate('people', id, patch);
      }
      // Identifications on images: they follow the person kept (once per image, the marker preferred)
      for (const [mid, m] of [...S.media]) {
        const tags = tagsOf(m);
        if (!tags.some((x) => x.id === drop)) continue;
        const moved = tags.map((x) => (x.id === drop ? { ...x, id: keep } : x));
        const mine = moved.filter((x) => x.id === keep);
        const kept = mine.find(hasPlace) || mine[0];
        await opUpdate('media', mid, { tags: moved.filter((x) => x.id !== keep || x === kept) });
      }
      const merged = mergedData(P(keep), P(drop), unionIds, docs);
      merged.updatedAt = Date.now();
      for (const key of ['fatherId', 'motherId']) if (merged[key] === keep || merged[key] === drop) merged[key] = null;
      await opSet('people', keep, merged);
      await opDelete('people', drop);
    });
    if (S.focus === drop) S.focus = keep;
    commitAction();
    S.busy = false;
    S.scrollPending = true;
    savePrefs();
    afterData();
    toast(t('dup.merged'));
  } catch (e) {
    reportError(e);
    commitAction();
    S.busy = false;
    afterData();
  }
}

/**
 * Renames a place everywhere it is cited (births, deaths, events, unions); undone in one go.
 * A record being edited follows too: saving it doesn't bring the old place back.
 */
export async function renamePlace(from, to) {
  to = String(to || '').trim();
  if (!S.canWrite || S.busy) return;
  if (!to || to === from) {
    toast(t('pl.unchanged'));
    return;
  }
  const patches = renamePatches(from, to);
  if (!patches.length) return;
  if (S.edit) {
    captureDraft(); // the form stays in the page, hidden: its input first, then the new place
    const same = (x) => String(x || '').trim() === from;
    const d = S.edit.draft;
    if (same(d.birthPlace)) d.birthPlace = to;
    if (same(d.deathPlace)) d.deathPlace = to;
    for (const x of [...S.edit.unions, ...S.edit.events]) if (same(x.place)) x.place = to;
  }
  S.busy = true;
  beginAction('hist.place');
  try {
    await inBatch(async () => {
      for (const x of patches) await opUpdate(x.collection, x.id, x.patch);
    });
  } catch (e) {
    reportError(e);
    return;
  } finally {
    commitAction();
    S.busy = false;
    afterData();
    if (S.edit) renderRecord(true); // the hidden form takes its draft back, with the new place
  }
  toast(t('pl.renamed', patches.length));
}

/* ---------- INSEE deaths ---------- */

/** Reportable differences between a record and its INSEE certificate (sure or likely match). */
export function inseeDifferences(id) {
  const m = inseeMatch(id);
  return m && m.level !== 'lead' ? deathDifferences(id, m.act) : [];
}

/** Reports difference no. `i` of its INSEE certificate into the record, or all of them (no `i`). */
export async function applyInsee(id, i) {
  if (!S.canWrite || S.busy) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  const diffs = inseeDifferences(id).filter((x, k) => x.patch && (i === undefined || k === i));
  if (!diffs.length) return;
  const patch = Object.assign({}, ...diffs.map((x) => x.patch));
  const dies = patch.deceased && !isDead(P(id));
  S.busy = true;
  beginAction('hist.insee');
  try {
    await inBatch(async () => {
      await opUpdate('people', id, patch);
      if (dies || patch.deathDate) await closeUnionsAtDeath(id);
    });
  } catch (e) {
    reportError(e);
    return;
  } finally {
    commitAction();
    S.busy = false;
    afterData();
  }
  toast(t('ins.applied', diffs.length));
}

/** "That's them": this record's INSEE lead becomes its certificate. */
export function confirmInseeOf(id) {
  confirmInsee(id);
  renderSide();
}

/** Stops showing this record's INSEE differences. */
export function ignoreInseeOf(id) {
  ignoreInsee(id);
  renderSide();
}
