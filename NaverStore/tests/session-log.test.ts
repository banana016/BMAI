import { describe, expect, it, beforeEach } from "vitest";
import { clearEvents, getEvents, logEvent, subscribe } from "@/lib/audit/session-log";

describe("session-log", () => {
  beforeEach(() => {
    clearEvents();
  });

  it("records events most-recent first", () => {
    logEvent("A");
    logEvent("B", "detail");
    const events = getEvents();
    expect(events).toHaveLength(2);
    expect(events[0].action).toBe("B");
    expect(events[0].detail).toBe("detail");
    expect(events[1].action).toBe("A");
  });

  it("notifies subscribers on log and clear", () => {
    let notified = 0;
    const unsubscribe = subscribe(() => {
      notified++;
    });
    logEvent("A");
    clearEvents();
    unsubscribe();
    logEvent("B"); // after unsubscribe, should not count
    expect(notified).toBe(2);
    expect(getEvents()).toHaveLength(1);
  });

  it("caps the log at 50 entries", () => {
    for (let i = 0; i < 60; i++) logEvent(`event-${i}`);
    expect(getEvents()).toHaveLength(50);
    expect(getEvents()[0].action).toBe("event-59");
  });

  it("clearEvents empties the log", () => {
    logEvent("A");
    clearEvents();
    expect(getEvents()).toEqual([]);
  });
});
