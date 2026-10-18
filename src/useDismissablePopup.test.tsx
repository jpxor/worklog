// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useDismissablePopup } from "./useDismissablePopup";
afterEach(cleanup);
function Example() {
  const [open, setOpen] = useState(false);
  const host = useDismissablePopup(open, () => setOpen(false));
  return (
    <>
      <div ref={host}>
        <button onClick={() => setOpen(!open)}>Options</button>
        {open && (
          <div role="menu">
            <button>Action</button>
          </div>
        )}
      </div>
      <button>Outside</button>
    </>
  );
}
it("closes on outside pointer down while preserving clicks inside and toggle behavior", () => {
  render(<Example />);
  fireEvent.click(screen.getByText("Options"));
  fireEvent.pointerDown(screen.getByText("Action"));
  expect(screen.queryByRole("menu")).not.toBeNull();
  fireEvent.pointerDown(screen.getByText("Outside"));
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.click(screen.getByText("Options"));
  fireEvent.pointerDown(screen.getByText("Options"));
  fireEvent.click(screen.getByText("Options"));
  expect(screen.queryByRole("menu")).toBeNull();
});
it("closes on Escape and returns focus to the options button", () => {
  render(<Example />);
  fireEvent.click(screen.getByText("Options"));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(screen.getByText("Options"));
});
