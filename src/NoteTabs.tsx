import { isGlobalTab } from "./taskSessions";
import { useEffect, useState } from "react";
import { Folder, X } from "lucide-react";
import { overviewProjectId } from "./noteTodos";
import type { Project } from "./model";
import ContextMenu from "./ContextMenu";
import { reorderTabs } from "./notePaths";
import FileIcon from "./FileIcon";
const tabType = "application/x-worknotes-tab";
export default function NoteTabs({
  tabs,
  active,
  disabled,
  onOpen,
  onClose,
  onRename,
  onReorder,
  projects = [],
}: {
  tabs: string[];
  active: string;
  disabled: boolean;
  onOpen: (path: string) => void;
  onClose: (path: string) => void;
  onRename: (path: string) => void;
  onReorder: (tabs: string[]) => void;
  projects?: Project[];
}) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    path: string;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    document
      .querySelector(".tab.active")
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);
  return (
    <>
      {tabs.map((path) => (
        <div
          key={path}
          className={`tab ${active === path ? "active" : ""} ${target === path ? "tab-drop-target" : ""} ${dragged === path ? "dragging" : ""}`}
          draggable={!disabled}
          onDragStart={(event) => {
            event.dataTransfer.setData(tabType, path);
            event.dataTransfer.effectAllowed = "move";
            setDragged(path);
          }}
          onDragEnd={() => {
            setTarget(null);
            setDragged(null);
          }}
          onDragOver={(event) => {
            if (!disabled && event.dataTransfer.types.includes(tabType)) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setTarget(path);
            }
          }}
          onDragLeave={() => setTarget(null)}
          onDrop={(event) => {
            if (disabled || !event.dataTransfer.types.includes(tabType)) return;
            event.preventDefault();
            setTarget(null);
            setDragged(null);
            onReorder(
              reorderTabs(tabs, event.dataTransfer.getData(tabType), path),
            );
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            window.dispatchEvent(new Event("worknotes:close-context-menus"));
            event.currentTarget.querySelector("button")?.focus();
            const rect = event.currentTarget.getBoundingClientRect();
            setMenu({
              path,
              x: event.clientX || rect.left,
              y: event.clientY || rect.bottom,
            });
          }}
        >
          <button
            onClick={() => onOpen(path)}
            title={
              overviewProjectId(path)
                ? "Task overview"
                : path.split("/").slice(3).join("/")
            }
          >
            {overviewProjectId(path) ? (
              <Folder size={14} />
            ) : (
              <FileIcon path={path} size={14} />
            )}
            {isGlobalTab(path) && <small>Global · </small>}
            {path === "global:overview"
              ? "Overview"
              : overviewProjectId(path)
                ? `${projects.find((p) => p.id === overviewProjectId(path))?.name || "Task"} · Overview`
                : path.split("/").at(-1)}
          </button>
          <button
            className="icon"
            title="Close tab"
            onClick={() => onClose(path)}
          >
            <X size={13} />
          </button>
        </div>
      ))}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label="Tab actions"
          onClose={() => setMenu(null)}
          actions={[
            ...(menu.path !== "global:overview" && !overviewProjectId(menu.path)
              ? [
                  {
                    label: "Rename / move…",
                    run: () => onRename(menu.path),
                    disabled,
                  },
                ]
              : []),
            { label: "Close tab", run: () => onClose(menu.path) },
          ]}
        />
      )}
    </>
  );
}
