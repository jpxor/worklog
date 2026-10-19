import { expect, it } from "vitest";
import { switchSession, type Sessions } from "./taskSessions";

it("restores each task's ordered tabs and active note through A B A switches", () => {
  const a: Sessions = {
    project: "a",
    tabs: ["projects/a/notes/Investigation.md", "projects/a/notes/Fix.md"],
    active: "projects/a/notes/Fix.md",
  };
  const b = switchSession(a, "b");
  expect(b.tabs).toEqual(["overview:b"]);
  const editedB = {
    ...b,
    tabs: ["projects/b/notes/Design.md"],
    active: "projects/b/notes/Design.md",
  };
  const restored = switchSession(editedB, "a");
  expect(restored.tabs).toEqual(a.tabs);
  expect(restored.active).toBe(a.active);
  expect(switchSession(restored, "b").tabs).toEqual(editedB.tabs);
  expect(switchSession(restored, "b").active).toBe(editedB.active);
});

it("keeps global tabs while restoring the task active before global navigation", () => {
  const state: Sessions = {
    project: "a",
    tabs: [
      "global:overview",
      "projects/a/notes/Fix.md",
      "global/notes/Team.md",
    ],
    active: "global/notes/Team.md",
    taskActive: "projects/a/notes/Fix.md",
  };
  const next = switchSession(state, "b");
  expect(next.tabs).toEqual([
    "global:overview",
    "global/notes/Team.md",
    "overview:b",
  ]);
  const restored = switchSession(next, "a");
  expect(restored.tabs).toEqual([
    "global:overview",
    "global/notes/Team.md",
    "projects/a/notes/Fix.md",
  ]);
  expect(restored.active).toBe(state.taskActive);
});

it("remembers deliberately empty sessions without reopening an overview", () => {
  const empty: Sessions = { project: "a", tabs: [], active: "" };
  const restored = switchSession(switchSession(empty, "b"), "a");
  expect(restored.tabs).toEqual([]);
  expect(restored.active).toBe("");
  expect(switchSession(restored, "a")).toBe(restored);
});
