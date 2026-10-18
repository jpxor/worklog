import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Search,
  Plus,
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  X,
  Clock3,
  Settings,
  PanelRightOpen,
  ExternalLink,
  Play,
  Pause,
  RotateCcw,
  Download,
  Archive,
  MoreHorizontal,
  Check,
  GitBranch,
  ArrowUpRight,
  CircleHelp,
} from "lucide-react";
import Editor from "./Editor";
import { desktop, directory, exportFile, request, confirmAction } from "./api";
import { useTextPrompt } from "./Prompt";
import HelpTour, { type TourStep } from "./HelpTour";
import ShortcutsPanel from "./ShortcutsPanel";
import TimeDetails from "./TimeDetails";
import NoteTree from "./NoteTree";
import ProjectInput from "./ProjectCombo";
import NoteTabs from "./NoteTabs";
import ProjectOverview from "./ProjectOverview";
import McpSettings from "./McpSettings";
import { searchNotes } from "./noteSearch";
import {
  overviewTab,
  overviewProjectId,
  setTodoChecked,
  type NoteTodo,
} from "./noteTodos";
import { remapPath } from "./notePaths";
import { useDismissablePopup } from "./useDismissablePopup";
import DocumentViewer from "./DocumentViewer";
import { deleteWithConfirmation } from "./deleteFile";
import { latestBackupSlot } from "./backups";
import {
  loadBindings,
  shortcutDefinitions,
  shortcutFromEvent,
  shortcutText,
  type Bindings,
} from "./shortcuts";
import {
  duration,
  dailyTotals,
  effective,
  emptySnapshot,
  formatTime,
  report,
  reportRange,
  type ReportPreset,
  today,
  validDate,
  type Entry,
  type Note,
  type Project,
  type Snapshot,
} from "./model";

function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
type Workspace = {
  project: string;
  tabs: string[];
  active: string;
  cursors: { [path: string]: number };
  panel: boolean;
  popup: boolean;
  timerHidden: boolean;
  recentProjects?: string[];
  pinned?: string[];
};
type Draft = {
  dateMode?: "today" | "fixed";
  date: string;
  project: string;
  time: string;
  note: string;
  replaces?: string;
};
const initialWorkspace: Workspace = {
  project: "",
  tabs: [],
  active: "",
  cursors: {},
  panel: true,
  popup: false,
  timerHidden: false,
};
const helpSteps: TourStep[] = [
  {
    id: "projects",
    target: ".sidebar-project .project-combo",
    title: "Choose or create a project",
    text: "Choose a project to see its notes. To add one, type a new name and choose Create.",
  },
  {
    id: "notes",
    target: ".sidebar-section",
    title: "Organize your notes",
    text: "Use + or {{newNote}} to create a note. Use folders to organize notes, and right-click a note to rename, move, or pin it.",
  },
  {
    id: "overview",
    target: ".tree-root",
    title: "Review your project",
    text: "Click the project name above the notes to see its overview. Unfinished checkboxes appear first. Check an item here to update its original note.",
  },
  {
    id: "editor",
    target: ".note-pane",
    title: "Write and switch notes",
    text: "Notes save automatically. Use {{switcher}} to find a project or note and {{find}} to search the open note. Drag tabs to reorder them.",
  },
  {
    id: "time",
    target: ".time-panel form",
    title: "Log time quickly",
    text: "Choose a work date and project, then enter a duration such as 45m, 1.5h, or 1:30. Add a short description of the work. Use today keeps the date current in local time.",
  },
  {
    id: "entries",
    target: ".today-summary",
    title: "Review your time",
    text: "Details shows today’s entries and totals. Open Time history in the top bar to browse any week and edit or remove older entries.",
  },
  {
    id: "timer",
    target: ".timer",
    title: "Use the optional timer",
    text: "Start the timer when you begin work and stop it when you finish. It keeps running through sleep or closing the app. Use time copies minutes into the form; submit the form to save an entry.",
  },
  {
    id: "reports",
    target: '[data-tour="reports"]',
    title: "Export a time report",
    text: "Choose an inclusive date range and export time entries, descriptions, and project totals as Markdown for your timesheet.",
  },
  {
    id: "closed",
    target: ".sidebar-bottom",
    title: "Close and reopen projects",
    text: "Close finished projects to remove them from active selectors. Their notes and time remain available. Use Closed projects to reopen one.",
  },
  {
    id: "settings",
    target: '[data-tour="settings"]',
    title: "Appearance, history, and backups",
    text: "Choose System, Light, or Dark appearance in Settings. Configure a backup destination and daily backup time to protect your notes and time entries.",
  },
  {
    id: "shortcuts",
    target: '[data-tour="help"]',
    title: "Keyboard shortcuts",
    text: "Open Keyboard shortcuts here or press {{shortcuts}}. You can change app shortcuts and restore their defaults.",
  },
];
const preview: Snapshot = {
  ...emptySnapshot,
  root: "Desktop preview · files are not connected",
  projects: [{ id: "sample", name: "Welcome to WorkLog", closed: false }],
  folders: ["projects/sample/notes"],
  notes: [
    {
      path: "projects/sample/notes/Controller testing.md",
      modified: Date.parse("2026-10-18T09:30:00-04:00"),
      content:
        "# Controller testing\n\nThe controller passed the initial test.\n\n## Next steps\n- [ ] Repeat the test under load\n- [ ] Investigate the startup delay\n- [x] Verify the baseline configuration\n",
    },
    {
      path: "projects/sample/notes/Power supply.md",
      modified: Date.parse("2026-10-15T14:00:00-04:00"),
      content: "# Power supply\n\n- [ ] Check the replacement component\n",
    },
    {
      path: "projects/sample/notes/Diagrams.md",
      content:
        "# Diagrams\n\n```mermaid\nflowchart LR\n    Plan --> Work --> Review\n```\n\n```mermaid\nsequenceDiagram\n    User->>WorkLog: Log time\n    WorkLog-->>User: Saved locally\n```\n",
    },
    { path: "projects/sample/notes/Sample.svg", content: "", kind: "image" },
    { path: "projects/sample/notes/Sample.pdf", content: "", kind: "pdf" },
    {
      path: "projects/sample/notes/Welcome.md",
      content:
        "# A little space for your work\n\nKeep your project notes together. Log the time that goes into them.\n\n## Make yourself at home\n\nChoose a local folder in the desktop app to start your workspace, or connect an existing WorkLog repository. Your notes stay ordinary Markdown files.\n\n## Notes that work like you do\n\nProse wraps naturally. Fenced code and logs keep their original columns.\n\n```sh\ngit status --short\ngit log --oneline -5\n```\n\nPress Ctrl+P to jump to a project or note.\n",
    },
  ],
};

