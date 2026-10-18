// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import Editor from "./Editor";

afterEach(cleanup);

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
      expect(getComputedStyle(span).color).toBe("inherit");
    }
    expect(container.querySelector(".cm-content")?.textContent).toBe(
      "# Heading",
    );
  }
});
