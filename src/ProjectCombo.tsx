import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Folder, Plus } from "lucide-react";
import type { Project } from "./model";

export default function ProjectCombo({
  projects,
  value,
  onPick,
  onCreate,
}: {
  projects: Project[];
  value: string;
  onPick: (project: Project) => void;
  onCreate: (name: string) => void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = projects.find((project) => project.id === value);
  const query = text.trim().toLowerCase();
  const matches = projects.filter(
    (project) => !project.closed && project.name.toLowerCase().includes(query),
  );
  const canCreate =
    !!query &&
    !projects.some((project) => project.name.toLowerCase() === query);
  const count = matches.length + Number(canCreate);
  const show = () => {
    setText("");
    setIndex(-1);
    setOpen(true);
  };
  const choose = (choice: number) => {
    if (matches[choice]) onPick(matches[choice]);
    else if (canCreate && choice === matches.length) onCreate(text.trim());
    else return;
    setOpen(false);
    setIndex(-1);
  };
  useEffect(() => {
    if (open && index >= 0)
      menu.current?.children[index]?.scrollIntoView?.({ block: "nearest" });
  }, [open, index]);
  return (
    <div
      className="project-combo"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <input
        ref={input}
        role="combobox"
        aria-label="Project"
        aria-expanded={open}
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={
          open && index >= 0 ? `${id}-${index}` : undefined
        }
        value={open ? text : current?.name || ""}
        placeholder="Choose or create project…"
        onFocus={show}
        onClick={() => {
          if (!open) show();
        }}
        onChange={(event) => {
          setText(event.target.value);
          setIndex(-1);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setIndex(-1);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              show();
              setIndex(
                event.key === "ArrowDown"
                  ? projects.some((project) => !project.closed)
                    ? 0
                    : -1
                  : projects.filter((project) => !project.closed).length - 1,
              );
            } else if (count)
              setIndex((previous) =>
                event.key === "ArrowDown"
                  ? (previous + 1) % count
                  : previous <= 0
                    ? count - 1
                    : previous - 1,
              );
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (!open) {
              show();
              return;
            }
            if (index >= 0) choose(index);
            else {
              const exact = matches.findIndex(
                (project) => project.name.toLowerCase() === query,
              );
              if (exact >= 0) choose(exact);
              else if (!query && matches.length) choose(0);
              else if (canCreate) choose(matches.length);
            }
          }
        }}
      />
      <button
        type="button"
        className="combo-toggle"
        aria-label="Toggle project list"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) setOpen(false);
          else {
            input.current?.focus();
            show();
          }
        }}
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="listbox"
          aria-label="Projects"
          className="combo-menu"
        >
          {matches.map((project, choice) => (
            <button
              type="button"
              role="option"
              tabIndex={-1}
              id={`${id}-${choice}`}
              key={project.id}
              aria-selected={index === choice}
              className={index === choice ? "keyboard-selected" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(choice)}
            >
              <Folder size={14} />
              {project.name}
              {project.id === value && <Check size={14} />}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              role="option"
              tabIndex={-1}
              id={`${id}-${matches.length}`}
              aria-selected={index === matches.length}
              className={index === matches.length ? "keyboard-selected" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(matches.length)}
            >
              <Plus size={14} />
              Create “{text.trim()}”
            </button>
          )}
          {!count && <span>No open projects</span>}
        </div>
      )}
    </div>
  );
}
