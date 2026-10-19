import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import ContextMenu from "./ContextMenu";
import { ChevronDown, ChevronRight, FileText, Folder, Pin } from "lucide-react";
import type { Note } from "./model";
import FileIcon from "./FileIcon";

const noteType = "application/x-worknotes-note";
export default function NoteTree({
  notes,
  folders,
  prefix,
  workspace = "",
  onNewNote,
  onNewFolder,
  projectName = "Project root",
  active,
  onOpen,
  onOverview,
  overviewActive = false,
  onMove,
  onRename,
  onDelete,
  onReveal,
  onMoveProject,
  onPin,
  pinned = [],
  disabled = false,
  defaultCollapsed = false,
}: {
  notes: Note[];
  folders: string[];
  prefix: string;
  workspace?: string;
  onNewNote?: (folder: string) => void;
  onNewFolder?: (folder: string) => void;
  projectName?: string;
  active: string;
  onOpen: (path: string) => void;
  onOverview?: () => void;
  overviewActive?: boolean;
  onMove: (path: string, destination: string) => void;
  onRename: (path: string) => void;
  onDelete?: (path: string, folder: boolean) => void;
  onReveal?: (path: string) => void;
  onMoveProject?: (path: string) => void;
  onPin?: (path: string) => void;
  pinned?: string[];
  disabled?: boolean;
  defaultCollapsed?: boolean;
}) {
  const key = `worknotes.tree:${workspace}:${prefix}`;
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      const paths: string[] = Array.isArray(saved) ? saved.filter((path): path is string => typeof path === "string") : [];
      return defaultCollapsed ? [...new Set([...paths, prefix])] : paths;
    } catch {
      return defaultCollapsed ? [prefix] : [];
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(collapsed));
  }, [key, collapsed]);
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    path: string;
    x: number;
    y: number;
    folder: boolean;
  } | null>(null);
  const context = (
    event: MouseEvent<HTMLButtonElement>,
    path: string,
    folder: boolean,
  ) => {
    event.preventDefault();
    window.dispatchEvent(new Event("worknotes:close-context-menus"));
    event.currentTarget.focus();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({
      path,
      folder,
      x: event.clientX || rect.left,
      y: event.clientY || rect.bottom,
    });
  };
  const dragProps = (path: string) => ({
    draggable: !disabled,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(noteType, path);
      event.dataTransfer.effectAllowed = "move";
      setDragged(path);
    },
    onDragEnd: () => {
      setTarget(null);
      setDragged(null);
    },
  });
  const paths = [...new Set([...notes.map((n) => n.path), ...folders])];
  const accepts = (event: DragEvent) =>
    !disabled && event.dataTransfer.types.includes(noteType);
  const dropProps = (folder: string) => ({
    onDragOver: (event: DragEvent) => {
      if (!accepts(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      if (target !== folder) setTarget(folder);
      if (target !== folder && hover.current) clearTimeout(hover.current);
      if (target !== folder && collapsed.includes(folder))
        hover.current = setTimeout(
          () => setCollapsed((c) => c.filter((p) => p !== folder)),
          600,
        );
    },
    onDragLeave: () => {
      setTarget(null);
      if (hover.current) clearTimeout(hover.current);
    },
    onDrop: (event: DragEvent) => {
      if (!accepts(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(null);
      setDragged(null);
      if (hover.current) clearTimeout(hover.current);
      const source = event.dataTransfer.getData(noteType);
      if (
        !notes.some((note) => note.path === source) &&
        !folders.some((path) => path === source)
      )
        return;
      const destination = `${folder}/${source.split("/").pop()}`;
      if (
        source !== destination &&
        !folder.startsWith(source + "/") &&
        folder !== source
      ) {
        setCollapsed((c) => c.filter((p) => p !== folder));
        onMove(source, destination);
      }
      setCollapsed((current) => current.filter((path) => path !== folder));
    },
  });
  const renderFile = (path: string, name: string) => (
    <button
      key={path}
      id={`note:${path}`}
      className={`tree-file ${active === path ? "selected" : ""} ${dragged === path ? "dragging" : ""}`}
      onContextMenu={(event) => context(event, path, false)}
      {...dragProps(path)}
      onClick={() => onOpen(path)}
      title={`${name} · Drag to a folder to move`}
    >
      <FileIcon path={path} />
      <span>{name.replace(/\.md$/, "")}</span>
      {pinned.includes(path) && <Pin size={12} />}
    </button>
  );
  const render = (parent: string) => {
    const names = [
      ...new Set(
        paths
          .filter((path) => path.startsWith(parent + "/"))
          .map((path) => path.slice(parent.length + 1).split("/")[0]),
      ),
    ].sort(
      (a, b) =>
        Number(pinned.includes(`${parent}/${b}`)) -
          Number(pinned.includes(`${parent}/${a}`)) || a.localeCompare(b),
    );
    return names.map((name) => {
      const path = `${parent}/${name}`;
      const file = notes.find((note) => note.path === path);
      return file ? (
        pinned.includes(path) ? null : (
          renderFile(path, name)
        )
      ) : (
        <div key={path}>
          <button
            id={`note:${path}`}
            onContextMenu={(event) => context(event, path, true)}
            {...dragProps(path)}
            className={`tree-folder ${target === path ? "drop-target" : ""}`}
            {...dropProps(path)}
            onClick={() =>
              setCollapsed((current) =>
                current.includes(path)
                  ? current.filter((p) => p !== path)
                  : [...current, path],
              )
            }
          >
            {collapsed.includes(path) ? (
              <ChevronRight size={13} />
            ) : (
              <ChevronDown size={13} />
            )}
            <Folder size={14} />
            {name}
          </button>
          {!collapsed.includes(path) && (
            <div className="tree-indent">{render(path)}</div>
          )}
        </div>
      );
    });
  };
  return (
    <>
      <div className="tree-root-row">
        <button
          className="icon"
          aria-label={`Toggle ${projectName}`}
          aria-expanded={!collapsed.includes(prefix)}
          onClick={() =>
            setCollapsed((c) =>
              c.includes(prefix)
                ? c.filter((p) => p !== prefix)
                : [...c, prefix],
            )
          }
        >
          {collapsed.includes(prefix) ? (
            <ChevronRight size={13} />
          ) : (
            <ChevronDown size={13} />
          )}
        </button>
        <button
          data-note-root={prefix === "global/notes" ? "global" : "task"}
          className={`tree-folder tree-root ${overviewActive ? "selected" : ""} ${target === prefix ? "drop-target" : ""}`}
          title={`Open ${projectName} overview · Drop here to move to ${projectName}${prefix === "global/notes" ? " · Available in every task in this workspace" : ""}`}
          onClick={onOverview}
          onContextMenu={(event) => {
            context(event, prefix, true);
          }}
          {...dropProps(prefix)}
        >
          <Folder size={14} />
          {projectName}
        </button>
      </div>
      {target && (
        <small role="status">
          Move to {projectName}
          {target === prefix ? "" : " / " + target.slice(prefix.length + 1)}
        </small>
      )}
      {!collapsed.includes(prefix) && (
        <>
          <div className="pinned-notes">
            {pinned
              .filter(
                (path) =>
                  path.startsWith(prefix + "/") &&
                  notes.some((note) => note.path === path),
              )
              .map((path) => renderFile(path, path.split("/").at(-1)!))}
          </div>
          {render(prefix)}
          {!paths.some((path) => path.startsWith(prefix + "/")) && onNewNote && (
            <button className="empty-note" disabled={disabled} onClick={() => onNewNote(prefix)}>
              <FileText size={14} />
              Write your first note
            </button>
          )}
        </>
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={menu.folder ? "Folder actions" : "Note actions"}
          onClose={() => setMenu(null)}
          actions={[
            ...(menu.folder && onNewNote
              ? [
                  {
                    label: "New note",
                    run: () => onNewNote(menu.path),
                    disabled,
                  },
                ]
              : []),
            ...(menu.folder && onNewFolder
              ? [
                  {
                    label: "New folder",
                    run: () => onNewFolder(menu.path),
                    disabled,
                  },
                ]
              : []),
            ...(menu.folder && menu.path !== prefix && onMoveProject
              ? [
                  {
                    label: "Move…",
                    run: () => onMoveProject(menu.path),
                    disabled,
                  },
                ]
              : []),
            ...(!menu.folder
              ? [
                  {
                    label: "Rename / move…",
                    run: () => onRename(menu.path),
                    disabled,
                  },
                  ...(onMoveProject
                    ? [
                        {
                          label: "Move…",
                          run: () => onMoveProject(menu.path),
                          disabled,
                        },
                      ]
                    : []),
                  ...(onPin
                    ? [
                        {
                          label: pinned.includes(menu.path)
                            ? "Unpin"
                            : "Pin to top",
                          run: () => onPin(menu.path),
                          disabled,
                        },
                      ]
                    : []),
                ]
              : []),
            ...(onReveal
              ? [
                  {
                    label: menu.folder
                      ? "Open folder"
                      : "Open containing folder",
                    run: () => onReveal(menu.path),
                    disabled,
                  },
                ]
              : []),
            ...(onDelete && menu.path !== prefix
              ? [
                  {
                    label: menu.folder
                      ? "Delete empty folder"
                      : notes.find((note) => note.path === menu.path)?.kind
                        ? "Delete file"
                        : "Delete note",
                    run: () => onDelete(menu.path, menu.folder),
                    disabled,
                  },
                ]
              : []),
          ]}
        />
      )}
    </>
  );
}
