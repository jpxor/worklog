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
import { emptySnapshot, today, reportRange, type Snapshot } from "./model";
const path = "projects/p/notes/log.md";
let data: Snapshot;
let file: string;
beforeEach(() => {
  localStorage.clear();
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
    root: "test-workspace",
    projects: [{ id: "p", name: "One", closed: false }],
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
async function openOverview() {
  await waitFor(() =>
    expect(
      screen.getByTitle(
        "Open project overview · Drop a note here to move it to the project root",
      ).textContent,
    ).toBe("One"),
  );
  fireEvent.click(
    screen.getByTitle(
      "Open project overview · Drop a note here to move it to the project root",
    ),
  );
  return screen.findByRole("region", { name: "One project overview" });
}
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
  const editor = EditorView.findFromDOM(
    container.querySelector(".cm-editor")!,
  )!;
  expect(editor.state.selection.main.head).toBe(file.indexOf("[x]"));
  fireEvent.click(
    screen.getByTitle(
      "Open project overview · Drop a note here to move it to the project root",
    ),
  );
  await screen.findByRole("region", { name: "One project overview" });
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
  const editor = EditorView.findFromDOM(
    container.querySelector(".cm-editor")!,
  )!;
  editor.dispatch({
    changes: { from: editor.state.doc.length, insert: "- [ ] Draft item\n" },
  });
  fireEvent.click(
    screen.getByTitle(
      "Open project overview · Drop a note here to move it to the project root",
    ),
  );
  await screen.findByRole("region", { name: "One project overview" });
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
    "worknotes.draft",
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
  data.projects.push({ id: "q", name: "Archived", closed: true });
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
  const editor = EditorView.findFromDOM(
    container.querySelector(".cm-editor") as HTMLElement,
  )!;
  expect(editor.state.selection.main.head).toBe(content.indexOf("significant"));
  expect(
    screen.getByTitle(
      "Open project overview · Drop a note here to move it to the project root",
    ).textContent,
  ).toBe("Archived");
});

it("searches an unsaved note draft and jumps within its already open editor", async () => {
  const { container } = render(<App />);
  await openOverview();
  fireEvent.click(screen.getByRole("button", { name: "Follow up" }));
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
  expect(editor.state.selection.main.head).toBe(
    editor.state.doc.toString().indexOf("discovery"),
  );
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
  fireEvent.click(screen.getByRole("button", { name: "Today's log" }));
  expect(screen.queryByRole("dialog", { name: "Note name" })).toBeNull();
  expect(
    mocks.request.mock.calls.filter(([action]) => action === "create_note"),
  ).toHaveLength(1);
});

it("lets the user replace the daily note's suggested name", async () => {
  render(<App />);
  await openOverview();
  fireEvent.click(screen.getByRole("button", { name: "Today's log" }));
  const input = screen.getByRole("textbox", { name: "Note name" });
  fireEvent.change(input, { target: { value: "meetings/planning" } });
  fireEvent.submit(input.closest("form")!);
  await waitFor(() =>
    expect(mocks.request).toHaveBeenCalledWith("create_note", {
      path: "projects/p/notes/meetings/planning.md",
    }),
  );
});

it("applies timesheet presets and updates the preview's daily totals", async () => {
  data.records = [
    {
      type: "entry",
      id: "time",
      projectId: "p",
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
    "## Daily totals\n\n" + today() + " — 45m",
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Last week" }));
  const [from, through] = reportRange("lastWeek");
  expect(
    (within(dialog).getByLabelText("From") as HTMLInputElement).value,
  ).toBe(from);
  expect(
    (within(dialog).getByLabelText("Through") as HTMLInputElement).value,
  ).toBe(through);
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
        "Open project overview · Drop a note here to move it to the project root",
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
