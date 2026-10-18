import type { Note } from "./model";

/** One result per matching text note, with the exact first-match cursor. */
export function searchNotes(notes: Note[], query: string) {
  const text = query.trim();
  if (!text) return [];
  const pattern = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return notes
    .filter((note) => !note.kind)
    .flatMap((note) => {
      pattern.lastIndex = 0;
      const match = pattern.exec(note.content);
      if (!match) return [];
      const cursor = match.index;
      const lineStart = note.content.lastIndexOf("\n", cursor - 1) + 1;
      const lineEnd = note.content.indexOf("\n", cursor);
      const start = Math.max(lineStart, cursor - 70);
      const end = Math.min(
        lineEnd < 0 ? note.content.length : lineEnd,
        cursor + text.length + 100,
      );
      return [
        {
          path: note.path,
          cursor,
          line: note.content.slice(0, cursor).split("\n").length,
          snippet:
            (start > lineStart ? "…" : "") +
            note.content.slice(start, end).trim() +
            (end < (lineEnd < 0 ? note.content.length : lineEnd) ? "…" : ""),
        },
      ];
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
