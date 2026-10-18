import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { Note } from "./model";
import { readDocument } from "./api";

type PdfModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDocument = import("pdfjs-dist").PDFDocumentProxy;
const imageTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

async function pdfLibrary(): Promise<PdfModule> {
  const pdf = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdf.GlobalWorkerOptions.workerSrc = new URL(
    "../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
  return pdf;
}

export default function DocumentViewer({
  root,
  note,
}: {
  root: string;
  note: Note;
}) {
  const [url, setUrl] = useState("");
  const [imageWidth, setImageWidth] = useState(0);
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [passwordNeeded, setPasswordNeeded] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const passwordReply = useRef<((password: string) => void) | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const host = viewport.current!;
    const observer = new ResizeObserver(() => setWidth(host.clientWidth));
    observer.observe(host);
    setWidth(host.clientWidth);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let stopped = false;
    let objectUrl = "";
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    setError("");
    setLoading(true);
    setPage(1);
    setZoom(null);
    setPdf(null);
    setUrl("");
    (async () => {
      const bytes = await readDocument(root, note.path);
      if (stopped) return;
      if (note.kind === "image") {
        const extension = note.path.split(".").at(-1)!.toLowerCase();
        objectUrl = URL.createObjectURL(
          new Blob([bytes as BlobPart], { type: imageTypes[extension] }),
        );
        setUrl(objectUrl);
      } else {
        const library = await pdfLibrary();
        if (stopped) return;
        const base = new URL("pdfjs/", document.baseURI).href;
        task = library.getDocument({
          data: bytes,
          cMapUrl: base + "cmaps/",
          cMapPacked: true,
          standardFontDataUrl: base + "standard_fonts/",
          wasmUrl: base + "wasm/",
          iccUrl: base + "iccs/",
          enableXfa: false,
        });
        task.onPassword = (
          reply: (password: string) => void,
          reason: number,
        ) => {
          if (stopped) return;
          passwordReply.current = reply;
          setPassword("");
          setPasswordNeeded(true);
          setPasswordMessage(
            reason === library.PasswordResponses.INCORRECT_PASSWORD
              ? "Incorrect password. Try again."
              : "This PDF requires a password.",
          );
          setLoading(false);
        };
        const loaded = await task.promise;
        if (stopped) {
          await task.destroy();
          return;
        }
        passwordReply.current = null;
        setPasswordNeeded(false);
        setPdf(loaded);
      }
    })()
      .catch((error) => {
        if (!stopped) setError(`Unable to open file: ${String(error)}`);
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
      passwordReply.current = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (task) void task.destroy().catch(() => {});
    };
  }, [root, note.path, note.revision, note.kind]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let stopped = false;
    let renderTask: import("pdfjs-dist").RenderTask | undefined;
    setRendering(true);
    setError("");
    (async () => {
      const documentPage = await pdf.getPage(page);
      if (stopped || !canvas.current) return;
      const natural = documentPage.getViewport({ scale: 1 });
      const scale =
        zoom ?? Math.min(2, Math.max(0.1, (width - 48) / natural.width));
      const size = documentPage.getViewport({ scale });
      // Keep canvas memory bounded for large pages and high-DPI displays.
      const density = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(16_000_000 / (size.width * size.height)),
      );
      const element = canvas.current;
      element.width = Math.max(1, Math.floor(size.width * density));
      element.height = Math.max(1, Math.floor(size.height * density));
      element.style.width = `${size.width}px`;
      element.style.height = `${size.height}px`;
      const context = element.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      renderTask = documentPage.render({
        canvas: element,
        canvasContext: context,
        viewport: size,
        transform: [density, 0, 0, density, 0, 0],
      });
      await renderTask.promise;
    })()
      .catch((error) => {
        if (!stopped && error?.name !== "RenderingCancelledException")
          setError(`Unable to render PDF: ${String(error)}`);
      })
      .finally(() => {
        if (!stopped) setRendering(false);
      });
    return () => {
      stopped = true;
      renderTask?.cancel();
    };
  }, [pdf, page, zoom, width]);
  const changeZoom = (amount: number) =>
    setZoom((current) =>
      Math.min(
        4,
        Math.max(0.25, Math.round(((current ?? 1) + amount) * 100) / 100),
      ),
    );
  return (
    <section
      className="document-viewer"
      aria-label={note.kind === "pdf" ? "PDF viewer" : "Image viewer"}
    >
      <div className="document-toolbar">
        {note.kind === "pdf" && (
          <>
            <button
              title="Previous page"
              aria-label="Previous page"
              disabled={!pdf || page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <label>
              Page{" "}
              <input
                aria-label="Page number"
                type="number"
                min="1"
                max={pdf?.numPages || 1}
                value={page}
                disabled={!pdf}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (
                    Number.isInteger(next) &&
                    next >= 1 &&
                    next <= pdf!.numPages
                  )
                    setPage(next);
                }}
              />
            </label>
            <span>of {pdf?.numPages || "—"}</span>
            <button
              title="Next page"
              aria-label="Next page"
              disabled={!pdf || page >= pdf.numPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
        <button
          title="Zoom out"
          aria-label="Zoom out"
          disabled={loading || !!error}
          onClick={() => changeZoom(-0.25)}
        >
          <Minus size={15} />
        </button>
        <span>{zoom === null ? "Fit" : `${Math.round(zoom * 100)}%`}</span>
        <button
          title="Zoom in"
          aria-label="Zoom in"
          disabled={loading || !!error}
          onClick={() => changeZoom(0.25)}
        >
          <Plus size={15} />
        </button>
        <button onClick={() => setZoom(null)}>Fit</button>
        <span className="document-readonly">Read-only</span>
      </div>
      <div ref={viewport} className="document-viewport">
        {loading && <p role="status">Opening file…</p>}
        {error && (
          <p role="alert" className="document-error">
            {error}
          </p>
        )}
        {passwordNeeded && (
          <form
            className="pdf-password"
            onSubmit={(event) => {
              event.preventDefault();
              setLoading(true);
              passwordReply.current?.(password);
              setPassword("");
            }}
          >
            <p>{passwordMessage}</p>
            <label>
              PDF password
              <input
                autoFocus
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button disabled={!password}>Open PDF</button>
          </form>
        )}
        {note.kind === "image" && url && !error && (
          <img
            src={url}
            alt={note.path.split("/").at(-1)}
            draggable={false}
            onLoad={(event) => setImageWidth(event.currentTarget.naturalWidth)}
            style={
              zoom === null
                ? { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }
                : {
                    maxWidth: "none",
                    maxHeight: "none",
                    width: imageWidth ? `${imageWidth * zoom}px` : undefined,
                  }
            }
            onError={() =>
              setError(
                "This image could not be decoded. It may be damaged or unsupported.",
              )
            }
          />
        )}
        {note.kind === "pdf" && pdf && (
          <>
            <canvas
              ref={canvas}
              aria-label={`PDF page ${page} of ${pdf.numPages}`}
              role="img"
            />
            {rendering && (
              <span className="document-rendering" role="status">
                Rendering page…
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}
