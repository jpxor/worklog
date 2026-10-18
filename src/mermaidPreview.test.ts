// @vitest-environment jsdom
import { EditorState } from "@codemirror/state";
import type { EditorView, WidgetType } from "@codemirror/view";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("./mermaidRenderer", () => ({ renderMermaid: mocks.render }));
import { mermaidDark, mermaidPreviews } from "./mermaidPreview";
const source = "```mermaid\nflowchart LR\n A-->B\n```";
function widget(dark = false) {
  const state = EditorState.create({
    doc: source,
    extensions: [mermaidPreviews, mermaidDark.of(dark)],
  });
  let found!: WidgetType;
  state
    .field(mermaidPreviews)
    .between(0, state.doc.length, (_from, _to, decoration) => {
      found = decoration.spec.widget;
    });
  return { state, widget: found };
}
beforeEach(() => {
  vi.useFakeTimers();
  mocks.render
    .mockReset()
    .mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><text>Diagram</text></svg>',
    );
  URL.createObjectURL = vi.fn(() => "blob:mermaid-test");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});
it("renders below source without changing plaintext and cleans up blob URLs", async () => {
  const item = widget();
  const view = { requestMeasure: vi.fn() } as unknown as EditorView;
  const element = item.widget.toDOM(view);
  document.body.append(element);
  expect(mocks.render).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(500);
  expect(mocks.render).toHaveBeenCalledWith(
    "flowchart LR\n A-->B",
    false,
    expect.any(Function),
  );
  expect(element.querySelector("img")?.src).toBe("blob:mermaid-test");
  expect(element.querySelector("img")?.width).toBe(300);
  expect(item.state.doc.toString()).toBe(source);
  item.widget.destroy(element);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mermaid-test");
});
it("shows syntax errors as text and allows later blocks to be rendered", async () => {
  mocks.render.mockRejectedValueOnce(new Error("Invalid diagram"));
  const item = widget();
  const element = item.widget.toDOM({
    requestMeasure: vi.fn(),
  } as unknown as EditorView);
  document.body.append(element);
  await vi.advanceTimersByTimeAsync(500);
  expect(element.querySelector(".mermaid-error")?.textContent).toContain(
    "Invalid diagram",
  );
  expect(item.state.doc.toString()).toBe(source);
  item.widget.destroy(element);
});
it("cancels pending work on close and rerenders when the theme changes", async () => {
  const item = widget();
  const element = item.widget.toDOM({
    requestMeasure: vi.fn(),
  } as unknown as EditorView);
  item.widget.destroy(element);
  await vi.advanceTimersByTimeAsync(500);
  expect(mocks.render).not.toHaveBeenCalled();
  expect(item.widget.eq(widget().widget)).toBe(true);
  expect(item.widget.eq(widget(true).widget)).toBe(false);
});
