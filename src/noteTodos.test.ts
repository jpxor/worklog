import { expect, it } from "vitest";
import type { Note } from "./model";
import { noteTodos, setTodoChecked, sortedProjectNotes } from "./noteTodos";
const path = "projects/one/notes/log.md";
it("finds Markdown tasks, including nested, quoted and numbered items, but ignores code and ordinary prose", () => {
  const content = [
    "- [ ] first",
    "  - [X] nested",
    "",
    "> - [ ] quoted",
    "",
    "1. [ ] numbered",
    "",
    "```md",
    "- [ ] example",
    "```",
    "",
    "    - [ ] indented code",
    "",
    "`- [ ] inline`",
    "",
    "Mention [ ] something",
  ].join("\n");
  expect(
    noteTodos({ path, content }).map((todo) => [
      todo.text,
      todo.checked,
      todo.line,
    ]),
  ).toEqual([
    ["first", false, 1],
    ["nested", true, 2],
    ["quoted", false, 4],
    ["numbered", false, 6],
  ]);
});
it("changes only the chosen checkbox and preserves CRLF and repeated item text", () => {
  const content = "# Log\r\n\r\n- [ ] repeat\r\n- [ ] repeat\r\n";
  const todos = noteTodos({ path, content });
  const updated = setTodoChecked(content, todos[1], true);
  expect(updated).toBe("# Log\r\n\r\n- [ ] repeat\r\n- [x] repeat\r\n");
  expect(
    setTodoChecked(updated, noteTodos({ path, content: updated })[1], false),
  ).toBe(content);
  expect(() => setTodoChecked(updated, todos[1], true)).toThrow("changed");
});
it("does not interpret checkboxes in txt files or binary documents", () => {
  expect(noteTodos({ path: "plain.txt", content: "- [ ] literal" })).toEqual(
    [],
  );
  expect(noteTodos({ path, kind: "image", content: "- [ ] literal" })).toEqual(
    [],
  );
});
it("sorts unfinished notes first, then modification date, with project isolation and deterministic ties", () => {
  const notes: Note[] = [
    { path: "projects/one/notes/new.md", content: "New", modified: 500 },
    {
      path: "projects/two/notes/other.md",
      content: "- [ ] other",
      modified: 900,
    },
    { path: "projects/one/notes/old.md", content: "- [ ] old", modified: 100 },
    {
      path: "projects/one/notes/current.md",
      content: "- [ ] current",
      modified: 200,
    },
    { path: "projects/one/notes/a.md", content: "Missing date" },
    { path: "projects/one/notes/b.md", content: "Missing date" },
  ];
  expect(
    sortedProjectNotes(notes, "one").map((item) =>
      item.note.path.split("/").pop(),
    ),
  ).toEqual(["current.md", "old.md", "new.md", "a.md", "b.md"]);
});
