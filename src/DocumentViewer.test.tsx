// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  getDocument: vi.fn(),
  destroy: vi.fn(),
  render: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("./api", () => ({ readDocument: mocks.read }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: mocks.getDocument,
  PasswordResponses: { INCORRECT_PASSWORD: 2 },
}));
import DocumentViewer from "./DocumentViewer";
beforeEach(() => {
  mocks.read.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]));
  mocks.destroy.mockReset().mockResolvedValue(undefined);
  mocks.render
    .mockReset()
    .mockReturnValue({ promise: Promise.resolve(), cancel: mocks.cancel });
  mocks.getDocument.mockReset().mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn().mockImplementation(async () => ({
        getViewport: ({ scale }: { scale: number }) => ({
          width: 200 * scale,
          height: 300 * scale,
        }),
        render: mocks.render,
      })),
    }),
    destroy: mocks.destroy,
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  URL.createObjectURL = vi.fn(() => "blob:viewer-test");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("opens images read-only, supports zoom, and releases the object URL", async () => {
  const view = render(
    <DocumentViewer
      root="workspace"
      note={{ path: "projects/p/notes/photo.png", content: "", kind: "image" }}
    />,
  );
  const image = await screen.findByRole("img", { name: "photo.png" });
  expect(mocks.read).toHaveBeenCalledWith(
    "workspace",
    "projects/p/notes/photo.png",
  );
  expect(screen.getByText("Read-only")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(screen.getByText("125%")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Fit" }));
  expect(image.getAttribute("src")).toBe("blob:viewer-test");
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:viewer-test");
});
it("renders PDF pages, navigates, and destroys the loading task on close", async () => {
  const view = render(
    <DocumentViewer
      root="workspace"
      note={{ path: "projects/p/notes/file.pdf", content: "", kind: "pdf" }}
    />,
  );
  await screen.findByRole("img", { name: "PDF page 1 of 2" });
  await waitFor(() => expect(mocks.render).toHaveBeenCalled());
  expect(
    (screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByRole("img", { name: "PDF page 2 of 2" });
  expect(
    (screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  view.unmount();
  expect(mocks.destroy).toHaveBeenCalled();
});
it("prompts for PDF passwords, allows retry, and clears the password after opening", async () => {
  const proxy = await mocks.getDocument().promise;
  let resolve!: (value: unknown) => void;
  const task = {
    promise: new Promise((done) => {
      resolve = done;
    }),
    destroy: mocks.destroy,
    onPassword: undefined as
      undefined | ((reply: (password: string) => void, reason: number) => void),
  };
  mocks.getDocument.mockReturnValue(task);
  render(
    <DocumentViewer
      root="workspace"
      note={{ path: "projects/p/notes/locked.pdf", content: "", kind: "pdf" }}
    />,
  );
  await waitFor(() => expect(task.onPassword).toBeTypeOf("function"));
  const reply = vi.fn((password: string) => {
    if (password === "correct") resolve(proxy);
    else task.onPassword!(reply, 2);
  });
  act(() => task.onPassword!(reply, 1));
  fireEvent.change(screen.getByLabelText("PDF password"), {
    target: { value: "wrong" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open PDF" }));
  expect(screen.getByText("Incorrect password. Try again.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("PDF password"), {
    target: { value: "correct" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open PDF" }));
  await screen.findByRole("img", { name: "PDF page 1 of 2" });
  expect(screen.queryByLabelText("PDF password")).toBeNull();
});
it("reports read and decode failures without exposing an editor", async () => {
  mocks.read.mockRejectedValueOnce(new Error("File no longer exists"));
  const view = render(
    <DocumentViewer
      root="workspace"
      note={{ path: "projects/p/notes/missing.pdf", content: "", kind: "pdf" }}
    />,
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "File no longer exists",
  );
  view.unmount();
  render(
    <DocumentViewer
      root="workspace"
      note={{ path: "projects/p/notes/broken.png", content: "", kind: "image" }}
    />,
  );
  fireEvent.error(await screen.findByRole("img", { name: "broken.png" }));
  expect(screen.getByRole("alert").textContent).toContain(
    "could not be decoded",
  );
  expect(screen.queryByRole("textbox")).toBeNull();
});
