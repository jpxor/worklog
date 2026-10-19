// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ProjectOverview from "./ProjectOverview";
import { noteTodos, setTodoChecked } from "./noteTodos";
import type { Note } from "./model";
afterEach(cleanup);
const project = { id: "one", name: "One", closed: false, defaultProjectCodeId: "test" };
const note: Note = {
  path: "projects/one/notes/old.md",
  content: "# Log\n\n- [ ] Follow up\n- [x] Already done",
  modified: 100,
};
const other: Note = {
  path: "projects/one/notes/new.md",
  content: "New note",
  modified: 200,
};
it("shows one ordered list and opens notes or exact checkbox positions", () => {
  const onOpen = vi.fn();
  const { container } = render(
    <ProjectOverview
      project={project}
      notes={[other, note]}
      disabled={false}
      onOpen={onOpen}
      onToggle={vi.fn()}
      onNewNote={vi.fn()}
    />,
  );
  expect(
    [...container.querySelectorAll(".overview-note-link")].map(
      (item) => item.textContent,
    ),
  ).toEqual(["old.md", "new.md"]);
  expect(screen.queryByText("Already done")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "old.md" }));
  expect(onOpen).toHaveBeenLastCalledWith(note.path);
  fireEvent.click(screen.getByRole("button", { name: "Follow up" }));
  expect(onOpen).toHaveBeenLastCalledWith(note.path, noteTodos(note)[0].from);
});
it("keeps completed items and rows in place until the overview is reopened", async () => {
  const onToggle = vi.fn().mockResolvedValue(true);
  const props = {
    project,
    disabled: false,
    onOpen: vi.fn(),
    onToggle,
    onNewNote: vi.fn(),
  };
  const { container, rerender, unmount } = render(
    <ProjectOverview {...props} notes={[note, other]} />,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: /Follow up/ }));
  await waitFor(() =>
    expect(onToggle).toHaveBeenCalledWith(note, noteTodos(note)[0], true),
  );
  const completed = {
    ...note,
    content: setTodoChecked(note.content, noteTodos(note)[0], true),
    modified: 150,
  };
  rerender(<ProjectOverview {...props} notes={[completed, other]} />);
  expect(
    (screen.getByRole("checkbox", { name: /Follow up/ }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    [...container.querySelectorAll(".overview-note-link")].map(
      (item) => item.textContent,
    ),
  ).toEqual(["old.md", "new.md"]);
  unmount();
  const fresh = render(
    <ProjectOverview {...props} notes={[completed, other]} />,
  );
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(
    [...fresh.container.querySelectorAll(".overview-note-link")].map(
      (item) => item.textContent,
    ),
  ).toEqual(["new.md", "old.md"]);
});
it("leaves failed changes unchecked and offers note creation in empty projects", async () => {
  const onNewNote = vi.fn();
  const props = {
    project,
    disabled: false,
    onOpen: vi.fn(),
    onToggle: vi.fn().mockResolvedValue(false),
    onNewNote,
  };
  const { rerender } = render(<ProjectOverview {...props} notes={[note]} />);
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(props.onToggle).toHaveBeenCalled());
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
    false,
  );
  rerender(<ProjectOverview {...props} notes={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Create a note" }));
  expect(onNewNote).toHaveBeenCalled();
});
