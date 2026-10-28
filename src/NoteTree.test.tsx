// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import NoteTree from "./NoteTree";

afterEach(cleanup);
it("offers a compact root creation button even while an empty section is collapsed", () => {
  const onNewNote = vi.fn();
  const props = { notes: [], folders: [], prefix: "global/notes", projectName: "Global notes", active: "", onOpen: vi.fn(), onMove: vi.fn(), onRename: vi.fn(), onNewNote, defaultCollapsed: true };
  const { rerender } = render(<NoteTree {...props} />);
  const button = screen.getByRole("button", { name: "New note in Global notes" });
  expect(button.title).toBe("New note in Global notes");
  expect(screen.queryByText("Write your first note")).toBeNull();
  fireEvent.click(button);
  expect(onNewNote).toHaveBeenCalledWith("global/notes");
  rerender(<NoteTree {...props} disabled />);
  expect((button as HTMLButtonElement).disabled).toBe(true);
});

it("shows the configured task-note shortcut in the root button tooltip", () => {
  render(<NoteTree notes={[]} folders={[]} prefix="projects/p/notes" projectName="One" active="" onOpen={vi.fn()} onMove={vi.fn()} onRename={vi.fn()} onNewNote={vi.fn()} newNoteShortcut="Ctrl+Shift+N" />);
  expect(screen.getByRole("button", { name: "New note in One" }).title).toBe("New note in One (Ctrl+Shift+N)");
});
const root = "projects/p/notes";
const source = `${root}/draft.md`;
const nested = `${root}/folder/nested.md`;
function setup(disabled = false) {
  const onMove = vi.fn();
  const onRename = vi.fn();
  render(
    <NoteTree
      notes={[
        { path: source, content: "" },
        { path: nested, content: "" },
      ]}
      folders={[`${root}/folder`]}
      prefix={root}
      active={source}
      onOpen={vi.fn()}
      onMove={onMove}
      onRename={onRename}
      disabled={disabled}
    />,
  );
  return { onMove, onRename };
}
function transfer(path: string) {
  const values: Record<string, string> = {};
  const dataTransfer = {
    types: ["application/x-worklog-note"],
    setData: (type: string, value: string) => {
      values[type] = value;
    },
    getData: (type: string) => values[type] || "",
    effectAllowed: "",
    dropEffect: "",
  };
  dataTransfer.setData("application/x-worklog-note", path);
  return dataTransfer;
}
it("opens the overview from the project root without changing its drop behavior", () => {
  const onOverview = vi.fn();
  const onMove = vi.fn();
  render(
    <NoteTree
      notes={[{ path: source, content: "" }]}
      folders={[]}
      prefix={root}
      projectName="One"
      active=""
      overviewActive
      onOverview={onOverview}
      onOpen={vi.fn()}
      onMove={onMove}
      onRename={vi.fn()}
    />,
  );
  const button = screen.getByRole("button", { name: "One" });
  fireEvent.click(button);
  expect(onOverview).toHaveBeenCalledOnce();
  expect(button.classList.contains("selected")).toBe(true);
  fireEvent.drop(button, { dataTransfer: transfer(source) });
  expect(onMove).not.toHaveBeenCalled();
});
it("moves notes to folders and back to root, ignoring same-path drops", () => {
  const { onMove } = setup();
  fireEvent.dragStart(screen.getByRole("button", { name: "draft" }), {
    dataTransfer: transfer(source),
  });
  fireEvent.drop(screen.getByRole("button", { name: "folder" }), {
    dataTransfer: transfer(source),
  });
  expect(onMove).toHaveBeenCalledWith(source, `${root}/folder/draft.md`);
  fireEvent.drop(screen.getByRole("button", { name: "Project root" }), {
    dataTransfer: transfer(nested),
  });
  expect(onMove).toHaveBeenCalledWith(nested, `${root}/nested.md`);
  fireEvent.drop(screen.getByRole("button", { name: "Project root" }), {
    dataTransfer: transfer(source),
  });
  expect(onMove).toHaveBeenCalledTimes(2);
});
it("rejects foreign and disabled drops", () => {
  const { onMove } = setup(true);
  fireEvent.drop(screen.getByRole("button", { name: "folder" }), {
    dataTransfer: transfer(source),
  });
  expect(onMove).not.toHaveBeenCalled();
  cleanup();
  const enabled = setup();
  fireEvent.drop(screen.getByRole("button", { name: "folder" }), {
    dataTransfer: transfer("projects/other/notes/a.md"),
  });
  expect(enabled.onMove).not.toHaveBeenCalled();
});
it("renames an unopened note from its context menu and dismisses with Escape", () => {
  const { onRename } = setup();
  fireEvent.contextMenu(screen.getByRole("button", { name: "nested" }), {
    clientX: 100,
    clientY: 100,
  });
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename / move…" }));
  expect(onRename).toHaveBeenCalledWith(nested);
  fireEvent.contextMenu(screen.getByRole("button", { name: "draft" }));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
});
it("offers file management actions and places pinned nested notes at the top", () => {
  const onDelete = vi.fn(),
    onReveal = vi.fn(),
    onMoveProject = vi.fn(),
    onPin = vi.fn();
  render(
    <NoteTree
      notes={[
        { path: source, content: "" },
        { path: nested, content: "" },
      ]}
      folders={[`${root}/folder`]}
      prefix={root}
      active={source}
      onOpen={vi.fn()}
      onMove={vi.fn()}
      onRename={vi.fn()}
      onDelete={onDelete}
      onReveal={onReveal}
      onMoveProject={onMoveProject}
      onPin={onPin}
      pinned={[nested]}
    />,
  );
  const noteButtons = screen
    .getAllByRole("button")
    .filter((button) => button.classList.contains("tree-file"));
  expect(noteButtons[0].textContent).toBe("nested");
  fireEvent.contextMenu(noteButtons[0]);
  fireEvent.click(screen.getByRole("menuitem", { name: "Unpin" }));
  expect(onPin).toHaveBeenCalledWith(nested);
  fireEvent.contextMenu(screen.getByRole("button", { name: "draft" }));
  fireEvent.click(
    screen.getByRole("menuitem", { name: "Move…" }),
  );
  expect(onMoveProject).toHaveBeenCalledWith(source);
  fireEvent.contextMenu(screen.getByRole("button", { name: "draft" }));
  fireEvent.click(
    screen.getByRole("menuitem", { name: "Open containing folder" }),
  );
  expect(onReveal).toHaveBeenCalledWith(source);
  fireEvent.contextMenu(screen.getByRole("button", { name: "folder" }));
  fireEvent.click(
    screen.getByRole("menuitem", { name: "Delete empty folder" }),
  );
  expect(onDelete).toHaveBeenCalledWith(`${root}/folder`, true);
});
it("moves folders and rejects dropping a folder inside itself", () => {
  const { onMove } = setup();
  fireEvent.drop(screen.getByRole("button", { name: "Project root" }), {
    dataTransfer: transfer(`${root}/folder`),
  });
  expect(onMove).not.toHaveBeenCalled();
  fireEvent.drop(screen.getByRole("button", { name: "folder" }), {
    dataTransfer: transfer(`${root}/folder`),
  });
  expect(onMove).not.toHaveBeenCalled();
  cleanup();
  render(
    <NoteTree
      notes={[{ path: nested, content: "" }]}
      folders={[`${root}/folder`, `${root}/destination`]}
      prefix={root}
      active=""
      onOpen={vi.fn()}
      onMove={onMove}
      onRename={vi.fn()}
    />,
  );
  fireEvent.drop(screen.getByRole("button", { name: "destination" }), {
    dataTransfer: transfer(`${root}/folder`),
  });
  expect(onMove).toHaveBeenCalledWith(
    `${root}/folder`,
    `${root}/destination/folder`,
  );
});
