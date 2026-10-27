// @vitest-environment jsdom
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./api", () => ({
  desktop: true,
  request: mocks.request,
  directory: vi.fn(),
  exportFile: vi.fn(),
  confirmAction: vi.fn(),
}));
import App from "./App";
import { directory, exportFile } from "./api";
import { emptySnapshot, today, reportRange, type Snapshot } from "./model";
const path = "projects/p/notes/log.md";
let data: Snapshot;
let file: string;
beforeEach(() => {
  localStorage.clear();
  vi.mocked(directory).mockReset().mockResolvedValue(null);
  // jsdom has no layout; real coordinate/scroll checks run in the browser.
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  file = "# Log\n\n- [ ] Follow up\n";
  data = {
    ...emptySnapshot,
    projectCodes: [{id:"test",label:"Test",archived:false}],
    root: "test-workspace",
    projects: [{ id: "p", name: "One", closed: false, defaultProjectCodeId: "test" }],
    notes: [{ path, content: file, modified: 100 }],
  };
  mocks.request
    .mockReset()
    .mockImplementation(
      async (
        action: string,
        payload: { expected: string; content: string; path: string },
      ) => {
        if (action === "create_note") {
          data = {
            ...data,
            notes: [...data.notes, { path: payload.path, content: "" }],
          };
        }
        if (action === "save_note") {
          if (payload.expected !== file)
            throw new Error(
              "This note changed outside WorkLog. Your draft is retained.",
            );
          file = payload.content;
          data = { ...data, notes: [{ path, content: file, modified: 200 }] };
        }
        return data;
      },
    );
});
afterEach(cleanup);
it("routes workspace actions to folder selection without opening creation forms when cancelled", async () => {
  data = { ...emptySnapshot };
  render(<App />);
  await screen.findByRole("heading", { name: "Choose a workspace to begin" });
  await waitFor(() => expect(screen.getByText("Choose a workspace to begin", { selector: ".statusbar span" })).toBeTruthy());
  expect(screen.queryByRole("combobox", { name: "Task" })).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Duration" })).toBeNull();
  const actions = [
    screen.getByTitle("Create task"),
    screen.getByRole("button", { name: "Create a note" }),
    screen.getByTitle(/^New note/),
    screen.getByRole("button", { name: /Jump to anything/ }),
    screen.getByRole("button", { name: "Search notes" }),
    screen.getByRole("button", { name: "Reports" }),
    screen.getByRole("button", { name: "Log time" }),
  ];
  for (const [index, button] of actions.entries()) {
    fireEvent.click(button);
    await waitFor(() => expect(directory).toHaveBeenCalledTimes(index + 1));
    await act(async () => {});
  }
  fireEvent.keyDown(window, { key: "n", ctrlKey: true });
  await waitFor(() => expect(directory).toHaveBeenCalledTimes(actions.length + 1));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(mocks.request.mock.calls.map(([action]) => action)).toEqual(["load"]);
});

