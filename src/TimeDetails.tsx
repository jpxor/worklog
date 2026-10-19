import CodePicker from "./CodePicker";
import type { ProjectCode } from "./model";
import { useState } from "react";
import {
  duration,
  formatTime,
  validDate,
  today,
  weekRange,
  type Entry,
  type Project,
} from "./model";

export default function TimeDetails({
  projectCodes = [],
  onCreateCode = async () => "",
  onRestoreCode = async () => {},
  entries,
  weekly = false,
  projects,
  date,
  initialEntryId,
  busy,
  error,
  onSave,
  onRemove,
}: {
  projectCodes?: ProjectCode[];
  onCreateCode?: (label: string) => Promise<string>;
  onRestoreCode?: (code: ProjectCode) => Promise<void>;
  entries: Entry[];
  weekly?: boolean;
  projects: Project[];
  date: string;
  initialEntryId?: string | null;
  busy: boolean;
  error: string;
  onSave: (entry: Entry, previous: Entry) => Promise<boolean>;
  onRemove: (entry: Entry) => Promise<boolean>;
}) {
  const initial = entries.find((e) => e.id === initialEntryId) || null;
  const [editing, setEditing] = useState<Entry | null>(
    initial ? { ...initial } : null,
  );
  const [original, setOriginal] = useState<Entry | null>(initial);
  const [time, setTime] = useState(initial ? formatTime(initial.minutes) : "");
  const [anchor, setAnchor] = useState(date);
  const [from, through] = weekRange(anchor);
  const navigate = (value: string) => {
    if (!validDate(value)) return;
    if (editing && !window.confirm("Discard unsaved entry changes?")) return;
    setEditing(null);
    setOriginal(null);
    setAnchor(value);
  };
  const shiftWeek = (days: number) => {
    const value = new Date(from + "T12:00:00");
    value.setDate(value.getDate() + days);
    navigate(
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`,
    );
  };
  const rows = entries
    .filter((e) =>
      weekly ? e.date >= from && e.date <= through : e.date === date,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const totals = projects
    .map((p) => ({
      ...p,
      minutes: rows
        .filter((e) => e.projectId === p.id)
        .reduce((sum, e) => sum + e.minutes, 0),
    }))
    .filter((p) => p.minutes > 0);
  const startEdit = (entry: Entry) => {
    setOriginal(entry);
    setEditing({ ...entry });
    setTime(formatTime(entry.minutes));
  };
  const minutes = duration(time);
  return (
    <div className="time-details">
      {weekly && (
        <div className="history-navigation">
          <button disabled={busy} onClick={() => shiftWeek(-7)}>
            Previous week
          </button>
          <label>
            Jump to date
            <input
              disabled={busy}
              type="date"
              value={anchor}
              onChange={(e) => navigate(e.target.value)}
            />
          </label>
          <button disabled={busy} onClick={() => navigate(today())}>
            This week
          </button>
          <button disabled={busy} onClick={() => shiftWeek(7)}>
            Next week
          </button>
        </div>
      )}
      <div className="details-total">
        <span>Total for {weekly ? `${from} – ${through}` : date}</span>
        <strong>
          {formatTime(rows.reduce((sum, e) => sum + e.minutes, 0))}
        </strong>
      </div>
      {totals.length > 0 && (
        <dl className="details-projects" aria-label="Time by task">
          {totals.map((project) => (
            <div key={project.id}>
              <dt>{project.name}</dt>
              <dd>{formatTime(project.minutes)}</dd>
            </div>
          ))}
        </dl>
      )}
      {error && (
        <p className="shortcut-error" role="alert">
          {error}
        </p>
      )}
      {!rows.length && (
        <p className="muted">
          No time entries for this {weekly ? "week" : "date"}.
        </p>
      )}
      {rows.map((entry) => (
        <article
          className="detail-entry"
          key={entry.id}
          data-entry-id={entry.id}
        >
          {editing?.id === entry.id ? (
            <form
              aria-label="Edit time entry"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!minutes || !validDate(editing.date) || !original) return;
                if (await onSave({ ...editing, minutes }, original)) {
                  setEditing(null);
                  setOriginal(null);
                }
              }}
            >
              <div className="detail-fields">
                <label>
                  Date
                  <input
                    required
                    type="date"
                    value={editing.date}
                    onChange={(e) =>
                      setEditing({ ...editing, date: e.target.value })
                    }
                  />
                </label>
                <label>
                  Task
                  <select
                    aria-label="Task"
                    required
                    value={editing.projectId}
                    onChange={(e) =>
                      setEditing({ ...editing, projectId: e.target.value })
                    }
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                        {project.closed ? " (closed)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Project code
                <CodePicker
                  codes={projectCodes}
                  value={editing.projectCodeId}
                  onPick={(projectCodeId) =>
                    setEditing((current) =>
                      current ? { ...current, projectCodeId } : current,
                    )
                  }
                  onCreate={onCreateCode}
                  onRestore={onRestoreCode}
                />
              </label>
              <label>
                Duration
                <input
                  aria-label="Duration"
                  required
                  autoFocus
                  value={time}
                  placeholder="45m, 1.5h, or 1:30"
                  onChange={(e) => setTime(e.target.value)}
                />
                <span
                  className={`field-hint ${time && !minutes ? "invalid" : ""}`}
                >
                  {minutes
                    ? formatTime(minutes)
                    : "Use minutes, decimal hours, or hours:minutes."}
                </span>
              </label>
              <label>
                Note <span className="optional">optional</span>
                <textarea
                  aria-label="Note"
                  rows={3}
                  value={editing.note}
                  onChange={(e) =>
                    setEditing({ ...editing, note: e.target.value })
                  }
                />
              </label>
              <div className="detail-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(null);
                    setOriginal(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={busy || !minutes || !validDate(editing.date)}
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <header>
                <strong>
                  {projects.find((p) => p.id === entry.projectId)?.name ||
                    "Unknown task"}
                </strong>
                <span>
                  {
                    projectCodes.find((c) => c.id === entry.projectCodeId)
                      ?.label
                  }{" "}
                  · {formatTime(entry.minutes)}
                </span>
              </header>
              {entry.note && <p className="detail-note">{entry.note}</p>}
              <footer>
                <span>{entry.date}</span>
                <button disabled={busy} onClick={() => startEdit(entry)}>
                  Edit
                </button>
                <button disabled={busy} onClick={() => onRemove(entry)}>
                  Remove
                </button>
              </footer>
            </>
          )}
        </article>
      ))}
    </div>
  );
}
