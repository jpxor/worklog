// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import NoteTabs from "./NoteTabs";
import { remapPath, reorderTabs } from "./notePaths";
afterEach(cleanup);
it("treats overview tabs as pages with a project label and no file rename action", () => {
  const onOpen = vi.fn();
  render(
    <NoteTabs
      tabs={["overview:p"]}
      active="overview:p"
      disabled={false}
      projects={[{ id: "p", name: "One", closed: false }]}
      onOpen={onOpen}
      onClose={vi.fn()}
      onRename={vi.fn()}
      onReorder={vi.fn()}
    />,
  );
  const tab = screen.getByRole("button", { name: "One · Overview" });
  fireEvent.click(tab);
  expect(onOpen).toHaveBeenCalledWith("overview:p");
  fireEvent.contextMenu(tab);
  expect(screen.queryByRole("menuitem", { name: "Rename / move…" })).toBeNull();
  expect(screen.getByRole("menuitem", { name: "Close tab" })).toBeTruthy();
});
it("reorders tabs in both directions and ignores foreign drops", () => {
  expect(reorderTabs(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
  expect(reorderTabs(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  expect(reorderTabs(["a", "b"], "foreign", "a")).toEqual(["a", "b"]);
  const onReorder = vi.fn();
  render(
    <NoteTabs
      tabs={["a.md", "b.md"]}
      active="a.md"
      disabled={false}
      onOpen={vi.fn()}
      onClose={vi.fn()}
      onRename={vi.fn()}
      onReorder={onReorder}
    />,
  );
  const dataTransfer = {
    types: ["application/x-worknotes-tab"],
    getData: () => "a.md",
  };
  fireEvent.drop(screen.getByRole("button", { name: "b.md" }).parentElement!, {
    dataTransfer,
  });
  expect(onReorder).toHaveBeenCalledWith(["b.md", "a.md"]);
});
it("offers rename for the clicked tab rather than only the active note", () => {
  const onRename = vi.fn();
  render(
    <NoteTabs
      tabs={["a.md", "b.txt"]}
      active="a.md"
      disabled={false}
      onOpen={vi.fn()}
      onClose={vi.fn()}
      onRename={onRename}
      onReorder={vi.fn()}
    />,
  );
  fireEvent.contextMenu(screen.getByRole("button", { name: "b.txt" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename / move…" }));
  expect(onRename).toHaveBeenCalledWith("b.txt");
});
it("remaps descendants without confusing sibling prefixes", () => {
  expect(remapPath("root/docs/a.txt", "root/docs", "root/new")).toBe(
    "root/new/a.txt",
  );
  expect(remapPath("root/docs-other/a.txt", "root/docs", "root/new")).toBe(
    "root/docs-other/a.txt",
  );
});