it("enables normal task creation after a workspace is selected", async () => {
  const opened = { ...data, projects: [], notes: [] };
  data = { ...emptySnapshot };
  vi.mocked(directory).mockResolvedValue("/chosen-workspace");
  mocks.request.mockImplementation(async (action) => action === "open_workspace" ? opened : data);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Choose a data folder" }));
  await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("open_workspace", { path: "/chosen-workspace" }));
  await screen.findByRole("dialog", { name: "Create a task tutorial" });
  const taskInput = screen.getAllByRole("combobox", { name: "Task" })[0];
  fireEvent.focus(taskInput);
  fireEvent.change(taskInput, { target: { value: "First task" } });
  fireEvent.keyDown(taskInput, { key: "Enter" });
  expect(await screen.findByRole("dialog", { name: "Create task" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Choose a workspace to begin" })).toBeNull();
});

async function openOverview() {
  await waitFor(() =>
    expect(
      screen.getByTitle(
        "Open One overview · Drop here to move to One",
      ).textContent,
    ).toBe("One"),
  );
  fireEvent.click(
    screen.getByTitle(
      "Open One overview · Drop here to move to One",
    ),
  );
  return screen.findByRole("region", { name: "One task overview" });
}
it("retains an explicitly selected time-entry task and its default code while another task is open", async () => {
  data = {
    ...data,
    projectCodes: [...data.projectCodes, { id: "support", label: "SUPPORT", archived: false }],
    projects: [...data.projects, { id: "q", name: "Two", closed: false, defaultProjectCodeId: "support" }],
  };
  const { container } = render(<App />);
  await openOverview();
  const form = within(container.querySelector(".time-panel form") as HTMLElement);
  const taskPicker = form.getByRole("combobox", { name: "Task" }) as HTMLInputElement;
  await waitFor(() => expect(taskPicker.value).toBe("One"));
  fireEvent.focus(taskPicker);
  fireEvent.click(form.getByRole("option", { name: "Two" }));
  await waitFor(() => {
    expect(taskPicker.value).toBe("Two");
    expect((form.getByRole("combobox", { name: "Project code" }) as HTMLInputElement).value).toBe("SUPPORT");
  });
  expect(screen.getByRole("region", { name: "One task overview" })).toBeTruthy();
  expect(screen.queryByText(/Time entry is still for/)).toBeNull();
  expect(form.getByRole("button", { name: "Use current task" })).toBeTruthy();
  expect(form.getByText("Task default")).toBeTruthy();
  fireEvent.click(form.getByRole("button", { name: "Use current task" }));
  await waitFor(() => expect(taskPicker.value).toBe("One"));
  expect((form.getByRole("combobox", { name: "Project code" }) as HTMLInputElement).value).toBe("Test");
  expect(form.queryByRole("button", { name: "Use current task" })).toBeNull();
});
it("opens one overview tab, saves a checkbox to its source, and jumps into the checked note", async () => {
  const { container } = render(<App />);
  await openOverview();
  fireEvent.click(screen.getByRole("checkbox", { name: /Follow up/ }));
  await waitFor(() => expect(file).toBe("# Log\n\n- [x] Follow up\n"));
  await waitFor(() =>
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      true,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Follow up" }));
  await waitFor(() =>
    expect(container.querySelector(".cm-content")?.textContent).toContain(
      "[x] Follow up",
    ),
  );
  await waitFor(()=>expect(container.querySelector(".cm-editor")).toBeTruthy());
  const editor = EditorView.findFromDOM(
    container.querySelector(".cm-editor")!,
  )!;
  expect(editor.state.selection.main.head).toBe(file.indexOf("[x]"));
  fireEvent.click(
    screen.getByTitle(
      "Open One overview · Drop here to move to One",
    ),
  );
  await screen.findByRole("region", { name: "One task overview" });
  expect(
    screen.getAllByRole("button", { name: "One · Overview" }),
  ).toHaveLength(1);
  expect(screen.queryByRole("checkbox")).toBeNull();
});
it("flushes a pending editor draft before constructing the overview", async () => {
  const { container } = render(<App />);
  await openOverview();
  fireEvent.click(screen.getByRole("button", { name: "log.md" }));
  await waitFor(() =>
    expect(container.querySelector(".cm-editor")).toBeTruthy(),
  );
  await waitFor(()=>expect(container.querySelector(".cm-editor")).toBeTruthy());
  const editor = EditorView.findFromDOM(
    container.querySelector(".cm-editor")!,
  )!;
  editor.dispatch({
    changes: { from: editor.state.doc.length, insert: "- [ ] Draft item\n" },
  });
  fireEvent.click(
    screen.getByTitle(
      "Open One overview · Drop here to move to One",
    ),
  );
  await screen.findByRole("region", { name: "One task overview" });
  expect(file).toContain("- [ ] Draft item");
  expect(screen.getByRole("checkbox", { name: /Draft item/ })).toBeTruthy();
});
it("does not overwrite an external edit when completing a stale checkbox", async () => {
  render(<App />);
  await openOverview();
  file = "# Externally changed\n\n- [ ] Follow up\n";
  fireEvent.click(screen.getByRole("checkbox", { name: /Follow up/ }));
  await screen.findByText(/This note changed outside WorkLog/);
  expect(file).toContain("Externally changed");
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
    false,
  );
});
it("waits for a checkbox save before opening its source from the tree", async () => {
  const original = mocks.request.getMockImplementation()!;
  let release: (() => void) | undefined;
  mocks.request.mockImplementation(async (action, payload) => {
    if (action === "save_note")
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    return original(action, payload);
  });
  const { container } = render(<App />);
  await openOverview();
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(release).toBeTypeOf("function"));
  fireEvent.click(container.querySelector(".tree-file")!);
  expect(container.querySelector(".cm-editor")).toBeNull();
  await act(async () => {
    release!();
  });
  await waitFor(() => expect(file).toContain("- [x] Follow up"));
  fireEvent.click(container.querySelector(".tree-file")!);
  await waitFor(() =>
    expect(container.querySelector(".cm-content")?.textContent).toContain(
      "[x] Follow up",
    ),
  );
});

it("refreshes an empty legacy time draft to local today and preserves an explicit historical date", async () => {
  localStorage.setItem(
    "worklog.draft.v3:test-workspace",
    JSON.stringify({ date: "2026-01-01", project: "p", time: "", note: "" }),
  );
  const { container, unmount } = render(<App />);
  await openOverview();
  const date = container.querySelector(
    '.time-panel input[type="date"]',
  ) as HTMLInputElement;
  const now = new Date();
  const localDate =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");
  expect(date.value).toBe(localDate);
  fireEvent.change(date, { target: { value: "2026-01-02" } });
  unmount();
  const restored = render(<App />);
  await openOverview();
  expect(
    (
      restored.container.querySelector(
        '.time-panel input[type="date"]',
      ) as HTMLInputElement
    ).value,
  ).toBe("2026-01-02");
});

it("advances the automatic work date across local midnight", async () => {
  vi.useFakeTimers();
  let container!: HTMLElement;
  try {
    await act(async () => {
      container = render(<App />).container;
    });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 1, 0, 0);
    vi.setSystemTime(tomorrow);
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    const localDate =
      tomorrow.getFullYear() +
      "-" +
      String(tomorrow.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(tomorrow.getDate()).padStart(2, "0");
    expect(
      (
        container.querySelector(
          '.time-panel input[type="date"]',
        ) as HTMLInputElement
      ).value,
    ).toBe(localDate);
  } finally {
    vi.useRealTimers();
  }
});

it("searches note contents across projects including closed projects and opens the match", async () => {
  const closedPath = "projects/q/notes/history/closed.txt";
  const content = "Old work\nA significant outcome";
  data.projects.push({ id: "q", name: "Archived", closed: true, defaultProjectCodeId: "test" });
  data.notes.push({ path: closedPath, content });
  const { container } = render(<App />);
  await openOverview();
  fireEvent.keyDown(window, { key: "F", ctrlKey: true, shiftKey: true });
  fireEvent.change(
    screen.getByRole("textbox", { name: "Search note contents" }),
    { target: { value: "SIGNIFICANT" } },
  );
  const dialog = screen.getByRole("dialog", { name: "searchNotes" });
  expect(within(dialog).getByText("A significant outcome")).toBeTruthy();
  fireEvent.click(
    within(dialog).getByRole("button", { name: /history\/closed.txt/ }),
  );
  await waitFor(() =>
    expect(container.querySelector(".cm-content")?.textContent).toContain(
      "significant outcome",
    ),
  );
  await waitFor(()=>expect(container.querySelector(".cm-editor")).toBeTruthy());
  const editor = EditorView.findFromDOM(
    container.querySelector(".cm-editor") as HTMLElement,
  )!;
  expect(editor.state.selection.main.head).toBe(content.indexOf("significant"));
  expect(
    screen.getByTitle(
      "Open Archived overview · Drop here to move to Archived",
    ).textContent,
  ).toBe("Archived");
});

it("searches an unsaved note draft and jumps within its already open editor", async () => {
  const { container } = render(<App />);
  await openOverview();
  fireEvent.click(screen.getByRole("button", { name: "Follow up" }));
  await waitFor(()=>expect(container.querySelector(".cm-editor")).toBeTruthy());
  const editor = EditorView.findFromDOM(
    container.querySelector(".cm-editor") as HTMLElement,
  )!;
  await act(async () => {
    editor.dispatch({
      changes: { from: editor.state.doc.length, insert: "\nUnsaved discovery" },
    });
  });
  fireEvent.click(screen.getByRole("button", { name: "Search notes" }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "Search note contents" }),
    { target: { value: "discovery" } },
  );
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "searchNotes" })).getByRole(
      "button",
      { name: /log.md/ },
    ),
  );
  await waitFor(()=>expect(editor.state.selection.main.head).toBe(editor.state.doc.toString().indexOf("discovery")));
});

