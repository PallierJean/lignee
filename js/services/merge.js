/**
 * Three-way merge of a tree's records, field by field: `base` is the version both sides started
 * from, `mine` the open tree, `theirs` what the repository holds now. A field changed on one side
 * only takes that side's value; changed differently on both sides, it is a conflict, settled by
 * `prefer` ('mine' or 'theirs'). `updatedAt` never conflicts: the latest wins.
 * Each side is a Map id -> record (plain JSON objects).
 */

/** JSON with sorted keys: two records with the same content give the same text. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return value === undefined ? '' : JSON.stringify(value);
}

const same = (a, b) => canonical(a) === canonical(b);

/** Merges one record present on both sides. Returns { record, conflict }. */
function mergeFields(base, mine, theirs, prefer) {
  const record = {};
  let conflict = false;
  for (const key of new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)])) {
    const [b, m, t] = [base[key], mine[key], theirs[key]];
    let value;
    if (key === 'updatedAt') value = Math.max(m || 0, t || 0) || undefined;
    else if (same(m, b)) value = t;
    else if (same(t, b) || same(t, m)) value = m;
    else {
      conflict = true;
      value = prefer === 'theirs' ? t : m;
    }
    if (value !== undefined) record[key] = value;
  }
  return { record, conflict };
}

/**
 * Merges one collection. Returns { result: Map id -> record, conflicts: [id] }; without `prefer`,
 * a conflicting field keeps the open tree's value.
 */
export function mergeRecords(base, mine, theirs, prefer = 'mine') {
  const result = new Map();
  const conflicts = [];
  for (const id of new Set([...base.keys(), ...mine.keys(), ...theirs.keys()])) {
    const [b, m, t] = [base.get(id), mine.get(id), theirs.get(id)];
    let record;
    if (m && t) {
      const merged = mergeFields(b || {}, m, t, prefer);
      if (merged.conflict) conflicts.push(id);
      record = merged.record;
    } else if (!b) {
      record = m || t; // added on one side
    } else if (!m && !t) {
      record = undefined; // deleted on both sides
    } else if (!m) {
      // Deleted here: the deletion holds unless the repository changed the record meanwhile
      if (same(t, b)) record = undefined;
      else {
        conflicts.push(id);
        record = prefer === 'theirs' ? t : undefined;
      }
    } else if (same(m, b)) {
      record = undefined; // deleted in the repository, unchanged here
    } else {
      conflicts.push(id);
      record = prefer === 'theirs' ? undefined : m;
    }
    if (record) result.set(id, record);
  }
  return { result, conflicts };
}

/** Records of a backup ({ people: [{id, ...}], unions, sources } as stored in the file), as Maps id -> record. */
export function backupRecords(backup) {
  const index = (list) => new Map((Array.isArray(list) ? list : [])
    .filter((x) => x && typeof x.id === 'string')
    .map(({ id, ...data }) => [id, data]));
  return { people: index(backup && backup.people), unions: index(backup && backup.unions), sources: index(backup && backup.sources) };
}
