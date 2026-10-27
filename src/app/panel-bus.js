/** Minimal cross-slot bus so the composer-dock entry can open the main panel.
 * Both components live in the same JS module graph (one client bundle), so a
 * module-scoped subscriber list is enough — no window events, no globals. */
const listeners = new Set();

export function requestOpen(tab = null) {
  for (const listener of listeners) {
    try { listener(tab); } catch { /* a broken listener must not block others */ }
  }
}

export function subscribeOpen(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Full-page workbench channel (pill / chip / header button all land here).
const workbenchListeners = new Set();

export function requestWorkbench() {
  for (const listener of workbenchListeners) {
    try { listener(); } catch { /* ignore a broken listener */ }
  }
}

export function subscribeWorkbench(listener) {
  workbenchListeners.add(listener);
  return () => workbenchListeners.delete(listener);
}