it("suggests a selected daily filename, accepts Enter, then reopens today's existing log", async () => {
  const { container } = render(<App />);
  await openOverview();
  fireEvent.keyDown(window, { key: "D", ctrlKey: true, shiftKey: true });
  const input = screen.getByRole("textbox", {
    name: "Note name",
  }) as HTMLInputElement;
  expect(input.value).toBe("daily/" + today() + ".md");
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  fireEvent.submit(input.closest("form")!);
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith("create_note", {
      path: "projects/p/notes/daily/" + today() + ".md",
    }),
  );
  await waitFor(() =>
    expect(container.querySelector(".cm-content")).toBeTruthy(),
  );
  fireEvent.keyDown(window, { key: "D", ctrlKey: true, shiftKey: true });
  expect(screen.queryByRole("dialog", { name: "Note name" })).toBeNull();
  expect(
    mocks.request.mock.calls.filter(([action]) => action === "create_note"),
  ).toHaveLength(1);
});

it("lets the user replace the daily note's suggested name", async () => {
  render(<App />);
  await openOverview();
  fireEvent.keyDown(window, { key: "D", ctrlKey: true, shiftKey: true });
  const input = screen.getByRole("textbox", { name: "Note name" });
  fireEvent.change(input, { target: { value: "meetings/planning" } });
  fireEvent.submit(input.closest("form")!);
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith("create_note", {
      path: "projects/p/notes/meetings/planning.md",
    }),
  );
});

