import { useState } from "react";

export function useTextPrompt() {
  const [dialog, setDialog] = useState<{
    title: string;
    value: string;
    resolve: (value: string | null) => void;
    description?: string;
    placeholder?: string;
    submitLabel?: string;
  } | null>(null);
  const ask = (
    title: string,
    value = "",
    options: {
      description?: string;
      placeholder?: string;
      submitLabel?: string;
    } = {},
  ) =>
    new Promise<string | null>((resolve) =>
      setDialog({ title, value, resolve, ...options }),
    );
  const finish = (value: string | null) => {
    dialog?.resolve(value);
    setDialog(null);
  };
  const view = dialog && (
    <div
      className="overlay text-prompt"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") finish(null);
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={dialog.title}
      >
        <form
          className="settings-body"
          onSubmit={(e) => {
            e.preventDefault();
            finish(dialog.value.trim());
          }}
        >
          <label>
            {dialog.title}
            <input
              autoFocus
              required
              placeholder={dialog.placeholder}
              aria-describedby={
                dialog.description ? "text-prompt-hint" : undefined
              }
              value={dialog.value}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
            />
          </label>
          {dialog.description && (
            <p id="text-prompt-hint" className="prompt-hint">
              {dialog.description}
            </p>
          )}
          <div className="settings-actions">
            <button type="button" onClick={() => finish(null)}>
              Cancel
            </button>
            <button className="primary" type="submit">
              {dialog.submitLabel || "Save"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
  return { ask, view };
}
