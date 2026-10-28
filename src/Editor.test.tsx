// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import Editor from "./Editor";

afterEach(cleanup);

it.each([false, true])("inserts a literal tab without losing focus (plain: %s)", (plain) => {
  const onChange = vi.fn();
  const { container } = render(<Editor content="abcd" plain={plain} onChange={onChange} onCursor={() => {}} />);
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  act(() => {
    view.focus();
    view.dispatch({ selection: { anchor: 2 } });
  });
  fireEvent.keyDown(view.contentDOM, { key: "Tab", code: "Tab", keyCode: 9 });
  expect(view.state.doc.toString()).toBe("ab\tcd");
  expect(view.state.selection.main.head).toBe(3);
  expect(view.hasFocus).toBe(true);
  expect(onChange).toHaveBeenCalledWith("ab\tcd");
});

it("replaces the selection with a tab and lets Escape then Tab leave the editor", () => {
  const { container } = render(<Editor content="abcdef" onChange={() => {}} onCursor={() => {}} />);
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  act(() => {
    view.focus();
    view.dispatch({ selection: { anchor: 1, head: 5 } });
  });
  fireEvent.keyDown(view.contentDOM, { key: "Tab", code: "Tab", keyCode: 9 });
  expect(view.state.doc.toString()).toBe("a\tf");
  fireEvent.keyDown(view.contentDOM, { key: "Escape", code: "Escape", keyCode: 27 });
  expect(fireEvent.keyDown(view.contentDOM, { key: "Tab", code: "Tab", keyCode: 9 })).toBe(true);
  expect(view.state.doc.toString()).toBe("a\tf");
});

it("groups quote and code lines into separate scrolling blocks without swallowing prose", () => {
  const { container } = render(
    <Editor
      content={
        "> first\n> second\n\nProse\n\n```sh\necho one\necho two\n```\n```txt\nnext block\n```\n\n> another quote"
      }
      onChange={() => {}}
      onCursor={() => {}}
    />,
  );
  const quotes = container.querySelectorAll(".cm-scroll-quote");
  const code = container.querySelectorAll(".cm-scroll-code");
  expect(quotes).toHaveLength(2);
  expect(quotes[0].querySelectorAll(".cm-line")).toHaveLength(2);
  expect(code).toHaveLength(2);
  expect(code[0].textContent).toContain("echo two");
  expect(code[0].textContent).not.toContain("next block");
  expect(
    [...container.querySelectorAll(".cm-scroll-block")].some((block) =>
      block.textContent?.includes("Prose"),
    ),
  ).toBe(false);
});

it("keeps txt files plain without Markdown block containers", () => {
  const { container } = render(
    <Editor
      content={"> plain text\n```\ncommands\n```"}
      plain
      onChange={() => {}}
      onCursor={() => {}}
    />,
  );
  expect(container.querySelector(".cm-scroll-block")).toBeNull();
});

it("keeps heading text and markers neutral when switching themes", () => {
  const props = {
    content: "# Heading",
    onChange: () => {},
    onCursor: () => {},
  };
  const { container, rerender } = render(<Editor {...props} />);
  for (const dark of [false, true, false]) {
    rerender(<Editor {...props} dark={dark} />);
    const spans = [...container.querySelectorAll(".cm-line span")];
    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) {
      expect(getComputedStyle(span).color).toBe(
        getComputedStyle(span.parentElement!).color,
      );
    }
    expect(container.querySelector(".cm-content")?.textContent).toBe(
      "# Heading",
    );
  }
});
