// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CodePicker from "./CodePicker";
afterEach(cleanup);
const codes = [
  { id: "portal", label: "PORTAL", archived: false },
  { id: "old", label: "OLD", archived: true },
];
it("creates a code by keyboard and selects its returned identity", async () => {
  const onPick = vi.fn(),
    onCreate = vi.fn().mockResolvedValue("support");
  render(
    <CodePicker
      codes={codes}
      value="portal"
      onPick={onPick}
      onCreate={onCreate}
      onRestore={vi.fn()}
    />,
  );
  const input = screen.getByRole("combobox", { name: "Project code" });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "SUPPORT" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(onPick).toHaveBeenCalledWith("support"));
  expect(onCreate).toHaveBeenCalledWith("SUPPORT");
});
it("requires explicit restoration before selecting an archived code", async () => {
  const onPick = vi.fn(),
    onCreate = vi.fn(),
    onRestore = vi.fn().mockResolvedValue(undefined);
  render(
    <CodePicker
      codes={codes}
      value="portal"
      onPick={onPick}
      onCreate={onCreate}
      onRestore={onRestore}
    />,
  );
  fireEvent.focus(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: /OLD/ }));
  expect(screen.getByRole("alert").textContent).toContain("archived");
  expect(onPick).not.toHaveBeenCalled();
  expect(onCreate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Restore code" }));
  await waitFor(() => expect(onPick).toHaveBeenCalledWith("old"));
  expect(onRestore).toHaveBeenCalledWith(codes[1]);
});
it("announces create failures and retries the same label", async () => {
  const onPick = vi.fn(),
    onCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue("support");
  render(
    <CodePicker
      codes={codes}
      value="portal"
      onPick={onPick}
      onCreate={onCreate}
      onRestore={vi.fn()}
    />,
  );
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "SUPPORT" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect((await screen.findByRole("alert")).textContent).toContain("Offline");
  expect(onPick).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry SUPPORT" }));
  await waitFor(() => expect(onPick).toHaveBeenCalledWith("support"));
  expect(onCreate.mock.calls).toEqual([["SUPPORT"], ["SUPPORT"]]);
});
