// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EditorView } from "@codemirror/view";
import Editor from "./Editor";
const appStyles = readFileSync("src/style.css", "utf8");
afterEach(cleanup);

it.each([false, true])(
  "keeps Find options compact and usable with app styles (dark: %s)",
  (dark) => {
    const styles = document.createElement("style");
    styles.textContent = appStyles;
    document.head.append(styles);
    try {
      const { container } = render(
        <Editor
          content="Alpha alpha"
          dark={dark}
          onChange={() => {}}
          onCursor={() => {}}
        />,
      );
      act(() => window.dispatchEvent(new Event("worknotes:find")));
      const panel = container.querySelector(".cm-search");
      const controls = within(panel);
      for (const name of ["match case", "regexp", "by word"]) {
        const checkbox = controls.getByRole("checkbox", { name });
        expect(getComputedStyle(checkbox).width).toBe("auto");
        expect(getComputedStyle(checkbox.closest("label")).display).toBe(
          "inline-flex",
        );
        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(true);
        fireEvent.click(checkbox);
      }
      const find = controls.getByRole("textbox", { name: "Find" });
      expect(getComputedStyle(find).width).toBe("240px");
      fireEvent.change(find, { target: { value: "alpha" } });
      fireEvent.click(controls.getByRole("checkbox", { name: "match case" }));
      fireEvent.click(controls.getByRole("button", { name: "next" }));
      const view = EditorView.findFromDOM(
        container.querySelector(".cm-editor"),
      );
      expect(view.state.selection.main.from).toBe(6);
      fireEvent.click(controls.getByRole("button", { name: "close" }));
      expect(container.querySelector(".cm-search")).toBeNull();
    } finally {
      styles.remove();
    }
  },
);
