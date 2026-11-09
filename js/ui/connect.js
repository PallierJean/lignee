/** Connects the services' notifications (services/notify.js) to the interface. */
import { on } from '../services/notify.js';
import { toast } from './toast.js';
import { renderAll, afterData } from './render.js';

let connected = false;

export function connectServices() {
  if (connected) return;
  connected = true;
  on('message', toast);
  on('data', afterData);
  on('access', (force) => renderAll(force));
}
