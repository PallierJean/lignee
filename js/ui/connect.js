/** Connects the services' notifications (services/notify.js) to the interface. */
import { on } from '../services/notify.js';
import { toast } from './toast.js';
import { renderAll, afterData } from './render.js';
import { scheduleRepoSave } from './repo-link.js';

let connected = false;

export function connectServices() {
  if (connected) return;
  connected = true;
  on('message', toast);
  on('data', afterData);
  on('access', (force) => renderAll(force));
  on('changed', scheduleRepoSave); // each change goes to the linked GitHub repository
}
