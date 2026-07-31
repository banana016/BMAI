/**
 * A session-local (in-memory, never persisted) log of user actions —
 * upload, clear, print, note-save. This is deliberately *not* a real audit
 * trail: it lives only in this tab's memory and disappears on refresh. Real
 * access control and a server-side audit log require a backend, which this
 * browser-only architecture (design doc 1.2) doesn't have. This exists so
 * the user can see what happened in the current session, not to satisfy a
 * compliance requirement.
 */
export interface AuditEvent {
  timestamp: string;
  action: string;
  detail?: string;
}

const MAX_EVENTS = 50;
let events: AuditEvent[] = [];
const listeners = new Set<() => void>();

export function logEvent(action: string, detail?: string): void {
  events = [{ timestamp: new Date().toISOString(), action, detail }, ...events].slice(0, MAX_EVENTS);
  for (const listener of listeners) listener();
}

export function getEvents(): AuditEvent[] {
  return events;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearEvents(): void {
  events = [];
  for (const listener of listeners) listener();
}
