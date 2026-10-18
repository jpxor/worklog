import { markdownLanguage } from "@codemirror/lang-markdown";
import { Text } from "@codemirror/state";
import type { Note } from "./model";

export const overviewTab = (projectId: string) => `overview:${projectId}`;
export const overviewProjectId = (tab: string) =>
  tab.startsWith("overview:") ? tab.slice(9) : null;

export interface NoteTodo {
  from: number;
  line: number;
  text: string;
  checked: boolean;
}
export function noteTodos(note: Note): NoteTodo[] {
  if (note.kind || !/\.md$/i.test(note.path)) return [];
  const doc = Text.of(note.content.split("\n"));
  const result: NoteTodo[] = [];
  markdownLanguage.parser.parse(note.content).iterate({
    enter(node) {
      if (node.name !== "TaskMarker") return;
      const line = doc.lineAt(node.from);
      result.push({
        from: node.from,
        line: line.number,
        text: note.content.slice(node.to, line.to).trim() || "Untitled item",
        checked: note.content[node.from + 1].toLowerCase() === "x",
      });
    },
  });
  return result;
}
export function setTodoChecked(
  content: string,
  todo: NoteTodo,
  checked: boolean,
) {
  const marker = content.slice(todo.from, todo.from + 3);
  if (
    !/^\[[ xX]\]$/.test(marker) ||
    (marker[1].toLowerCase() === "x") !== todo.checked
  )
    throw new Error(
      "This checkbox changed. Reopen the project overview and try again.",
    );
  return (
    content.slice(0, todo.from + 1) +
    (checked ? "x" : " ") +
    content.slice(todo.from + 2)
  );
}
export function sortedProjectNotes(notes: Note[], projectId: string) {
  return notes
    .filter((note) => note.path.startsWith(`projects/${projectId}/notes/`))
    .map((note) => ({ note, todos: noteTodos(note) }))
    .sort(
      (a, b) =>
        Number(b.todos.some((t) => !t.checked)) -
          Number(a.todos.some((t) => !t.checked)) ||
        (b.note.modified || 0) - (a.note.modified || 0) ||
        a.note.path.localeCompare(b.note.path),
    );
}
