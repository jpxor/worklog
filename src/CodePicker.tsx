import { useState } from "react";
import ProjectCombo from "./ProjectCombo";
import type { ProjectCode } from "./model";

export default function CodePicker({
  codes,
  value,
  onPick,
  onCreate,
  onRestore,
}: {
  codes: ProjectCode[];
  value: string;
  onPick: (id: string) => void;
  onCreate: (label: string) => Promise<string>;
  onRestore: (code: ProjectCode) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [failedLabel, setFailedLabel] = useState("");
  const create = async (label: string) => {
    setError("");
    setFailedLabel(label);
    try {
      const existing = codes.find(
        (c) => c.label.toLowerCase() === label.trim().toLowerCase(),
      );
      if (existing?.archived) {
        setError("This code is archived. Restore it to select it.");
        return;
      }
      onPick(await onCreate(label));
      setFailedLabel("");
    } catch (e) {
      setError(String(e));
    }
  };
  const archived = codes.find(
    (c) =>
      c.archived &&
      (c.id === value || c.label.toLowerCase() === failedLabel.toLowerCase()),
  );
  return (
    <div>
      <ProjectCombo
        includeClosed
        label="Project code"
        projects={codes.map((c) => ({
          id: c.id,
          name: c.label,
          closed: c.archived,
          defaultProjectCodeId: c.id,
        }))}
        value={value}
        onPick={(c) => {
          if (c.closed) {
            setFailedLabel(c.name);
            setError("This code is archived. Restore it to select it.");
          } else onPick(c.id);
        }}
        onCreate={create}
      />
      {error && (
        <p role="alert">
          {error}{" "}
          {failedLabel && (
            <button type="button" onClick={() => create(failedLabel)}>
              Retry {failedLabel}
            </button>
          )}
        </p>
      )}
      {archived && (
        <span className="field-hint">
          Archived · Choose another code{" "}
          <button
            type="button"
            onClick={async () => {
              try {
                await onRestore(archived);
                onPick(archived.id);
                setError("");
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Restore code
          </button>
        </span>
      )}
    </div>
  );
}
