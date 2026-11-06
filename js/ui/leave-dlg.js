/**
 * Another person chosen while a record is being edited: rather than ignoring the click,
 * the user chooses between going back to the form and discarding it to go on.
 */
import { S } from '../state.js';
import { $ } from '../utils/dom.js';
import { t } from '../i18n.js';
import { P, fullName } from '../model/people.js';

let next = null; // what to do once the input is discarded

export const leaveOpen = () => !$('#leaveDlg').hidden;

/**
 * Asks before leaving the record being edited for person `id`, to show them or, with `edit`,
 * to edit them; `go` runs if the user discards the input.
 */
export function askLeave(id, go, edit) {
  const edited = S.edit && S.edit.id ? P(S.edit.id) : null;
  next = go;
  $('#leaveText').textContent = edited ? t('leave.text', fullName(edited)) : t('leave.textNew');
  $('#leaveDrop').textContent = t(edit ? 'leave.dropEdit' : 'leave.drop', fullName(P(id)));
  $('#leaveDlg').hidden = false;
  $('#leaveResume').focus();
}

/** Closes the dialog and returns what was waiting, if the user discards the input. */
export function closeLeave(drop) {
  $('#leaveDlg').hidden = true;
  const go = next;
  next = null;
  return drop ? go : null;
}
