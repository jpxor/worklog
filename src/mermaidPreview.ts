import { Facet, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import { findMermaidBlocks } from "./mermaidBlocks";
import { renderMermaid } from "./mermaidRenderer";

export const mermaidDark = Facet.define<boolean, boolean>({
  combine: (values) => values[0] ?? false,
});
const cleanup = new WeakMap<HTMLElement, () => void>();
class MermaidWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly dark: boolean,
  ) {
    super();
  }
  eq(other: MermaidWidget) {
    return this.source === other.source && this.dark === other.dark;
  }
  toDOM(view: EditorView) {
    // CodeMirror measures the widget's border box. Vertical margins fall
    // outside it and make gutter positions and pointer hit testing drift.
    const host = document.createElement("div");
    host.className = "cm-mermaid-widget";
    host.contentEditable = "false";
    const figure = document.createElement("figure");
    figure.className = "cm-mermaid-preview";
    host.append(figure);
    const caption = document.createElement("figcaption");
    caption.textContent = "Mermaid";
    const message = document.createElement("div");
    message.className = "mermaid-message";
    message.textContent = this.source.trim()
      ? "Rendering diagram…"
      : "Add diagram source inside the mermaid block.";
    figure.append(caption, message);
    let stopped = false;
    let url = "";
    const measure = () => {
      if (!stopped && host.isConnected) view.requestMeasure();
    };
    const timer = setTimeout(() => {
      if (!this.source.trim()) return;
      renderMermaid(this.source, this.dark, () => !stopped)
        .then((svg) => {
          if (!svg || stopped) return;
          const image = document.createElement("img");
          image.alt = "Mermaid diagram";
          image.draggable = false;
          image.onload = measure;
          image.onerror = () => {
            if (!stopped) {
              message.textContent =
                "The diagram preview could not be displayed.";
              figure.append(message);
              measure();
            }
          };
          const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
          const box = parsed.documentElement
            .getAttribute("viewBox")
            ?.trim()
            .split(/[\s,]+/)
            .map(Number);
          if (
            box?.length === 4 &&
            box.slice(2).every((value) => Number.isFinite(value) && value > 0)
          ) {
            image.width = Math.ceil(box[2]);
            image.height = Math.ceil(box[3]);
          }
          url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
          image.src = url;
          message.remove();
          figure.append(image);
          measure();
        })
        .catch((error) => {
          if (stopped) return;
          message.className = "mermaid-message mermaid-error";
          message.textContent = `Check Mermaid syntax: ${error instanceof Error ? error.message : String(error)}`;
          measure();
        });
    }, 500);
    cleanup.set(host, () => {
      stopped = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    });
    return host;
  }
  destroy(dom: HTMLElement) {
    cleanup.get(dom)?.();
    cleanup.delete(dom);
  }
  ignoreEvent() {
    return true;
  }
}
function previews(
  state: import("@codemirror/state").EditorState,
): DecorationSet {
  return Decoration.set(
    findMermaidBlocks(state.doc.toString()).map((block) =>
      Decoration.widget({
        widget: new MermaidWidget(block.source, state.facet(mermaidDark)),
        block: true,
        side: 1,
      }).range(block.to),
    ),
  );
}
export const mermaidPreviews = StateField.define<DecorationSet>({
  create: previews,
  update: (value, transaction) =>
    transaction.docChanged ||
    transaction.startState.facet(mermaidDark) !==
      transaction.state.facet(mermaidDark)
      ? previews(transaction.state)
      : value,
  provide: (field) => EditorView.decorations.from(field),
});
