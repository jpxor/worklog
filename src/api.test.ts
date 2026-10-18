import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: mocks.invoke,
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: mocks.save,
  open: vi.fn(),
  confirm: vi.fn(),
}));
import { exportFile } from "./api";
it("suggests a Markdown report filename containing both inclusive dates", async () => {
  mocks.save.mockResolvedValue("C:/reports/export.md");
  await exportFile("report content", "2026-10-01", "2026-10-17");
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({
      defaultPath: "worklog-report_2026-10-01_to_2026-10-17.md",
    }),
  );
  expect(mocks.invoke).toHaveBeenCalledWith("export_report", {
    path: "C:/reports/export.md",
    content: "report content",
  });
});
