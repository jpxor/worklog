// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import GlobalOverview from "./GlobalOverview";
import { noteTodos } from "./noteTodos";
afterEach(cleanup);
const old = {
  path: "global/notes/old.md",
  content: "- [ ] Follow up\n- [x] Finished",
  modified: 100,
};
const recent = {
  path: "global/notes/recent.md",
  content: "Reference",
  modified: 200,
};
const task = {
  path: "projects/a/notes/private.md",
  content: "- [ ] Task only",
  modified: 300,
};
it("leaves a checkbox unchecked when saving its change fails", async () => {
  const onToggle = vi.fn().mockResolvedValue(false);
  render(
    <GlobalOverview
      notes={[old]}
      pinned={[]}
      onOpen={vi.fn()}
      onToggle={onToggle}
      onNew={vi.fn()}
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Follow up" }));
  await waitFor(() =>
    expect(onToggle).toHaveBeenCalledWith(old, noteTodos(old)[0], true),
  );
  await waitFor(() =>
    expect(
      (screen.getByRole("checkbox", { name: "Follow up" }) as HTMLInputElement)
        .checked,
    ).toBe(false),
  );
});
it("shows only global todos, pins and recent notes with exact source navigation", () => {
  const onOpen = vi.fn(),
    onToggle = vi.fn().mockResolvedValue(true);
  const { container } = render(
    <GlobalOverview
      notes={[old, task, recent]}
      pinned={[task.path, old.path]}
      onOpen={onOpen}
      onToggle={onToggle}
      onNew={vi.fn()}
      disabled={false}
    />,
  );
  expect(screen.queryByText(/private.md|Task only|Finished/)).toBeNull();
  const lists = container.querySelectorAll("ul");
  expect(
    within(lists[1])
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["old.md"]);
  expect(
    within(lists[2])
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["recent.md", "old.md"]);
  fireEvent.click(screen.getByRole("button", { name: "old.md · Follow up" }));
  expect(onOpen).toHaveBeenCalledWith(old.path, noteTodos(old)[0].from);
  fireEvent.click(screen.getByRole("checkbox", { name: "Follow up" }));
  expect(onToggle).toHaveBeenCalledWith(old, noteTodos(old)[0], true);
});
it("updates membership and pins after a note moves out of global scope", () => {
  const props = {
    pinned: [old.path],
    onOpen: vi.fn(),
    onToggle: vi.fn(),
    onNew: vi.fn(),
    disabled: false,
  };
  const { rerender } = render(
    <GlobalOverview {...props} notes={[old, recent]} />,
  );
  rerender(
    <GlobalOverview
      {...props}
      notes={[{ ...old, path: "projects/a/notes/old.md" }, recent]}
    />,
  );
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByText("old.md")).toBeNull();
  expect(screen.getByText("No pinned notes")).toBeTruthy();
  expect(screen.getByText("No unchecked items")).toBeTruthy();
});
it("explains an empty global root and disables creation while busy", () => {
  const onNew = vi.fn();
  const props = {
    notes: [task],
    pinned: [],
    onOpen: vi.fn(),
    onToggle: vi.fn(),
    onNew,
  };
  const { rerender } = render(<GlobalOverview {...props} disabled={false} />);
  expect(screen.getByText(/Notes shared across all tasks/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "New global note" }));
  expect(onNew).toHaveBeenCalledTimes(1);
  rerender(<GlobalOverview {...props} disabled />);
  expect(
    (
      screen.getByRole("button", {
        name: "New global note",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
