export const shortcutDefinitions = [
  { id: "newNote", name: "New note", key: "Ctrl+N" },
  { id: "dailyNote", name: "Today's log", key: "Ctrl+Shift+D" },
  { id: "searchNotes", name: "Search note contents", key: "Ctrl+Shift+F" },
  { id: "switcher", name: "Find project or note", key: "Ctrl+P" },
  { id: "find", name: "Find in current note", key: "Ctrl+F" },
  { id: "save", name: "Save note now", key: "Ctrl+S" },
  { id: "closeNote", name: "Close note tab", key: "Ctrl+W" },
  { id: "timePanel", name: "Toggle docked Log time", key: "Ctrl+Shift+L" },
  { id: "timePopup", name: "Toggle Log time popup", key: "Ctrl+Shift+T" },
  { id: "shortcuts", name: "Keyboard shortcuts", key: "F1" },
] as const;
export type ShortcutAction = (typeof shortcutDefinitions)[number]["id"];
export type Bindings = Record<ShortcutAction, string>;
export const defaultBindings = Object.fromEntries(
  shortcutDefinitions.map((d) => [d.id, d.key]),
) as Bindings;
const reserved = new Set([
  "Ctrl+A",
  "Ctrl+C",
  "Ctrl+X",
  "Ctrl+V",
  "Ctrl+Z",
  "Ctrl+Y",
  "Ctrl+Shift+Z",
  "Ctrl+R",
  "Ctrl+Shift+R",
  "Ctrl+Q",
  "Ctrl+Shift+W",
  "F3",
  "Shift+F3",
  "F5",
  "Ctrl+F5",
]);
export function bindingError(bindings: Bindings): string | null {
  const seen = new Map<string, string>();
  for (const definition of shortcutDefinitions) {
    const key = bindings[definition.id];
    if (!key) continue;
    if (
      !/^(?:Ctrl\+(?:Shift\+)?[A-Z]|(?:Ctrl\+)?(?:Shift\+)?F(?:[1-9]|1[0-2]))$/.test(
        key,
      )
    )
      return "Use Ctrl plus a letter, optionally Shift, or a function key.";
    if (reserved.has(key))
      return `${key} is reserved for standard editing or window controls.`;
    if (seen.has(key)) return `${key} is already assigned to ${seen.get(key)}.`;
    seen.set(key, definition.name);
  }
  return null;
}
export function loadBindings(saved: unknown): Bindings {
  if (!saved || typeof saved !== "object") return { ...defaultBindings };
  const candidate = Object.fromEntries(
    shortcutDefinitions.map((d) => [
      d.id,
      typeof (saved as Bindings)[d.id] === "string"
        ? (saved as Bindings)[d.id]
        : d.key,
    ]),
  ) as Bindings;
  // New default shortcuts must not invalidate existing custom assignments.
  for (const definition of shortcutDefinitions) {
    if (definition.id !== "dailyNote" && definition.id !== "searchNotes")
      continue;
    if (typeof (saved as Bindings)[definition.id] === "string") continue;
    if (
      shortcutDefinitions.some(
        (other) =>
          other.id !== definition.id &&
          (saved as Bindings)[other.id] === candidate[definition.id],
      )
    )
      candidate[definition.id] = "";
  }
  return bindingError(candidate) ? { ...defaultBindings } : candidate;
}
type KeyEvent = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey"
>;
export function shortcutFromEvent(event: KeyEvent): string | null {
  if (event.altKey || event.metaKey) return null;
  const key = event.key.toUpperCase();
  if (!/^(?:[A-Z]|F(?:[1-9]|1[0-2]))$/.test(key)) return null;
  if (key.length === 1 && !event.ctrlKey) return null;
  return `${event.ctrlKey ? "Ctrl+" : ""}${event.shiftKey ? "Shift+" : ""}${key}`;
}
export function shortcutText(text: string, bindings: Bindings): string {
  return text.replace(
    /\{\{(\w+)\}\}/g,
    (_, id: ShortcutAction) => bindings[id] || "the menu action",
  );
}
