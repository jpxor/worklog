import { useEffect, useRef, useState } from "react";
import {
  bindingError,
  defaultBindings,
  shortcutDefinitions,
  shortcutFromEvent,
  type Bindings,
  type ShortcutAction,
} from "./shortcuts";

export default function ShortcutsPanel({
  bindings,
  onChange,
}: {
  bindings: Bindings;
  onChange: (bindings: Bindings) => void;
}) {
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);
  const change = (id: ShortcutAction, key: string) => {
    const duplicate = shortcutDefinitions.find(
      (d) => d.id !== id && bindings[d.id] === key,
    );
    if (key && duplicate) {
      setError(`${key} is already assigned to ${duplicate.name}.`);
      return;
    }
    const next = { ...bindings, [id]: key };
    const message = bindingError(next);
    if (message) {
      setError(message);
      return;
    }
    onChange(next);
    setRecording(null);
    setError("");
  };
  return (
    <div className="shortcuts-body" ref={panel} tabIndex={-1}>
      <p className="muted small">
        Click a shortcut to change it, then press Ctrl plus a letter (optionally
        Shift), or a function key. Changes save automatically on this computer.
        Escape cancels recording.
      </p>
      {error && (
        <p className="shortcut-error" role="alert">
          {error}
        </p>
      )}
      <table className="shortcuts-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Shortcut</th>
            <th>
              <span className="sr-only">Clear shortcut</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shortcutDefinitions.map((d) => (
            <tr key={d.id}>
              <td>{d.name}</td>
              <td>
                <button
                  className={recording === d.id ? "shortcut-recording" : ""}
                  aria-label={`Change shortcut for ${d.name}`}
                  data-shortcut-capture={
                    recording === d.id ? "true" : undefined
                  }
                  onClick={() => {
                    setRecording(d.id);
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (recording !== d.id) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.key === "Escape") {
                      setRecording(null);
                      setError("");
                      return;
                    }
                    if (["Control", "Shift", "Alt", "Meta"].includes(e.key))
                      return;
                    const key = shortcutFromEvent(e);
                    if (!key) {
                      setError(
                        "Use Ctrl plus a letter, optionally Shift, or a function key.",
                      );
                      return;
                    }
                    change(d.id, key);
                  }}
                >
                  {recording === d.id
                    ? "Press shortcut…"
                    : bindings[d.id] || "Unassigned"}
                </button>
              </td>
              <td>
                <button
                  className="text-button"
                  disabled={!bindings[d.id]}
                  aria-label={`Clear shortcut for ${d.name}`}
                  onClick={() => change(d.id, "")}
                >
                  Clear
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => {
          onChange({ ...defaultBindings });
          setError("");
          setRecording(null);
        }}
      >
        Reset to defaults
      </button>
      <h3>Standard editing & navigation</h3>
      <p className="muted small">These standard controls are fixed.</p>
      <dl className="editor-shortcuts">
        {[
          ["Undo", "Ctrl+Z"],
          ["Redo", "Ctrl+Y / Ctrl+Shift+Z"],
          ["Copy / Cut / Paste", "Ctrl+C / Ctrl+X / Ctrl+V"],
          ["Select all", "Ctrl+A"],
          ["Next / previous search match", "F3 / Shift+F3"],
          ["Create named note / submit form", "Enter"],
          ["New line in note or entry description", "Enter"],
          ["Choose next / previous switcher result", "↓ / ↑"],
          ["Dismiss popup, dialog, or tour", "Escape"],
        ].map(([name, key]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{key}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
