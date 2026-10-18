import { useMemo, useRef, useState } from "react";
import FileIcon from "./FileIcon";
import type { Note, Project } from "./model";
import { sortedProjectNotes, type NoteTodo } from "./noteTodos";

export default function ProjectOverview({
  project,
  notes,
  disabled,
  navigationDisabled = false,
  onOpen,
  onToggle,
  onNewNote,
}: {
  project: Project;
  notes: Note[];
  disabled: boolean;
  navigationDisabled?: boolean;
  onOpen: (path: string, cursor?: number) => void;
  onToggle: (note: Note, todo: NoteTodo, checked: boolean) => Promise<boolean>;
  onNewNote: () => void;
}) {
  const items = useMemo(
    () => sortedProjectNotes(notes, project.id),
    [notes, project.id],
  );
  // Keep rows stationary for this visit, including when the last item is checked.
  const order = useRef(items.map((item) => item.note.path));
  const paths = new Set(items.map((item) => item.note.path));
  order.current = [
    ...order.current.filter((path) => paths.has(path)),
    ...items
      .map((item) => item.note.path)
      .filter((path) => !order.current.includes(path)),
  ];
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [working, setWorking] = useState(false);
  const byPath = new Map(items.map((item) => [item.note.path, item]));
  const count = items.reduce(
    (sum, item) => sum + item.todos.filter((todo) => !todo.checked).length,
    0,
  );
  return (
    <section
      className="project-overview"
      aria-label={`${project.name} project overview`}
    >
      <header className="overview-header">
        <div>
          <h1>{project.name}</h1>
          <p>
            {items.length} {items.length === 1 ? "note" : "notes"} · {count}{" "}
            unfinished {count === 1 ? "item" : "items"}
          </p>
        </div>
        <button onClick={onNewNote} disabled={disabled}>
          New note
        </button>
      </header>
      {items.length ? (
        <ul className="overview-notes">
          {order.current.map((path) => {
            const { note, todos } = byPath.get(path)!;
            const relative = path.split("/").slice(3).join("/");
            const date = note.modified ? new Date(note.modified) : null;
            const visible = todos.filter(
              (todo) => !todo.checked || touched.has(`${path}:${todo.from}`),
            );
            return (
              <li className="overview-note" key={path}>
                <div className="overview-note-heading">
                  <button
                    className="overview-note-link"
                    disabled={navigationDisabled || working}
                    onClick={() => onOpen(path)}
                    title={`Open ${relative}`}
                  >
                    <FileIcon path={path} size={17} />
                    <span>{relative}</span>
                  </button>
                  {date && (
                    <time
                      dateTime={date.toISOString()}
                      title={`Last edited ${date.toLocaleString()}`}
                    >
                      {date.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </time>
                  )}
                </div>
                {visible.length > 0 && (
                  <ul className="overview-todos">
                    {visible.map((todo) => (
                      <li key={todo.from}>
                        <input
                          type="checkbox"
                          aria-label={`Complete ${todo.text} in ${relative}`}
                          checked={todo.checked}
                          disabled={disabled || working}
                          onChange={async (event) => {
                            const checked = event.target.checked;
                            const key = `${path}:${todo.from}`;
                            const alreadyTouched = touched.has(key);
                            setTouched(
                              (previous) => new Set([...previous, key]),
                            );
                            setWorking(true);
                            try {
                              if (
                                !(await onToggle(note, todo, checked)) &&
                                !alreadyTouched
                              )
                                setTouched((previous) => {
                                  const next = new Set(previous);
                                  next.delete(key);
                                  return next;
                                });
                            } finally {
                              setWorking(false);
                            }
                          }}
                        />
                        <button
                          className={todo.checked ? "completed" : ""}
                          disabled={navigationDisabled || working}
                          onClick={() => onOpen(path, todo.from)}
                          title={`Open ${relative}, line ${todo.line}`}
                        >
                          {todo.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overview-empty">
          <p>No notes yet.</p>
          <button onClick={onNewNote} disabled={disabled}>
            Create a note
          </button>
        </div>
      )}
    </section>
  );
}
