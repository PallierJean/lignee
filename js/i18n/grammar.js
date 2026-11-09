/** Grammar helpers of the texts: plurals, agreement by sex, elision, kinship terms. */

export const s = (n) => (n > 1 ? 's' : '');
export const sEn = (n) => (n === 1 ? '' : 's');

/** Agreement by sex: masculine, feminine, or a neutral form if the sex isn't specified. */
export const g = (sex, m, f, n) => (sex === 'F' ? f : sex === 'M' ? m : n);
export const startsVowel = (x) => /^[aeiouyàâäéèêëîïôöùûü]/i.test(x);
export const de = (name) => (startsVowel(name) ? 'd’' + name : 'de ' + name);
export const art = (term, sex) => (startsVowel(term) ? 'l’' : g(sex, 'le ', 'la ', '')) + term;

/**
 * Name of the relationship: what the first person is to the second. da and db: generations
 * from each to the common ancestor.
 */
export function kinFr(da, db, sex, half) {
  const again = (n) => 'arrière-'.repeat(Math.max(0, n));
  if (da === 0) {
    if (db === 1) return g(sex, 'père', 'mère', 'parent');
    return again(db - 2) + g(sex, 'grand-père', 'grand-mère', 'grand-parent');
  }
  if (db === 0) {
    if (da === 1) return g(sex, 'fils', 'fille', 'enfant');
    return again(da - 2) + g(sex, 'petit-fils', 'petite-fille', 'petit-enfant');
  }
  if (da === 1 && db === 1) return (half ? 'demi-' : '') + g(sex, 'frère', 'sœur', half ? 'frère ou sœur' : 'frère ou sœur');
  if (da === 1) {
    if (db === 2) return g(sex, 'oncle', 'tante', 'oncle ou tante');
    return again(db - 3) + g(sex, 'grand-oncle', 'grand-tante', 'grand-oncle ou grand-tante');
  }
  if (db === 1) {
    if (da === 2) return g(sex, 'neveu', 'nièce', 'neveu ou nièce');
    return again(da - 3) + g(sex, 'petit-neveu', 'petite-nièce', 'petit-neveu ou petite-nièce');
  }
  if (da === 2 && db === 2) return g(sex, 'cousin germain', 'cousine germaine', 'cousin(e) germain(e)');
  if (da === 3 && db === 3) return g(sex, 'cousin issu de germains', 'cousine issue de germains', 'cousin(e) issu(e) de germains');
  if (da === 2 && db === 3) return g(sex, 'oncle', 'tante', 'oncle ou tante') + ' à la mode de Bretagne';
  if (da === 3 && db === 2) return g(sex, 'neveu', 'nièce', 'neveu ou nièce') + ' à la mode de Bretagne';
  return g(sex, 'cousin', 'cousine', 'cousin(e)') + ` au ${da + db}e degré`;
}

export function kinEn(da, db, sex, half) {
  const again = (n) => 'great-'.repeat(Math.max(0, n));
  if (da === 0) return db === 1 ? g(sex, 'father', 'mother', 'parent') : again(db - 2) + g(sex, 'grandfather', 'grandmother', 'grandparent');
  if (db === 0) return da === 1 ? g(sex, 'son', 'daughter', 'child') : again(da - 2) + g(sex, 'grandson', 'granddaughter', 'grandchild');
  if (da === 1 && db === 1) return (half ? 'half-' : '') + g(sex, 'brother', 'sister', 'sibling');
  if (da === 1) return again(db - 2) + g(sex, 'uncle', 'aunt', 'uncle or aunt');
  if (db === 1) return again(da - 2) + g(sex, 'nephew', 'niece', 'nephew or niece');
  const degree = Math.min(da, db) - 1;
  const removed = Math.abs(da - db);
  const ord = ['first', 'second', 'third'][degree - 1] || degree + 'th';
  return `${ord} cousin` + (removed ? ` ${removed === 1 ? 'once' : removed === 2 ? 'twice' : removed + ' times'} removed` : '');
}
