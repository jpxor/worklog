import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock("mermaid", () => ({
  default: { initialize: mocks.initialize, render: mocks.render },
}));
import { renderMermaid } from "./mermaidRenderer";
it("uses strict rendering and continues processing after a syntax error", async () => {
  mocks.render
    .mockRejectedValueOnce(new Error("Syntax error"))
    .mockResolvedValueOnce({ svg: "<svg/>" });
  await expect(renderMermaid("bad", false, () => true)).rejects.toThrow(
    "Syntax error",
  );
  await expect(
    renderMermaid("flowchart LR\nA-->B", true, () => true),
  ).resolves.toBe("<svg/>");
  expect(mocks.initialize).toHaveBeenLastCalledWith(
    expect.objectContaining({
      securityLevel: "strict",
      startOnLoad: false,
      theme: "dark",
      htmlLabels: false,
    }),
  );
});
it("skips diagrams that were removed before their render begins", async () => {
  const count = mocks.render.mock.calls.length;
  await expect(
    renderMermaid("flowchart LR\nA-->B", false, () => false),
  ).resolves.toBeNull();
  expect(mocks.render.mock.calls.length).toBe(count);
});
