import { useState } from "react";
import type { Note } from "./model";
import { noteTodos, type NoteTodo } from "./noteTodos";
export default function GlobalOverview({
  notes,
  pinned,
  onOpen,
  onNew,
  onToggle,
  disabled,
}: {
  notes: Note[];
  pinned: string[];
  onOpen: (path: string, cursor?: number) => void;
  onNew: () => void;
  onToggle: (note: Note, todo: NoteTodo, checked: boolean) => Promise<boolean>;
  disabled: boolean;
}) {
  const [working, setWorking] = useState(false);
  const global = notes.filter((n) => n.path.startsWith("global/notes/"));
  const link = (n: Note) => (
    <button onClick={() => onOpen(n.path)}>{n.path.slice(13)}</button>
  );
  const todos = global.flatMap((note) =>
    noteTodos(note)
      .filter((t) => !t.checked)
      .map((todo) => ({ note, todo })),
  );
  return (
    <section className="project-overview">
      <div className="breadcrumb">Global notes / Overview</div>
      <header className="overview-header">
        <h1>Global notes</h1>
        <button onClick={onNew} disabled={disabled}>
          New global note
        </button>
      </header>
      {!global.length ? (
        <p>
          Notes shared across all tasks in this workspace. Use them for
          reference material, procedures, and general notes.
        </p>
      ) : (
        <>
          <h2>Unchecked items</h2>
          {!todos.length && <p>No unchecked items</p>}
          <ul>
            {todos.map(({ note, todo }) => (
              <li key={note.path + todo.from}>
                <input
                  type="checkbox"
                  aria-label={todo.text}
                  checked={todo.checked}
                  disabled={disabled || working}
                  onChange={async () => {
                    setWorking(true);
                    try {
                      await onToggle(note, todo, true);
                    } finally {
                      setWorking(false);
                    }
                  }}
                />
                <button onClick={() => onOpen(note.path, todo.from)}>
                  {note.path.slice(13)} · {todo.text}
                </button>
              </li>
            ))}
          </ul>
          <h2>Pinned notes</h2>
          {!pinned.some((p) => global.some((n) => n.path === p)) && (
            <p>No pinned notes</p>
          )}
          <ul>
            {pinned
              .map((p) => global.find((n) => n.path === p))
              .filter((n): n is Note => !!n)
              .map((n) => (
                <li key={n.path}>{link(n)}</li>
              ))}
          </ul>
          <h2>Recent notes</h2>
          <ul>
            {[...global]
              .sort(
                (a, b) =>
                  (b.modified || 0) - (a.modified || 0) ||
                  a.path.localeCompare(b.path),
              )
              .slice(0, 10)
              .map((n) => (
                <li key={n.path}>
                  {link(n)}{" "}
                  {n.modified ? new Date(n.modified).toLocaleDateString() : ""}
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
