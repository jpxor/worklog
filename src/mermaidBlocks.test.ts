import { expect, it } from "vitest";
import { findMermaidBlocks } from "./mermaidBlocks";
it("finds closed Mermaid blocks and preserves their source and insertion positions", () => {
  const text =
    "Notes\n```mermaid\nflowchart LR\n  A --> B\n```\nMore\n~~~mermaid\nsequenceDiagram\n A->>B: Hello\n~~~\n";
  const blocks = findMermaidBlocks(text);
  expect(blocks.map((block) => block.source)).toEqual([
    "flowchart LR\n  A --> B",
    "sequenceDiagram\n A->>B: Hello",
  ]);
  expect(text.slice(blocks[0].from, blocks[0].to)).toBe(
    "```mermaid\nflowchart LR\n  A --> B\n```",
  );
});
it("ignores ordinary code and Mermaid examples nested inside a longer code fence", () => {
  expect(
    findMermaidBlocks(
      "````markdown\n```mermaid\nA-->B\n```\n````\n```js\nconsole.log(1)\n```",
    ),
  ).toEqual([]);
});
it("waits for a matching closing fence and supports CRLF and indentation", () => {
  expect(findMermaidBlocks("```mermaid\nflowchart LR\nA-->B")).toEqual([]);
  const text = "  ~~~MERMAID\r\nflowchart LR\r\nA-->B\r\n  ~~~";
  expect(findMermaidBlocks(text)[0]).toEqual({
    from: 0,
    to: text.length,
    source: "flowchart LR\nA-->B",
  });
  expect(findMermaidBlocks("````mermaid\nA-->B\n```\n")).toEqual([]);
});
