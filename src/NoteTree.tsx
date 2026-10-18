import { useState, type DragEvent, type MouseEvent } from "react";
import ContextMenu from "./ContextMenu";
import { ChevronDown, ChevronRight, FileText, Folder, Pin } from "lucide-react";
import type { Note } from "./model";
import FileIcon from "./FileIcon";

const noteType = "application/x-worknotes-note";
export default function NoteTree({
  notes,
  folders,
  prefix,
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
}: {
  notes: Note[];
  folders: string[];
  prefix: string;
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
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
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
      setTarget(folder);
    },
    onDragLeave: () => setTarget(null),
    onDrop: (event: DragEvent) => {
      if (!accepts(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(null);
      setDragged(null);
      const source = event.dataTransfer.getData(noteType);
      if (
        !notes.some(
          (note) => note.path === source && source.startsWith(prefix + "/"),
        ) &&
        !folders.some(
          (path) => path === source && path.startsWith(prefix + "/"),
        )
      )
        return;
      const destination = `${folder}/${source.split("/").pop()}`;
      if (
        source !== destination &&
        !folder.startsWith(source + "/") &&
        folder !== source
      )
        onMove(source, destination);
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
      <button
        className={`tree-folder tree-root ${overviewActive ? "selected" : ""} ${target === prefix ? "drop-target" : ""}`}
        title="Open project overview · Drop a note here to move it to the project root"
        onClick={onOverview}
        onContextMenu={(event) => {
          context(event, prefix, true);
        }}
        {...dropProps(prefix)}
      >
        <Folder size={14} />
        {projectName}
      </button>
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
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={menu.folder ? "Folder actions" : "Note actions"}
          onClose={() => setMenu(null)}
          actions={[
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
                          label: "Move to another project…",
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