export default function App() {
  const [bindings, setBindings] = useState<Bindings>(() =>
    loadBindings(stored("worknotes.shortcuts", null)),
  );
  const [helpMenu, setHelpMenu] = useState(false);
  useEffect(() => {
    localStorage.setItem("worknotes.shortcuts", JSON.stringify(bindings));
  }, [bindings]);
  const { ask, view: promptView } = useTextPrompt();
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() =>
    stored("worknotes.theme", "system"),
  );
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const dark = theme === "dark" || (theme === "system" && systemDark);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("worknotes.theme", JSON.stringify(theme));
  }, [theme, dark]);
  const [data, setData] = useState<Snapshot>(desktop ? emptySnapshot : preview);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [ws, setWs] = useState<Workspace>(() =>
    stored("worknotes.workspace", initialWorkspace),
  );
  const [draft, setDraft] = useState<Draft>(() =>
    (() => {
      const saved = stored<Draft>("worknotes.draft", {
        date: today(),
        project: "",
        time: "",
        note: "",
      });
      const fixed =
        saved.replaces ||
        saved.dateMode === "fixed" ||
        (!saved.dateMode && !!(saved.time || saved.note));
      return {
        ...saved,
        date: fixed ? saved.date : today(),
        dateMode: fixed ? "fixed" : "today",
      } as Draft;
    })(),
  );
  const [timer, setTimer] = useState<{
    start: number | null;
    stop: number | null;
  }>(() => stored("worknotes.timer", { start: null, stop: null }));
  const [now, setNow] = useState(Date.now());
  const localDay = today();
  useEffect(() => {
    setDraft((d) =>
      d.dateMode !== "fixed" && !d.replaces && d.date !== localDay
        ? { ...d, date: localDay, dateMode: "today" }
        : d,
    );
  }, [localDay]);
  const [modal, setModal] = useState<
    | "switcher"
    | "searchNotes"
    | "settings"
    | "report"
    | "shortcuts"
    | "timeDetails"
    | "timeHistory"
    | "moveProject"
    | null
  >(null);
  const [query, setQuery] = useState("");
  const [searchLimit, setSearchLimit] = useState(50);
  const [choice, setChoice] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(
    desktop ? "Opening workspace…" : "Browser preview · changes are not saved",
  );
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const [saving, setSaving] = useState(false);
  const [from, setFrom] = useState(today().slice(0, 8) + "01");
  const [through, setThrough] = useState(today());
  const [detailsDate, setDetailsDate] = useState(today());
  const [detailsEntryId, setDetailsEntryId] = useState<string | null>(null);
  const [moveSource, setMoveSource] = useState("");
  const [remote, setRemote] = useState("");
  const [backupPath, setBackupPath] = useState("");
  const [backupTime, setBackupTime] = useState("17:00");
  const [localPath, setLocalPath] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [noteMenu, setNoteMenu] = useState(false);
  const noteMenuHost = useDismissablePopup(noteMenu, () => setNoteMenu(false));
  useEffect(() => setNoteMenu(false), [ws.active]);
  const [projectHelp, setProjectHelp] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const beforeHelp = useRef<{
    panel: boolean;
    popup: boolean;
    timerHidden: boolean;
    recent: boolean;
  } | null>(null);
  const projectSelector = useRef<HTMLDivElement>(null);
  const guideProjectCreation = () => {
    setProjectHelp(true);
    projectSelector.current?.querySelector("input")?.focus();
  };
  useEffect(() => {
    if (desktop && data.root && data.projects.length === 0)
      guideProjectCreation();
  }, [data.root, data.projects.length]);
  const [editorRevision, setEditorRevision] = useState(0);
  const [recentOpen, setRecentOpen] = useState(true);
  const startHelp = () => {
    setHelpMenu(false);
    beforeHelp.current = {
      panel: ws.panel,
      popup: ws.popup,
      timerHidden: ws.timerHidden,
      recent: recentOpen,
    };
    setProjectHelp(false);
    setModal(null);
    setHelpOpen(true);
  };
  const endHelp = () => {
    setHelpOpen(false);
    const previous = beforeHelp.current;
    if (previous) {
      setWs((w) => ({
        ...w,
        panel: previous.panel,
        popup: previous.popup,
        timerHidden: previous.timerHidden,
      }));
      setRecentOpen(previous.recent);
    }
  };
  const pending = useRef(
    new Map<string, { content: string; expected: string }>(),
  );
  const persistPending = () => {
    if (desktop && dataRef.current.root)
      localStorage.setItem(
        `worknotes.noteDrafts:${dataRef.current.root}`,
        JSON.stringify([...pending.current]),
      );
  };
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef(Promise.resolve());
  const durationRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!ws.panel || helpOpen || modal) return;
    const focus = setTimeout(() => durationRef.current?.focus(), 0);
    return () => clearTimeout(focus);
  }, [ws.panel, ws.popup, helpOpen, modal]);
  const run = async (action: string, payload: unknown = {}) => {
    const result = await request(action, payload);
    setData(result);
    dataRef.current = result;
    return result;
  };
  const flush = () => {
    const job = queue.current
      .catch(() => {})
      .then(async () => {
        for (const [path, change] of [...pending.current]) {
          setSaving(true);
          try {
            await run("save_note", { path, ...change });
            if (pending.current.get(path) === change)
              pending.current.delete(path);
            else {
              const next = pending.current.get(path);
              if (next) next.expected = change.content;
            }
            persistPending();
            setStatus("Saved locally");
          } catch (e) {
            setError(String(e));
            throw e;
          } finally {
            setSaving(false);
          }
        }
      });
    queue.current = job;
    return job;
  };
  const task = async (fn: () => Promise<void>) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await flush();
      await fn();
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!desktop) {
      setWs((w) => ({
        ...w,
        project: "sample",
        active: "projects/sample/notes/Welcome.md",
        tabs: ["projects/sample/notes/Welcome.md"],
      }));
      return;
    }
    request("load")
      .then((d) => {
        dataRef.current = d;
        pending.current = new Map(
          stored<[string, { content: string; expected: string }][]>(
            `worknotes.noteDrafts:${d.root}`,
            [],
          ).filter(([path]) => d.notes.some((n) => n.path === path)),
        );
        setData(d);
        setRemote(d.remote);
        setBackupPath(d.backupPath);
        setBackupTime(d.backupTime);
        setStatus(
          pending.current.size
            ? "Recovered unsaved note drafts"
            : "Saved locally",
        );
      })
      .catch((e) => {
        setError(String(e));
        setStatus("Choose a workspace to begin");
      });
  }, []);
  useEffect(() => {
    localStorage.setItem("worknotes.workspace", JSON.stringify(ws));
  }, [ws]);
  useEffect(() => {
    localStorage.setItem("worknotes.draft", JSON.stringify(draft));
  }, [draft]);
  useEffect(() => {
    localStorage.setItem("worknotes.timer", JSON.stringify(timer));
  }, [timer]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (
      data.projects.length &&
      !data.projects.some((p) => p.id === ws.project)
    ) {
      const p = data.projects.find((p) => !p.closed);
      setWs((w) => ({ ...w, project: p?.id || "" }));
    }
  }, [data.projects, ws.project]);
  useEffect(() => {
    if (!draft.project && ws.project)
      setDraft((d) => ({ ...d, project: ws.project }));
  }, [ws.project, draft.project]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (pending.current.size) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest?.('[data-shortcut-capture="true"]')
      )
        return;
      if (e.key === "Escape") {
        setHelpMenu(false);
        setProjectHelp(false);
        setModal(null);
        setWs((w) => ({
          ...w,
          panel: w.popup ? false : w.panel,
          popup: false,
        }));
        return;
      }
      const key = shortcutFromEvent(e);
      const action = key
        ? shortcutDefinitions.find((d) => bindings[d.id] === key)?.id
        : undefined;
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      if (action === "shortcuts") {
        if (helpOpen) endHelp();
        setHelpMenu(false);
        setModal("shortcuts");
        return;
      }
      if (promptView || helpOpen || (modal && modal !== "switcher")) return;
      if ((action === "newNote" || action === "dailyNote") && !busy) {
        if (!data.root) pickWorkspace();
        else if (!ws.project) guideProjectCreation();
        else if (action === "dailyNote") todayLog();
        else newItem();
      } else if (action === "timePanel" || action === "timePopup") {
        const popup = action === "timePopup";
        setWs((w) => ({
          ...w,
          panel: !(w.panel && w.popup === popup),
          popup: w.panel && w.popup === popup ? false : popup,
        }));
      } else if (action === "switcher") {
        setModal("switcher");
        setQuery("");
        setChoice(0);
      } else if (action === "searchNotes") {
        setModal("searchNotes");
        setQuery("");
        setChoice(0);
        setSearchLimit(50);
      } else if (action === "save") flush().catch(() => {});
      else if (action === "closeNote") closeTab(ws.active);
      else if (action === "find" && ws.active)
        window.dispatchEvent(new Event("worknotes:find"));
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  });
  useEffect(() => {
    if (!desktop) return;
    let running = false;
    let stopped = false;
    let retryKey = "";
    let retryAt = 0;
    const tick = async () => {
      if (
        running ||
        busyRef.current ||
        pending.current.size ||
        !dataRef.current.root
      )
        return;
      running = true;
      const root = dataRef.current.root;
      try {
        let result = await request("commit");
        if (stopped || dataRef.current.root !== root) return;
        dataRef.current = result;
        setData(result);
        if (!result.remote && !result.backupPath) return;
        const slot = latestBackupSlot(new Date(), result.backupTime);
        const key = JSON.stringify([
          root,
          slot,
          result.remote,
          result.backupPath,
        ]);
        if (
          slot <= result.backupSlot ||
          (key === retryKey && Date.now() < retryAt) ||
          pending.current.size ||
          busyRef.current
        )
          return;
        retryKey = key;
        try {
          result = await request("scheduled_backup", { slot });
          if (stopped || dataRef.current.root !== root) return;
          dataRef.current = result;
          setData(result);
          setStatus("Saved locally");
          retryAt = 0;
        } catch (error) {
          retryAt = Date.now() + 10 * 60 * 1000;
          if (!stopped && dataRef.current.root === root)
            setStatus(`Backup failed; retrying in 10 minutes: ${error}`);
        }
      } catch (error) {
        if (!stopped) setStatus(`History: ${error}`);
      } finally {
        running = false;
      }
    };
    const startup = setTimeout(tick, 5000);
    const id = setInterval(tick, 30000);
    return () => {
      stopped = true;
      clearTimeout(startup);
      clearInterval(id);
    };
  }, []);
  const activate = (id: string) => {
    setProjectHelp(false);
    setWs((w) => ({
      ...w,
      project: id,
      recentProjects: [
        id,
        ...(w.recentProjects || []).filter((p) => p !== id),
      ].slice(0, 8),
    }));
    setDraft((d) => (d.replaces ? d : { ...d, project: id }));
  };
  const openNote = (path: string, cursor?: number) => {
    const project = overviewProjectId(path) ?? path.split("/")[1];
    setDraft((d) => (d.replaces ? d : { ...d, project }));
    setWs((w) => ({
      ...w,
      active: path,
      project,
      recentProjects: [
        project,
        ...(w.recentProjects || []).filter((p) => p !== project),
      ].slice(0, 8),
      tabs: w.tabs.includes(path) ? w.tabs : [...w.tabs, path],
      cursors:
        cursor === undefined ? w.cursors : { ...w.cursors, [path]: cursor },
    }));
  };
  const [overviewVisit, setOverviewVisit] = useState(0);
  const openOverview = (projectId: string) => {
    const open = () => {
      setOverviewVisit((visit) => visit + 1);
      openNote(overviewTab(projectId));
    };
    if (!desktop) {
      open();
      return;
    }
    task(async () => {
      await run("load");
      open();
    });
  };
  const toggleOverviewTodo = (note: Note, todo: NoteTodo, checked: boolean) =>
    task(async () => {
      const current = dataRef.current.notes.find(
        (item) => item.path === note.path,
      );
      if (!current || current.content !== note.content)
        throw new Error(
          "This note changed. Reopen the project overview and try again.",
        );
      await run("save_note", {
        path: note.path,
        expected: current.content,
        content: setTodoChecked(current.content, todo, checked),
      });
      setStatus("Saved locally");
    });
  const closeTab = (path: string) => {
    task(async () => {
      setWs((w) => {
        const tabs = w.tabs.filter((t) => t !== path);
        return {
          ...w,
          tabs,
          active: w.active === path ? tabs.at(-1) || "" : w.active,
        };
      });
    });
  };
  const createProject = (name: string, forForm = false) =>
    task(async () => {
      const d = await run("create_project", { name });
      setProjectHelp(false);
      const p = d.projects.find((p) => p.name === name)!;
      if (forForm) setDraft((x) => ({ ...x, project: p.id }));
      else activate(p.id);
    });
  const editNote = (path: string, content: string) => {
    const old = pending.current.get(path);
    pending.current.set(path, {
      content,
      expected:
        old?.expected ??
        dataRef.current.notes.find((n) => n.path === path)?.content ??
        "",
    });
    persistPending();
    setStatus("Unsaved changes");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => flush().catch(() => {}), 650);
  };
  const activeProject = data.projects.find((p) => p.id === ws.project);
  const activeNote = data.notes.find((n) => n.path === ws.active);
  const overviewProject = data.projects.find(
    (p) => p.id === overviewProjectId(ws.active),
  );
  const noteRoot = `projects/${ws.project}/notes`;
  const entries = effective(data.records);
  const totalsToday = dailyTotals(data.records, today());
  const todayTotal = [...totalsToday.values()].reduce(
    (sum, minutes) => sum + minutes,
    0,
  );
  const parsed = duration(draft.time);
  const todayLog = () => {
    const name = `daily/${today()}.md`;
    const path = `projects/${ws.project}/notes/${name}`;
    if (dataRef.current.notes.some((note) => note.path === path))
      openNote(path);
    else newItem(false, ws.project, name);
  };
  const newItem = async (
    folder = false,
    projectId = ws.project,
    suggestedName = "",
  ) => {
    const name = await ask(
      folder ? "Folder name" : "Note name",
      suggestedName,
      folder
        ? {
            placeholder: "e.g. Meetings",
            description:
              "Created in the project root. For nested folders, enter a path such as meetings/weekly.",
            submitLabel: "Create folder",
          }
        : {
            placeholder: "e.g. Meeting notes",
            description: suggestedName
              ? "Press Enter to create today's log in the daily folder, or type another name or path. The .md extension is optional."
              : "Created in the project root by default. You can also enter a path, such as meetings/planning.md. The .md extension is optional.",
            submitLabel: "Create note",
          },
    );
    if (!name) return;
    task(async () => {
      let relative = name.trim();
      if (!folder && !/\.(md|txt)$/i.test(relative)) relative += ".md";
      const path = `projects/${projectId}/notes/${relative}`;
      if (
        !folder &&
        suggestedName &&
        dataRef.current.notes.some((note) => note.path === path)
      ) {
        openNote(path);
        return;
      }
      await run(folder ? "create_folder" : "create_note", { path });
      if (!folder) openNote(path);
    });
  };
  const moveNote = (source: string, destination: string) => {
    if (source === destination) return;
    return task(async () => {
      const folder = !dataRef.current.notes.some(
        (note) => note.path === source,
      );
      const result = await run(folder ? "move_folder" : "rename_note", {
        path: source,
        destination,
      });
      for (const [path, draft] of [...pending.current]) {
        const next = remapPath(path, source, destination);
        if (next === path) continue;
        pending.current.delete(path);
        pending.current.set(next, {
          content: draft.content,
          expected: result.notes.find((note) => note.path === next)!.content,
        });
      }
      persistPending();
      setWs((w) => {
        const map = (path: string) => remapPath(path, source, destination);
        return {
          ...w,
          active: map(w.active),
          tabs: w.tabs.map(map),
          cursors: Object.fromEntries(
            Object.entries(w.cursors).map(([path, position]) => [
              map(path),
              position,
            ]),
          ),
          pinned: (w.pinned || []).map(map),
          project:
            map(w.active) !== w.active ? destination.split("/")[1] : w.project,
        };
      });
      setStatus(
        folder ? "Folder moved · saved locally" : "Note moved · saved locally",
      );
    });
  };
  const renameNote = async (source = activeNote?.path) => {
    if (!source) return;
    const ownRoot = source.split("/").slice(0, 3).join("/");
    const name = await ask(
      "New path within this project",
      source.slice(ownRoot.length + 1),
    );
    if (!name) return;
    const media = dataRef.current.notes.find(
      (note) => note.path === source,
    )?.kind;
    const extension = source.slice(source.lastIndexOf(".")) || ".md";
    const named = media
      ? /\.[^/.]+$/.test(name)
        ? name
        : name + extension
      : /\.(md|txt)$/i.test(name)
        ? name
        : name + extension;
    const path = `${ownRoot}/${named}`;
    moveNote(source, path);
  };
  const deleteItem = async (path: string, folder = false) => {
    task(async () => {
      const trashName = /Windows/i.test(navigator.userAgent)
        ? "Recycle Bin"
        : "Trash";
      const outcome = await deleteWithConfirmation(
        path,
        folder,
        trashName,
        confirmAction,
        (permanent) =>
          run(folder ? "delete_folder" : "delete_note", { path, permanent }),
      );
      if (!outcome) return;
      setWs((w) => {
        const tabs = w.tabs.filter((tab) => tab !== path);
        return {
          ...w,
          tabs,
          active: w.active === path ? tabs.at(-1) || "" : w.active,
          pinned: (w.pinned || []).filter((pin) => pin !== path),
          cursors: Object.fromEntries(
            Object.entries(w.cursors).filter(([key]) => key !== path),
          ),
        };
      });
      setStatus(
        outcome === "permanent"
          ? "Permanently deleted"
          : `Moved to the ${trashName}`,
      );
    });
  };
  const revealItem = (path: string) =>
    task(async () => {
      await run("open_folder", { path });
    });
  const pinNote = (path: string) =>
    setWs((w) => ({
      ...w,
      pinned: (w.pinned || []).includes(path)
        ? w.pinned!.filter((pin) => pin !== path)
        : [path, ...(w.pinned || [])],
    }));
  const pickWorkspace = () =>
    task(async () => {
      const path = await directory();
      if (path) {
        const result = await run("open_workspace", { path });
        setRemote(result.remote);
        setBackupPath(result.backupPath);
        setBackupTime(result.backupTime);
        setWs(initialWorkspace);
        setDraft({ date: today(), project: "", time: "", note: "" });
        setStatus("Saved locally");
      }
    });
  const logTime = () =>
    task(async () => {
      if (!parsed || !draft.project) return;
      const record: Entry = {
        type: "entry",
        id: draft.replaces || crypto.randomUUID(),
        projectId: draft.project,
        date: draft.date,
        minutes: parsed,
        note: draft.note,
      };
      const expected = draft.replaces
        ? entries.find((e) => e.id === draft.replaces)
        : undefined;
      if (draft.replaces && !expected)
        throw new Error(
          "This entry no longer exists. Cancel this edit before logging new time.",
        );
      await run("save_entry", { entry: record, expected });
      setDraft((d) => ({ ...d, time: "", note: "", replaces: undefined }));
      setStatus("Time logged · saved locally");
      durationRef.current?.focus();
    });
  const editEntry = (e: Entry) => {
    setDetailsDate(e.date);
    setDetailsEntryId(e.id);
    setError("");
    setModal("timeDetails");
  };
  const removeEntry = async (entry: Entry) => {
    if (!(await confirmAction("Remove this time entry?"))) return false;
    return task(async () => {
      await run("delete_entry", { id: entry.id, expected: entry });
      setStatus("Time entry removed · saved locally");
    });
  };
  const seconds = timer.start
    ? Math.max(0, Math.floor(((timer.stop ?? now) - timer.start) / 1000))
    : 0;
  const clock = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const contentMatches = useMemo(
    () =>
      modal === "searchNotes"
        ? searchNotes(
            data.notes.map((note) => ({
              ...note,
              content: pending.current.get(note.path)?.content ?? note.content,
            })),
            query,
          )
        : [],
    [modal, data.notes, query, status],
  );
  const candidates =
    modal === "searchNotes"
      ? contentMatches.slice(0, searchLimit).map((match) => ({
          label: match.path.split("/notes/")[1],
          detail: `${data.projects.find((project) => project.id === match.path.split("/")[1])?.name || "Unknown project"} · line ${match.line}`,
          project: match.path.split("/")[1],
          path: match.path,
          cursor: match.cursor,
          snippet: match.snippet,
        }))
      : [
          ...data.projects
            .filter((p) => !p.closed)
            .map((p) => ({
              label: p.name,
              detail: "Project",
              project: p.id,
              path: "",
              cursor: undefined as number | undefined,
              snippet: "",
            })),
          ...data.notes
            .filter(
              (n) =>
                !data.projects.find((p) => p.id === n.path.split("/")[1])
                  ?.closed,
            )
            .map((n) => ({
              label: n.path.split("/").at(-1)!,
              detail:
                data.projects.find((p) => p.id === n.path.split("/")[1])
                  ?.name || "",
              project: n.path.split("/")[1],
              path: n.path,
              cursor: undefined as number | undefined,
              snippet: "",
            })),
        ].filter((c) =>
          (c.label + " " + c.detail)
            .toLowerCase()
            .includes(query.toLowerCase()),
        );
  const selectCandidate = (i: number) => {
    if (busyRef.current) return;
    const c = candidates[i];
    if (c) {
      if (c.path) openNote(c.path, c.cursor);
      else activate(c.project);
      setModal(null);
    }
  };
  const reportText = useMemo(() => {
    if (modal !== "report") return "";
    try {
      return report(data, from, through);
    } catch (e) {
      return String(e);
    }
  }, [modal, data, from, through]);
  const timeForm = (
    <>
      <div className="panel-heading">
        <span>
          <Clock3 size={17} />
          Log time
        </span>
        <div>
          <button
            className="icon"
            title={
              ws.popup
                ? `Dock panel (${bindings.timePanel || "unassigned"})`
                : `Open as popup (${bindings.timePopup || "unassigned"})`
            }
            onClick={() =>
              setWs((w) => ({ ...w, popup: !w.popup, panel: true }))
            }
          >
            {ws.popup ? (
              <PanelRightOpen size={16} />
            ) : (
              <ExternalLink size={15} />
            )}
          </button>
          <button
            className="icon"
            title={
              ws.popup
                ? `Hide time panel (${bindings.timePopup || "unassigned"})`
                : `Hide time panel (${bindings.timePanel || "unassigned"})`
            }
            onClick={() => setWs((w) => ({ ...w, panel: false, popup: false }))}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="time-body">
        {draft.replaces && <h2>Edit entry</h2>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            logTime();
          }}
        >
          <label>
            Date
            <input
              required
              type="date"
              value={draft.date}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  date: e.target.value,
                  dateMode: "fixed",
                }))
              }
            />
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setDraft((d) => ({ ...d, date: today(), dateMode: "today" }))
              }
            >
              Use today (local time)
            </button>
          </label>
          <label>
            Project
            <ProjectInput
              projects={data.projects}
              value={draft.project}
              onPick={(p) => setDraft((d) => ({ ...d, project: p.id }))}
              onCreate={(name) => createProject(name, true)}
            />
          </label>
          <label>
            Time
            <input
              ref={durationRef}
              required
              placeholder="e.g. 45m or 1h 30m"
              value={draft.time}
              onChange={(e) =>
                setDraft((d) => ({ ...d, time: e.target.value }))
              }
            />
            <span
              className={`field-hint ${draft.time && !parsed ? "invalid" : ""}`}
            >
              {draft.time
                ? parsed
                  ? formatTime(parsed)
                  : "Use 45m, 1.5h, or 1:30. Include a unit."
                : "45m · 1.5h · 1:30"}
            </span>
          </label>
          <label>
            Note <span className="optional">optional</span>
            <textarea
              placeholder="A few words about the work…"
              rows={3}
              value={draft.note}
              onChange={(e) =>
                setDraft((d) => ({ ...d, note: e.target.value }))
              }
            />
          </label>
          <button
            className="primary log-button"
            disabled={busy || !parsed || !draft.project || !desktop}
          >
            <Plus size={16} />
            {busy ? "Saving…" : draft.replaces ? "Save changes" : "Log time"}
          </button>
          {draft.replaces && (
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  replaces: undefined,
                  time: "",
                  note: "",
                }))
              }
            >
              Cancel edit
            </button>
          )}
        </form>
        <div className="today-summary">
          <div className="today-total">
            <span>Logged today</span>
            <strong>{formatTime(todayTotal)}</strong>
            <button
              aria-label="View today's time details"
              onClick={() => {
                setDetailsDate(today());
                setDetailsEntryId(null);
                setError("");
                setModal("timeDetails");
              }}
            >
              Details
            </button>
          </div>
        </div>
        <button
          className="recent-heading"
          onClick={() => setRecentOpen((v) => !v)}
        >
          {recentOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Recent entries<span>{entries.length}</span>
        </button>
        {recentOpen && (
          <div className="recent-entries">
            {entries
              .slice(-8)
              .reverse()
              .map((e) => (
                <div className="entry" key={e.id}>
                  <div>
                    <strong>
                      {data.projects.find((p) => p.id === e.projectId)?.name}
                    </strong>
                    <span>{formatTime(e.minutes)}</span>
                  </div>
                  <p>{e.note || "No note"}</p>
                  <footer>
                    <span>{e.date}</span>
                    <button onClick={() => editEntry(e)}>Edit</button>
                    <button onClick={() => removeEntry(e)}>Remove</button>
                  </footer>
                </div>
              ))}
            {!entries.length && (
              <p className="muted small">Your time entries will appear here.</p>
            )}
          </div>
        )}
        <div className="quick-projects">
          <div className="eyebrow">QUICK SELECT</div>
          {data.projects
            .filter((p) => !p.closed)
            .sort((a, b) => {
              const order = [
                ws.project,
                draft.project,
                ...(ws.recentProjects || []),
              ];
              const index = (id: string) =>
                order.includes(id) ? order.indexOf(id) : 999;
              return index(a.id) - index(b.id);
            })
            .slice(0, 5)
            .map((p) => (
              <button
                className={draft.project === p.id ? "chosen" : ""}
                key={p.id}
                onClick={() => setDraft((d) => ({ ...d, project: p.id }))}
              >
                {p.name}
              </button>
            ))}
        </div>
      </div>
    </>
  );
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <BookOpen size={19} />
          </span>
          WorkLog
        </div>
        <div className="top-actions">
          <button
            className="search-trigger"
            onClick={() => {
              setModal("switcher");
              setQuery("");
            }}
          >
            <Search size={15} />
            <span>Jump to anything</span>
            {bindings.switcher && <kbd>{bindings.switcher}</kbd>}
          </button>
          <button
            title={`Search note contents (${bindings.searchNotes || "unassigned"})`}
            onClick={() => {
              setModal("searchNotes");
              setQuery("");
              setChoice(0);
              setSearchLimit(50);
            }}
          >
            <Search size={15} />
            Search notes
          </button>
          <button
            onClick={() => {
              setDetailsDate(today());
              setDetailsEntryId(null);
              setModal("timeHistory");
            }}
          >
            <Clock3 size={15} />
            Time history
          </button>
          <button data-tour="reports" onClick={() => setModal("report")}>
            <FileText size={15} />
            Reports
          </button>
          <button
            className={ws.panel ? "active-action" : ""}
            title={`Toggle time panel (${bindings.timePanel || "unassigned"}) · Popup (${bindings.timePopup || "unassigned"})`}
            onClick={() => setWs((w) => ({ ...w, panel: !w.panel }))}
          >
            <PanelRightOpen size={16} />
            Log time
          </button>
          <div className="help-menu-wrap">
            <button
              data-tour="help"
              title="Help"
              aria-expanded={helpMenu}
              onClick={() => setHelpMenu((v) => !v)}
            >
              <CircleHelp size={17} />
              Help
            </button>
            {helpMenu && (
              <div className="combo-menu">
                <button onClick={startHelp}>Guided tour</button>
                <button
                  onClick={() => {
                    setHelpMenu(false);
                    setModal("shortcuts");
                  }}
                >
                  Keyboard shortcuts{" "}
                  {bindings.shortcuts && <kbd>{bindings.shortcuts}</kbd>}
                </button>
              </div>
            )}
          </div>
          <button
            className="icon"
            title="Settings and backups"
            data-tour="settings"
            onClick={() => setModal("settings")}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>
      {!desktop && (
        <div className="preview-banner">
          Interface preview · open the Tauri desktop app to create and save your
          workspace.
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="icon"
            title="Dismiss error"
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div className="workspace">
        <aside className="sidebar">
          <div
            className={`sidebar-project ${projectHelp ? "show-project-help" : ""}`}
            ref={projectSelector}
          >
            <div className="workspace-label">
              <div className="eyebrow">WORKSPACE</div>
              <button
                className="icon"
                title="Create project"
                onClick={guideProjectCreation}
              >
                <Plus size={14} />
              </button>
            </div>
            <ProjectInput
              projects={data.projects}
              value={ws.project}
              onPick={(p) => activate(p.id)}
              onCreate={(name) => createProject(name)}
            />
            {projectHelp && (
              <div
                className="project-tutorial"
                role="dialog"
                aria-label="Create a project tutorial"
              >
                <button
                  className="icon"
                  title="Dismiss project tutorial"
                  onClick={() => setProjectHelp(false)}
                >
                  <X size={14} />
                </button>
                <strong>
                  {data.projects.length
                    ? "Create a project"
                    : "Create your first project"}
                </strong>
                <p>
                  Type a project name in this box, then choose <b>Create</b> or
                  press <kbd>Enter</kbd>.
                </p>
                <span>
                  Your notes and time entries will belong to that project.
                </span>
              </div>
            )}
          </div>
          <div className="sidebar-section">
            <span>PROJECT NOTES</span>
            <div>
              <button
                className="icon"
                title="New folder"
                disabled={!activeProject}
                onClick={() => newItem(true)}
              >
                <Folder size={14} />
              </button>
              <button
                className="icon"
                title={`New note (${bindings.newNote || "unassigned"})`}
                disabled={!activeProject}
                onClick={() => newItem()}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <button
            className="daily-log-action"
            disabled={!activeProject || busy}
            title={`Today's log (${bindings.dailyNote || "unassigned"})`}
            onClick={todayLog}
          >
            <FileText size={14} />
            Today's log
          </button>
          <div className="tree">
            <NoteTree
              notes={data.notes}
              folders={data.folders}
              prefix={noteRoot}
              projectName={activeProject?.name || "Project root"}
              active={ws.active}
              onOpen={(path) => {
                if (!busyRef.current) openNote(path);
              }}
              onOverview={
                activeProject ? () => openOverview(activeProject.id) : undefined
              }
              overviewActive={ws.active === overviewTab(ws.project)}
              onMove={moveNote}
              onRename={renameNote}
              onDelete={deleteItem}
              onReveal={revealItem}
              onMoveProject={(path) => {
                setMoveSource(path);
                setModal("moveProject");
              }}
              onPin={pinNote}
              pinned={ws.pinned || []}
              disabled={busy || !desktop}
            />
            {activeProject &&
              !data.notes.some((n) => n.path.startsWith(noteRoot + "/")) && (
                <button className="empty-note" onClick={() => newItem()}>
                  <Plus size={15} />
                  Write your first note
                </button>
              )}
          </div>
          <div className="sidebar-bottom">
            {!data.root && (
              <button onClick={pickWorkspace}>
                <Folder size={15} />
                Open data folder
              </button>
            )}
            <button onClick={() => setShowClosed((v) => !v)}>
              <Archive size={15} />
              Closed projects
              <ChevronDown size={13} />
            </button>
            {showClosed &&
              data.projects
                .filter((p) => p.closed)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      task(async () => {
                        await run("update_project", { ...p, closed: false });
                        activate(p.id);
                      })
                    }
                  >
                    {p.name}
                    <span className="reopen">Reopen</span>
                  </button>
                ))}
            {activeProject && (
              <button
                onClick={() =>
                  task(async () => {
                    await run("update_project", {
                      ...activeProject,
                      closed: true,
                    });
                    setWs((w) => ({
                      ...w,
                      project:
                        dataRef.current.projects.find((p) => !p.closed)?.id ||
                        "",
                    }));
                  })
                }
              >
                <Archive size={14} />
                Close current project
              </button>
            )}
            <button
              onClick={() =>
                setWs((w) => ({ ...w, timerHidden: !w.timerHidden }))
              }
            >
              <Clock3 size={15} />
              {ws.timerHidden ? "Show timer" : "Hide timer"}
            </button>
          </div>
        </aside>
        <main className="note-pane">
          <div className="tabs">
            <NoteTabs
              tabs={ws.tabs.filter(
                (path) =>
                  data.notes.some((note) => note.path === path) ||
                  data.projects.some(
                    (project) => overviewTab(project.id) === path,
                  ),
              )}
              projects={data.projects}
              active={ws.active}
              disabled={busy}
              onOpen={(path) => {
                if (busyRef.current) return;
                const project = overviewProjectId(path);
                if (project) openOverview(project);
                else openNote(path);
              }}
              onClose={closeTab}
              onRename={renameNote}
              onReorder={(tabs) => setWs((w) => ({ ...w, tabs }))}
            />
            <button
              className="icon new-tab"
              title={`New note (${bindings.newNote || "unassigned"})`}
              disabled={!activeProject}
              onClick={() => newItem()}
            >
              <Plus size={16} />
            </button>
          </div>
          {overviewProject ? (
            <ProjectOverview
              key={`${data.root}:${overviewProject.id}:${overviewVisit}`}
              project={overviewProject}
              notes={data.notes}
              disabled={busy || !desktop}
              navigationDisabled={busy}
              onOpen={openNote}
              onToggle={toggleOverviewTodo}
              onNewNote={() => {
                activate(overviewProject.id);
                newItem(false, overviewProject.id);
              }}
            />
          ) : activeNote ? (
            <>
              <div className="breadcrumb">
                <span>
                  {
                    data.projects.find(
                      (p) => p.id === activeNote.path.split("/")[1],
                    )?.name
                  }
                </span>
                <ChevronRight size={12} />
                <span>{activeNote.path.split("/").slice(3).join(" / ")}</span>
                <div className="note-menu" ref={noteMenuHost}>
                  <button
                    className="icon"
                    title="Note actions"
                    aria-expanded={noteMenu}
                    onClick={() => setNoteMenu((v) => !v)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {noteMenu && (
                    <div
                      className="combo-menu"
                      onClick={() => setNoteMenu(false)}
                    >
                      <button
                        onClick={() => {
                          setNoteMenu(false);
                          renameNote();
                        }}
                      >
                        Rename / move note
                      </button>
                      <button
                        onClick={async () => {
                          setNoteMenu(false);
                          deleteItem(activeNote.path);
                        }}
                      >
                        {activeNote.kind ? "Delete file" : "Delete note"}
                      </button>
                      {!activeNote.kind && !/\.txt$/i.test(activeNote.path) && (
                        <button
                          onClick={() =>
                            window.dispatchEvent(
                              new Event("worknotes:insert-mermaid"),
                            )
                          }
                        >
                          Insert Mermaid diagram
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (activeNote.kind) {
                            await task(async () => {
                              await run("load");
                              setEditorRevision((revision) => revision + 1);
                            });
                            return;
                          }
                          if (
                            !(await confirmAction(
                              "Discard this note's unsaved draft and reload the saved file? Copy the draft first if you need it.",
                            ))
                          )
                            return;
                          pending.current.delete(activeNote.path);
                          persistPending();
                          try {
                            await run("load");
                            setEditorRevision((v) => v + 1);
                            setError("");
                            setNoteMenu(false);
                          } catch (e) {
                            setError(String(e));
                          }
                        }}
                      >
                        {activeNote.kind ? "Reload file" : "Reload saved note"}
                      </button>
                      <button
                        disabled={!!activeNote.kind}
                        onClick={() =>
                          navigator.clipboard
                            .writeText(
                              pending.current.get(activeNote.path)?.content ??
                                activeNote.content,
                            )
                            .catch((e) => setError(String(e)))
                        }
                      >
                        Copy note text / draft
                      </button>
                      <button
                        onClick={() =>
                          navigator.clipboard
                            .writeText(`${data.root}/${activeNote.path}`)
                            .catch((e) => setError(String(e)))
                        }
                      >
                        Copy note path
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {activeNote.kind ? (
                <DocumentViewer
                  key={
                    data.root +
                    activeNote.path +
                    activeNote.revision +
                    editorRevision
                  }
                  root={data.root}
                  note={activeNote}
                />
              ) : (
                <>
                  <Editor
                    key={data.root + activeNote.path + editorRevision}
                    dark={dark}
                    plain={/\.txt$/i.test(activeNote.path)}
                    content={
                      pending.current.get(activeNote.path)?.content ??
                      activeNote.content
                    }
                    cursor={ws.cursors[activeNote.path] || 0}
                    onCursor={(pos) =>
                      setWs((w) => ({
                        ...w,
                        cursors: { ...w.cursors, [activeNote.path]: pos },
                      }))
                    }
                    onChange={(text) => editNote(activeNote.path, text)}
                  />
                  <div className="editor-footer">
                    <span>
                      {/\.txt$/i.test(activeNote.path)
                        ? "Plain text"
                        : "Markdown"}
                    </span>
                    <span>
                      {
                        activeNote.content.trim().split(/\s+/).filter(Boolean)
                          .length
                      }{" "}
                      words
                    </span>
                    <span>UTF-8</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="empty-workspace">
              <div className="empty-icon">
                <BookOpen size={35} />
              </div>
              <div className="eyebrow">LESS FRICTION. MORE FOCUS.</div>
              <h1>
                {data.root && !activeProject
                  ? "No open projects"
                  : "No note open"}
              </h1>
              {!data.root ? (
                <button className="primary" onClick={pickWorkspace}>
                  <Folder size={17} />
                  Choose a data folder
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() =>
                    activeProject ? newItem() : guideProjectCreation()
                  }
                >
                  <Plus size={17} />
                  {activeProject
                    ? "Create a note"
                    : "Create your first project"}
                </button>
              )}
              <span className="shortcut-hint">
                {bindings.switcher ? (
                  <>
                    <kbd>{bindings.switcher}</kbd> to jump to a project or note
                  </>
                ) : (
                  "Use Jump to anything to find a project or note"
                )}
              </span>
            </div>
          )}
        </main>
        {ws.panel && !ws.popup && (
          <aside className="time-panel">{timeForm}</aside>
        )}
      </div>
      <footer className="statusbar">
        <span>
          <span className={`status-dot ${saving ? "working" : ""}`} />
          {saving ? "Saving…" : status}
        </span>
        <span title={data.git}>
          <GitBranch size={12} />
          {data.git || "Local workspace"}
        </span>
        <button onClick={() => setModal("settings")}>
          {data.backupError
            ? "Backup failed · retry pending"
            : data.lastBackup
              ? `Backup: ${new Date(Number(data.lastBackup)).toLocaleString()}`
              : data.remote || data.backupPath
                ? "First backup pending"
                : "Backup not configured"}
          <ArrowUpRight size={12} />
        </button>
      </footer>
      {!ws.timerHidden && (
        <div className="timer">
          <Clock3 size={15} />
          <span>{clock}</span>
          <button
            className="icon"
            title={timer.start && !timer.stop ? "Stop timer" : "Start timer"}
            onClick={() =>
              setTimer(
                timer.start && !timer.stop
                  ? { ...timer, stop: Date.now() }
                  : { start: Date.now(), stop: null },
              )
            }
          >
            {timer.start && !timer.stop ? (
              <Pause size={15} />
            ) : (
              <Play size={15} />
            )}
          </button>
          <button
            className="icon"
            title="Reset timer"
            onClick={() => setTimer({ start: null, stop: null })}
          >
            <RotateCcw size={13} />
          </button>
          <button
            className="use-time"
            disabled={seconds < 60}
            onClick={() => {
              setDraft((d) => ({ ...d, time: `${Math.floor(seconds / 60)}m` }));
              setWs((w) => ({ ...w, panel: true }));
            }}
          >
            Use time
          </button>
          <button
            className="icon"
            title="Hide timer"
            onClick={() => setWs((w) => ({ ...w, timerHidden: true }))}
          >
            <X size={12} />
          </button>
        </div>
      )}
      {ws.popup && ws.panel && (
        <div
          className="overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget)
              setWs((w) => ({ ...w, popup: false, panel: false }));
          }}
        >
          <section
            className="time-panel popup"
            role="dialog"
            aria-modal="true"
            aria-label="Log time"
          >
            {timeForm}
          </section>
        </div>
      )}
      {modal && (
        <div
          className="overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className={`modal ${modal === "switcher" || modal === "searchNotes" ? "switcher" : ""} ${modal === "report" ? "report-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={modal}
          >
            <div className="modal-header">
              <h2>
                {modal === "searchNotes"
                  ? "Search note contents"
                  : modal === "switcher"
                    ? "Jump to anything"
                    : modal === "settings"
                      ? "Workspace & backups"
                      : modal === "shortcuts"
                        ? "Keyboard shortcuts"
                        : modal === "timeDetails"
                          ? `Time entries · ${detailsDate}`
                          : modal === "timeHistory"
                            ? "Time history"
                            : modal === "moveProject"
                              ? "Move note to another project"
                              : "Time report"}
              </h2>
              <button
                className="icon"
                title="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={19} />
              </button>
            </div>
            {modal === "moveProject" ? (
              <div className="settings-body">
                <p>
                  {moveSource.split("/").at(-1)} will move to the selected
                  project's root folder.
                </p>
                {data.projects
                  .filter(
                    (project) =>
                      project.id !== moveSource.split("/")[1] &&
                      !project.closed,
                  )
                  .map((project) => (
                    <button
                      key={project.id}
                      disabled={busy}
                      onClick={async () => {
                        const moved = await moveNote(
                          moveSource,
                          `projects/${project.id}/notes/${moveSource.split("/").at(-1)}`,
                        );
                        if (moved) setModal(null);
                      }}
                    >
                      <Folder size={15} />
                      {project.name}
                    </button>
                  ))}
                {!data.projects.some(
                  (project) =>
                    project.id !== moveSource.split("/")[1] && !project.closed,
                ) && (
                  <p>
                    No other open projects. Create or reopen a project first.
                  </p>
                )}
              </div>
            ) : modal === "timeDetails" || modal === "timeHistory" ? (
              <TimeDetails
                weekly={modal === "timeHistory"}
                key={`${detailsDate}:${detailsEntryId || "list"}`}
                entries={entries}
                projects={data.projects}
                date={detailsDate}
                initialEntryId={detailsEntryId}
                busy={busy}
                error={error}
                onSave={(entry, expected) =>
                  task(async () => {
                    await run("save_entry", { entry, expected });
                    setStatus("Time entry updated · saved locally");
                  })
                }
                onRemove={removeEntry}
              />
            ) : modal === "shortcuts" ? (
              <ShortcutsPanel bindings={bindings} onChange={setBindings} />
            ) : modal === "switcher" || modal === "searchNotes" ? (
              <>
                <div className="switcher-search">
                  <Search size={18} />
                  <input
                    autoFocus
                    placeholder={
                      modal === "searchNotes"
                        ? "Search text across all project notes…"
                        : "Search projects and notes…"
                    }
                    aria-label={
                      modal === "searchNotes"
                        ? "Search note contents"
                        : "Search projects and notes"
                    }
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setChoice(0);
                      setSearchLimit(50);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setChoice((v) =>
                          Math.min(v + 1, candidates.length - 1),
                        );
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setChoice((v) => Math.max(v - 1, 0));
                      }
                      if (e.key === "Enter") selectCandidate(choice);
                    }}
                  />
                </div>
                <div className="switcher-results">
                  {candidates.map((c, i) => (
                    <button
                      className={choice === i ? "selected" : ""}
                      key={c.path || c.project}
                      onClick={() => selectCandidate(i)}
                    >
                      {c.path ? <FileText size={17} /> : <Folder size={17} />}
                      <span>
                        {c.label}
                        <small>{c.detail}</small>
                        {c.snippet && (
                          <small className="search-snippet">{c.snippet}</small>
                        )}
                      </span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                  {!candidates.length && (
                    <p className="muted">
                      {modal === "searchNotes"
                        ? query.trim()
                          ? "No matching note contents."
                          : "Type text to search Markdown and text notes across all projects, including closed projects. Images and PDFs are not searched."
                        : "No matching projects or notes."}
                    </p>
                  )}
                  {modal === "searchNotes" &&
                    contentMatches.length > searchLimit && (
                      <button
                        onClick={() => setSearchLimit((limit) => limit + 50)}
                      >
                        Show more ({contentMatches.length - searchLimit}{" "}
                        remaining)
                      </button>
                    )}
                </div>
                <div className="modal-footnote">
                  {modal === "searchNotes" &&
                    query.trim() &&
                    `${contentMatches.length} matching notes · First match shown per note · `}
                  ↑ ↓ to navigate · Enter to open · Esc to close
                </div>
              </>
            ) : modal === "settings" ? (
              <div className="settings-body">
                <button onClick={() => setModal("shortcuts")}>
                  Keyboard shortcuts
                </button>
                <h3>Appearance</h3>
                <div
                  className="theme-picker"
                  role="group"
                  aria-label="Color theme"
                >
                  {(["system", "light", "dark"] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={theme === value}
                      onClick={() => setTheme(value)}
                    >
                      {value[0].toUpperCase() + value.slice(1)}
                    </button>
                  ))}
                </div>
                <hr />
                <label>
                  Local data folder
                  <input readOnly value={data.root || "No folder selected"} />
                </label>
                <button onClick={pickWorkspace} disabled={busy}>
                  Choose local folder
                </button>
                <p className="muted small">
                  Choose an empty folder to begin, or open an existing WorkLog
                  data folder.
                </p>
                <hr />
                <h3>Projects</h3>
                <ProjectInput
                  projects={data.projects}
                  value={ws.project}
                  onPick={(p) => activate(p.id)}
                  onCreate={(name) => createProject(name)}
                />
                {activeProject && (
                  <button
                    onClick={async () => {
                      const name = await ask(
                        "Project name",
                        activeProject.name,
                      );
                      if (name)
                        task(async () => {
                          await run("update_project", {
                            ...activeProject,
                            name,
                          });
                        });
                    }}
                  >
                    Rename current project
                  </button>
                )}
                <hr />
                <McpSettings />
                <hr />
                <h3>Git repository</h3>
                <p className="muted small">
                  Connect an empty remote for this workspace, or clone existing
                  WorkLog data into a new local folder. Git uses your configured
                  SSH keys or credential helper.
                </p>
                <label>
                  Remote URL
                  <input
                    value={remote}
                    placeholder="git@host:you/worklog-data.git"
                    onChange={(e) => setRemote(e.target.value)}
                  />
                </label>
                <button
                  disabled={busy || !data.root}
                  onClick={() =>
                    task(async () => {
                      await run("configure", {
                        remote,
                        backupPath,
                        backupTime,
                      });
                    })
                  }
                >
                  Save backup settings
                </button>
                <label>
                  New local folder for a clone
                  <input
                    value={localPath}
                    placeholder="Full path to a new, empty folder"
                    onChange={(e) => setLocalPath(e.target.value)}
                  />
                </label>
                <button
                  disabled={busy || !remote || !localPath}
                  onClick={() =>
                    task(async () => {
                      const result = await run("clone", {
                        remote,
                        path: localPath,
                      });
                      setRemote(result.remote);
                      setBackupPath(result.backupPath);
                      setBackupTime(result.backupTime);
                      setWs(initialWorkspace);
                      setDraft({
                        date: today(),
                        project: "",
                        time: "",
                        note: "",
                      });
                    })
                  }
                >
                  Clone and open repository
                </button>
                <hr />
                <h3>File-copy backup</h3>
                <label>
                  Backup folder
                  <input
                    value={backupPath}
                    placeholder="Choose another disk or network location"
                    onChange={(e) => setBackupPath(e.target.value)}
                  />
                </label>
                <button
                  onClick={() =>
                    task(async () => {
                      const p = await directory();
                      if (p) setBackupPath(p);
                    })
                  }
                >
                  Browse…
                </button>
                <p className="muted small">
                  Replaces the previous WorkLog backup. Includes local Git
                  history.
                </p>
                <h3>Daily backup</h3>
                <label>
                  Backup time (local)
                  <input
                    type="time"
                    value={backupTime}
                    required
                    onChange={(event) => setBackupTime(event.target.value)}
                  />
                </label>
                <p className="muted small">
                  Backs up changed data once daily while WorkLog is open. Missed
                  backups run in the background after opening. Failed backups
                  retry every 10 minutes while open. Uses all configured
                  destinations.
                </p>
                {data.backupError && (
                  <p className="shortcut-error" role="alert">
                    Last backup failed: {data.backupError}
                  </p>
                )}
                <div className="settings-actions">
                  <button
                    disabled={busy || !data.root}
                    onClick={() =>
                      task(async () => {
                        await run("configure", {
                          remote,
                          backupPath,
                          backupTime,
                        });
                      })
                    }
                  >
                    Save settings
                  </button>
                  <button
                    className="primary"
                    disabled={busy || !data.root}
                    onClick={() =>
                      task(async () => {
                        await run("configure", {
                          remote,
                          backupPath,
                          backupTime,
                        });
                        await run("backup", {
                          slot: latestBackupSlot(new Date(), backupTime),
                        });
                        setStatus("Backup complete");
                      })
                    }
                  >
                    {busy ? "Working…" : "Back up now"}
                  </button>
                </div>
                <p className="muted small">{data.git}</p>
              </div>
            ) : (
              <div className="report-body">
                <div
                  className="report-presets"
                  role="group"
                  aria-label="Timesheet date presets"
                >
                  {(
                    [
                      ["today", "Today"],
                      ["yesterday", "Yesterday"],
                      ["thisWeek", "This week"],
                      ["lastWeek", "Last week"],
                    ] as [ReportPreset, string][]
                  ).map(([preset, label]) => (
                    <button
                      key={preset}
                      onClick={() => {
                        const [start, end] = reportRange(preset);
                        setFrom(start);
                        setThrough(end);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="muted small">
                    Weeks run Monday–Sunday. Dates below remain editable.
                  </span>
                </div>
                <div className="report-controls">
                  <label>
                    From
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Through
                    <input
                      type="date"
                      value={through}
                      onChange={(e) => setThrough(e.target.value)}
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={
                      !desktop ||
                      !validDate(from) ||
                      !validDate(through) ||
                      from > through
                    }
                    onClick={() =>
                      task(async () => {
                        await exportFile(reportText, from, through);
                      })
                    }
                  >
                    <Download size={15} />
                    Export Markdown
                  </button>
                </div>
                <pre className="report-preview">{reportText}</pre>
              </div>
            )}
          </section>
        </div>
      )}
      {promptView}
      {helpOpen && (
        <HelpTour
          steps={helpSteps.map((step) => ({
            ...step,
            text: shortcutText(step.text, bindings),
          }))}
          onShortcuts={() => {
            endHelp();
            setModal("shortcuts");
          }}
          onClose={endHelp}
          onStep={(id) => {
            if (["time", "entries"].includes(id)) {
              setWs((w) => ({ ...w, panel: true, popup: false }));
              setRecentOpen(true);
            }
            if (id === "timer") setWs((w) => ({ ...w, timerHidden: false }));
          }}
        />
      )}
    </div>
  );
}
