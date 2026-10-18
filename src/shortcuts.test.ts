import { describe, expect, it } from "vitest";
import {
  bindingError,
  defaultBindings,
  loadBindings,
  shortcutFromEvent,
  shortcutText,
} from "./shortcuts";
describe("shortcut preferences", () => {
  it("accepts defaults and custom bindings while blocking conflicts and reserved editing keys", () => {
    expect(bindingError(defaultBindings)).toBeNull();
    expect(
      bindingError({ ...defaultBindings, newNote: "Ctrl+Shift+N" }),
    ).toBeNull();
    expect(bindingError({ ...defaultBindings, newNote: "Ctrl+P" })).toContain(
      "already assigned",
    );
    expect(bindingError({ ...defaultBindings, newNote: "Ctrl+Z" })).toContain(
      "reserved",
    );
    expect(bindingError({ ...defaultBindings, newNote: "N" })).not.toBeNull();
    expect(bindingError({ ...defaultBindings, newNote: "" })).toBeNull();
  });
  it("loads saved preferences, supports cleared bindings, and recovers from invalid configuration", () => {
    expect(loadBindings({ newNote: "Ctrl+Shift+N", find: "" }).newNote).toBe(
      "Ctrl+Shift+N",
    );
    expect(loadBindings({ find: "" }).find).toBe("");
    expect(loadBindings({ newNote: "Ctrl+P" })).toEqual(defaultBindings);
    expect(loadBindings(null)).toEqual(defaultBindings);
  });
  it("normalizes actual key events and rejects unmodified text input", () => {
    const event = {
      key: "n",
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    };
    expect(shortcutFromEvent(event)).toBe("Ctrl+N");
    expect(shortcutFromEvent({ ...event, key: "N", shiftKey: true })).toBe(
      "Ctrl+Shift+N",
    );
    expect(shortcutFromEvent({ ...event, ctrlKey: false })).toBeNull();
    expect(shortcutFromEvent({ ...event, key: "F1", ctrlKey: false })).toBe(
      "F1",
    );
    expect(shortcutFromEvent({ ...event, altKey: true })).toBeNull();
  });
  it("shows current bindings in tutorial text", () => {
    expect(
      shortcutText("Press {{newNote}}", {
        ...defaultBindings,
        newNote: "Ctrl+Shift+N",
      }),
    ).toBe("Press Ctrl+Shift+N");
  });
});

it("preserves custom shortcuts that overlap newly introduced defaults", () => {
  const loaded = loadBindings({
    newNote: "Ctrl+Shift+D",
    find: "Ctrl+Shift+F",
  });
  expect(loaded.newNote).toBe("Ctrl+Shift+D");
  expect(loaded.find).toBe("Ctrl+Shift+F");
  expect(loaded.dailyNote).toBe("");
  expect(loaded.searchNotes).toBe("");
});
