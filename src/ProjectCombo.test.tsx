// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ProjectCombo from "./ProjectCombo";

afterEach(cleanup);
function setup() {
  const onPick = vi.fn();
  const onCreate = vi.fn();
  render(
    <ProjectCombo
      projects={[
        { id: "a", name: "Alpha", closed: false, defaultProjectCodeId: "test" },
        { id: "b", name: "Beta", closed: false, defaultProjectCodeId: "test" },
        { id: "c", name: "Gamma", closed: false, defaultProjectCodeId: "test" },
        { id: "d", name: "Closed", closed: true, defaultProjectCodeId: "test" },
      ]}
      value="a"
      onPick={onPick}
      onCreate={onCreate}
    />,
  );
  return {
    onPick,
    onCreate,
    input: screen.getByRole("combobox", { name: "Task" }),
  };
}
it("reopens after mouse selection without requiring the input to lose focus", () => {
  const { input, onPick } = setup();
  fireEvent.focus(input);
  fireEvent.click(screen.getByRole("option", { name: "Beta" }));
  expect(onPick.mock.calls[0][0].id).toBe("b");
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.click(input);
  expect(screen.getByRole("option", { name: "Gamma" })).toBeTruthy();
  fireEvent.click(screen.getByRole("option", { name: "Gamma" }));
  fireEvent.click(screen.getByRole("button", { name: "Toggle task list" }));
  expect(screen.getByRole("listbox")).toBeTruthy();
});
it("navigates filtered projects with arrows and Enter, including upward wrapping", () => {
  const { input, onPick } = setup();
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "a" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(
    screen.getByRole("option", { name: "Alpha" }).getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onPick.mock.calls[0][0].id).toBe("b");
  fireEvent.keyDown(input, { key: "ArrowUp" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onPick.mock.calls[1][0].id).toBe("c");
});
it("creates through the keyboard, resets filtering when reopened, and dismisses with Escape", () => {
  const { input, onCreate } = setup();
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "New project" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onCreate).toHaveBeenCalledWith("New project");
  fireEvent.click(input);
  expect(screen.getByRole("option", { name: "Alpha" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Closed" })).toBeNull();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
});