it("applies timesheet presets and switches report grouping", async () => {
  data.records = [
    {
      type: "entry",
      id: "time",
      projectId: "p", projectCodeId: "test",
      date: today(),
      minutes: 45,
      note: "Work",
    },
  ];
  render(<App />);
  await openOverview();
  fireEvent.click(screen.getByRole("button", { name: "Reports" }));
  const dialog = screen.getByRole("dialog", { name: "report" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Today" }));
  expect(
    (within(dialog).getByLabelText("From") as HTMLInputElement).value,
  ).toBe(today());
  expect(
    (within(dialog).getByLabelText("Through") as HTMLInputElement).value,
  ).toBe(today());
  expect(dialog.querySelector(".report-preview")?.textContent).toContain(
    "# Time report — by project",
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Day" }));
  expect(dialog.querySelector(".report-preview")?.textContent).toContain("## " + today() + " [0h 45m]");
  expect(localStorage.getItem("worklog.reportGrouping")).toBe('"day"');
  fireEvent.click(within(dialog).getByRole("button", { name: "Task" }));
  expect(dialog.querySelector(".report-preview")?.textContent).toContain("## One [0h 45m]");
  expect((within(dialog).getByLabelText("From") as HTMLInputElement).value).toBe(today());
  const preview = dialog.querySelector(".report-preview")?.textContent;
  let finishCopy!: () => void;
  const writeText = vi.fn(() => new Promise<void>((resolve) => { finishCopy = resolve; }));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Copy" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(preview));
  expect(within(dialog).queryByRole("button", { name: "Copied!" })).toBeNull();
  await act(async () => finishCopy());
  await within(dialog).findByRole("button", { name: "Copied!" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Export Markdown" }));
  await waitFor(() => expect(exportFile).toHaveBeenCalledWith(preview, today(), today()));
  fireEvent.click(within(dialog).getByRole("button", { name: "Last week" }));
  expect(within(dialog).getByRole("button", { name: "Copy" })).toBeTruthy();
  const [from, through] = reportRange("lastWeek");
  expect(
    (within(dialog).getByLabelText("From") as HTMLInputElement).value,
  ).toBe(from);
  expect(
    (within(dialog).getByLabelText("Through") as HTMLInputElement).value,
  ).toBe(through);
});

it("restores the saved report grouping", async () => {
  localStorage.setItem("worklog.reportGrouping", '"day"');
  render(<App />);
  await openOverview();
  fireEvent.click(screen.getByRole("button", { name: "Reports" }));
  const dialog = screen.getByRole("dialog", { name: "report" });
  expect(within(dialog).getByRole("button", { name: "Day" }).getAttribute("aria-pressed")).toBe("true");
  expect(dialog.querySelector(".report-preview")?.textContent).toContain("by day");
});

it("pages content-search results without hiding the number of remaining notes", async () => {
  data.notes = Array.from({ length: 51 }, (_, index) => ({
    path: "projects/p/notes/" + String(index).padStart(2, "0") + ".md",
    content: "Shared evidence",
  }));
  render(<App />);
  await waitFor(() =>
    expect(
      screen.getByTitle(
        "Open One overview · Drop here to move to One",
      ).textContent,
    ).toBe("One"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Search notes" }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "Search note contents" }),
    { target: { value: "evidence" } },
  );
  const dialog = screen.getByRole("dialog", { name: "searchNotes" });
  expect(within(dialog).queryByText("50.md")).toBeNull();
  fireEvent.click(within(dialog).getByText("Show more (1 remaining)"));
  expect(within(dialog).getByText("50.md")).toBeTruthy();
});

it("shows only the global and task roots in order, with global notes initially collapsed", async () => {
  data.notes.push({ path: "global/notes/shared.md", content: "Shared reference" });
  localStorage.setItem("worklog.tree:test-workspace:global/notes", "[]");
  const { container, unmount } = render(<App />);
  await openOverview();
  const roots = container.querySelectorAll(".tree-root-row .tree-root");
  expect([...roots].map((root) => root.textContent)).toEqual(["Global notes", "One"]);
  expect(container.querySelector(".sidebar-section")).toBeNull();
  expect(screen.queryByRole("button", { name: "Today's log" })).toBeNull();
  expect(screen.queryByRole("button", { name: "shared" })).toBeNull();
  const toggle = screen.getByRole("button", { name: "Toggle Global notes" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(screen.getByRole("button", { name: "shared" })).toBeTruthy();
  unmount();
  render(<App />);
  await openOverview();
  expect(screen.getByRole("button", { name: "Toggle Global notes" }).getAttribute("aria-expanded")).toBe("false");
});

it("suggests the date for the first global note and creates it from the root menu", async () => {
  render(<App />);
  await openOverview();
  fireEvent.contextMenu(screen.getByRole("button", { name: "Global notes" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "New note" }));
  const dialog = screen.getByRole("dialog", { name: "Create note" });
  const input = within(dialog).getByRole("textbox", { name: "Note name" }) as HTMLInputElement;
  expect(input.value).toBe(today());
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  expect((within(dialog).getByLabelText("Create in") as HTMLSelectElement).value).toBe("global");
  fireEvent.submit(input.closest("form")!);
  await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("create_note", { path: "global/notes/" + today() + ".md" }));
  fireEvent.contextMenu(screen.getByRole("button", { name: "Global notes" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "New note" }));
  expect((screen.getByRole("textbox", { name: "Note name" }) as HTMLInputElement).value).toBe("");
});

it("creates folders from a root menu and keeps a custom name when changing note ownership", async () => {
  render(<App />);
  await openOverview();
  fireEvent.contextMenu(screen.getByRole("button", { name: "Global notes" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "New folder" }));
  const dialog = screen.getByRole("dialog", { name: "Create folder" });
  const input = within(dialog).getByRole("textbox", { name: "Folder name" });
  expect((input as HTMLInputElement).value).toBe("");
  fireEvent.change(input, { target: { value: "Reference" } });
  fireEvent.submit(input.closest("form")!);
  await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("create_folder", { path: "global/notes/Reference" }));
  fireEvent.keyDown(window, { key: "n", ctrlKey: true });
  const name = screen.getByRole("textbox", { name: "Note name" });
  fireEvent.change(name, { target: { value: "Meeting notes" } });
  fireEvent.change(screen.getByLabelText("Create in"), { target: { value: "global" } });
  expect((name as HTMLInputElement).value).toBe("Meeting notes");
});

it("puts time history in the log time panel instead of recent entries or the toolbar", async () => {
  const { container } = render(<App />);
  await openOverview();
  const history = screen.getByRole("button", { name: "Time history" });
  expect(history.closest(".time-panel")).toBeTruthy();
  expect(container.querySelector(".recent-entries")).toBeNull();
  expect(screen.queryByText(/Recent entries/)).toBeNull();
  fireEvent.click(history);
  expect(screen.getByRole("dialog", { name: "timeHistory" })).toBeTruthy();
});

it("shows Use today only for another date and preserves the time draft when resetting it", async () => {
  const { container } = render(<App />);
  await openOverview();
  const form = within(container.querySelector(".time-panel form") as HTMLElement);
  expect(form.queryByRole("button", { name: "Use today" })).toBeNull();
  const date = form.getByLabelText("Date") as HTMLInputElement;
  const duration = form.getByRole("textbox", { name: "Duration" });
  fireEvent.change(duration, { target: { value: "45m" } });
  fireEvent.change(date, { target: { value: "2026-01-02" } });
  fireEvent.click(form.getByRole("button", { name: "Use today" }));
  expect(date.value).toBe(today());
  expect((duration as HTMLInputElement).value).toBe("45m");
  expect(form.queryByRole("button", { name: "Use today" })).toBeNull();
  expect(form.queryByText(/local time/i)).toBeNull();
  expect(JSON.parse(localStorage.getItem("worklog.draft.v3:test-workspace")!).dateMode).toBe("today");
});
