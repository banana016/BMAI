"use client";

import { useSyncExternalStore } from "react";
import { getEvents, subscribe, type AuditEvent } from "./session-log";

export function useSessionLog(): AuditEvent[] {
  return useSyncExternalStore(subscribe, getEvents, getEvents);
}
