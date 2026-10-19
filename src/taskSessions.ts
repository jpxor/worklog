import { overviewProjectId, overviewTab } from "./noteTodos";
export const isGlobalTab = (path: string) =>
  path === "global:overview" || path.startsWith("global/notes/");
export const tabTask = (path: string) =>
  overviewProjectId(path) ??
  (path.startsWith("projects/") ? path.split("/")[1] : null);
export interface Session {
  tabs: string[];
  active: string;
}
export interface Sessions {
  project: string;
  tabs: string[];
  active: string;
  sessions?: { [id: string]: Session };
  taskActive?: string;
}
export function switchSession<T extends Sessions>(
  state: T,
  project: string,
): T {
  if (state.project === project) return state;
  const globals = state.tabs.filter(isGlobalTab);
  const sessions = {
    ...state.sessions,
    [state.project]: {
      tabs: state.tabs.filter((p) => tabTask(p) === state.project),
      active:
        tabTask(state.active) === state.project
          ? state.active
          : state.taskActive || "",
    },
  };
  const next = project
    ? (sessions[project] ?? {
        tabs: [overviewTab(project)],
        active: overviewTab(project),
      })
    : { tabs: [], active: "" };
  return {
    ...state,
    project,
    sessions,
    tabs: [...globals, ...next.tabs],
    active: next.tabs.includes(next.active)
      ? next.active
      : next.tabs[0] || globals[0] || "",
    taskActive: next.active,
  };
}
