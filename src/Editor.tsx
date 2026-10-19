import { useEffect, useRef } from "react";
import {
  EditorView,
  Decoration,
  BlockWrapper,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
  keymap,
} from "@codemirror/view";
import {
  Compartment,
  EditorState,
  EditorSelection,
  Prec,
  type RangeSet,
} from "@codemirror/state";
import { openSearchPanel } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import {
  syntaxTree,
  HighlightStyle,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { mermaidDark, mermaidPreviews } from "./mermaidPreview";

function blockLineBoundary(view: EditorView, end: boolean, extend = false) {
  const selection = view.state.selection.main;
  const { node } = view.domAtPos(selection.head);
  const element = node instanceof HTMLElement ? node : node.parentElement;
  if (!element?.closest(".cm-scroll-block")) return false;
  const line = view.state.doc.lineAt(selection.head);
  const target = end ? line.to : line.from;
  view.dispatch({
    selection: EditorSelection.range(
      extend ? selection.anchor : target,
      target,
    ),
    scrollIntoView: true,
    userEvent: "select",
  });
  return true;
}

// Line decorations let prose wrap while fenced content keeps its original columns.
const fences = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    wrappers: RangeSet<BlockWrapper> = BlockWrapper.set([]);
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      )
        this.decorations = this.build(update.view);
    }
    build(view: EditorView) {
      const ranges = [];
      const quoted = new Set<number>();
      syntaxTree(view.state).iterate({
        enter(node) {
          if (node.name === "Blockquote") {
            const first = view.state.doc.lineAt(node.from).number;
            const last = view.state.doc.lineAt(
              Math.max(node.from, node.to - 1),
            ).number;
            for (let n = first; n <= last; n++) quoted.add(n);
          }
        },
      });
      let fence: { char: string; length: number } | null = null;
      const groups: {
        kind: string;
        from: number;
        to: number;
        lastLine: number;
      }[] = [];
      for (let n = 1; n <= view.state.doc.lines; n++) {
        const line = view.state.doc.line(n);
        const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.text);
        const inside = !!fence;
        if (match) {
          if (!fence) fence = { char: match[1][0], length: match[1].length };
          else if (
            match[1][0] === fence.char &&
            match[1].length >= fence.length &&
            !match[2].trim()
          )
            fence = null;
        }
        const kind =
          inside || match
            ? "code"
            : quoted.has(n) || /^ {0,3}>/.test(line.text)
              ? "quote"
              : null;
        if (kind) {
          const previous = groups.at(-1);
          if (
            previous?.kind === kind &&
            previous.lastLine === n - 1 &&
            !(match && !inside)
          ) {
            previous.to = line.to;
            previous.lastLine = n;
          } else
            groups.push({ kind, from: line.from, to: line.to, lastLine: n });
        }
        if (kind === "code")
          ranges.push(
            Decoration.line({ class: "cm-code-line" }).range(line.from),
          );
        else if (kind === "quote")
          ranges.push(
            Decoration.line({ class: "cm-quote-line" }).range(line.from),
          );
      }
      this.wrappers = BlockWrapper.set(
        groups.map((group) =>
          BlockWrapper.create({
            tagName: "div",
            attributes: { class: `cm-scroll-block cm-scroll-${group.kind}` },
          }).range(group.from, group.to),
        ),
      );
      return Decoration.set(ranges);
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.blockWrappers.of(
        (view) => view.plugin(plugin)?.wrappers ?? BlockWrapper.set([]),
      ),
  },
);

export interface EditorPosition {
  anchor: number;
  head: number;
  top: number;
  left: number;
}

export default function Editor({
  content,
  onChange,
  onCursor,
  cursor = 0,
  position,
  onPosition,
  dark = false,
  plain = false,
}: {
  content: string;
  onChange: (text: string) => void;
  onCursor: (pos: number) => void;
  cursor?: number;
  position?: EditorPosition;
  onPosition?: (position: EditorPosition) => void;
  dark?: boolean;
  plain?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const colorTheme = useRef(new Compartment());
  const callback = useRef(onChange);
  callback.current = onChange;
  const cursorCallback = useRef(onCursor);
  cursorCallback.current = onCursor;
  const positionCallback = useRef(onPosition);
  positionCallback.current = onPosition;
  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: content,
        selection: {
          anchor: Math.max(
            0,
            Math.min(position?.anchor ?? cursor, content.length),
          ),
          head: Math.max(0, Math.min(position?.head ?? cursor, content.length)),
        },
        extensions: [
          basicSetup,
          Prec.highest(
            syntaxHighlighting(
              HighlightStyle.define([
                {
                  tag: tags.heading,
                  color: "inherit",
                  fontWeight: "bold",
                  textDecoration: "none",
                },
                { tag: tags.processingInstruction, color: "inherit" },
              ]),
            ),
          ),
          // App bindings own Find, including when its default is changed or cleared.
          Prec.highest(
            keymap.of([
              { key: "Mod-f", run: () => true },
              {
                key: "Home",
                run: (view) => blockLineBoundary(view, false),
                shift: (view) => blockLineBoundary(view, false, true),
              },
              {
                key: "End",
                run: (view) => blockLineBoundary(view, true),
                shift: (view) => blockLineBoundary(view, true, true),
              },
            ]),
          ),
          plain ? [] : markdown(),
          EditorView.lineWrapping,
          plain ? [] : fences,
          plain
            ? []
            : EditorView.scrollHandler.of((view, range) => {
                const { node } = view.domAtPos(range.head);
                const element =
                  node instanceof HTMLElement ? node : node.parentElement;
                const block = element?.closest<HTMLElement>(".cm-scroll-block");
                const cursor = view.coordsAtPos(range.head);
                if (block && cursor) {
                  const bounds = block.getBoundingClientRect();
                  if (cursor.left < bounds.left + 12)
                    block.scrollLeft -= bounds.left + 12 - cursor.left;
                  else if (cursor.right > bounds.right - 12)
                    block.scrollLeft += cursor.right - bounds.right + 12;
                }
                // Let CodeMirror handle vertical scrolling with the corrected
                // cursor coordinates after scrolling the inner block.
                return false;
              }),
          plain ? [] : mermaidPreviews,
          colorTheme.current.of([
            dark ? oneDark : syntaxHighlighting(defaultHighlightStyle),
            mermaidDark.of(dark),
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) callback.current(u.state.doc.toString());
            if (u.selectionSet) {
              cursorCallback.current(u.state.selection.main.head);
              positionCallback.current?.({
                anchor: u.state.selection.main.anchor,
                head: u.state.selection.main.head,
                top: u.view.scrollDOM.scrollTop,
                left: u.view.scrollDOM.scrollLeft,
              });
            }
            if (!plain && (u.selectionSet || u.docChanged))
              u.view.requestMeasure({
                key: "scroll-block-caret",
                read: (view) => {
                  const { node } = view.domAtPos(
                    view.state.selection.main.head,
                  );
                  const element =
                    node instanceof HTMLElement ? node : node.parentElement;
                  const block =
                    element?.closest<HTMLElement>(".cm-scroll-block");
                  const cursor = view.coordsAtPos(
                    view.state.selection.main.head,
                  );
                  if (!block || !cursor) return null;
                  const bounds = block.getBoundingClientRect();
                  const delta =
                    cursor.left < bounds.left + 12
                      ? cursor.left - bounds.left - 12
                      : cursor.right > bounds.right - 12
                        ? cursor.right - bounds.right + 12
                        : 0;
                  return { block, delta };
                },
                write: (result, view) => {
                  if (result) {
                    result.block.scrollLeft += result.delta;
                    view.scrollDOM.scrollLeft = 0;
                  }
                },
              });
          }),
          EditorView.theme({
            "&": { height: "100%", fontSize: "14px" },
            ".cm-scroller": {
              fontFamily: 'Inter, "Segoe UI", sans-serif',
              lineHeight: "1.9",
            },
            ".cm-content": {
              padding: "28px 32px",
              // Fill the editor width, but let block content determine height.
              // Vertical stretch hides asynchronous Mermaid height changes
              // from CodeMirror's layout measurement in short notes.
              flexGrow: "1",
              flexBasis: "0",
              minWidth: "0",
              alignSelf: "flex-start",
              minHeight: "0",
            },
            ".cm-gutters": {
              fontFamily: '"Cascadia Code", Consolas, monospace',
              backgroundColor: "transparent",
              border: "none",
              color: "#b9b9b0",
            },
            "&.cm-focused": { outline: "none" },
          }),
        ],
      }),
    });
    editor.current = view;
    const find = () => {
      openSearchPanel(view);
    };
    const insertMermaid = () => {
      if (plain) return;
      const end = view.state.doc.length;
      const tail = view.state.doc.sliceString(Math.max(0, end - 2), end);
      const separator =
        !end || tail.endsWith("\n\n")
          ? ""
          : tail.endsWith("\n")
            ? "\n"
            : "\n\n";
      const opening = separator + "```mermaid\n";
      const source = "flowchart LR\n    A --> B";
      view.dispatch({
        changes: { from: end, insert: opening + source + "\n```\n" },
        selection: {
          anchor: end + opening.length,
          head: end + opening.length + source.length,
        },
        scrollIntoView: true,
      });
      view.focus();
    };
    window.addEventListener("worknotes:find", find);
    window.addEventListener("worknotes:insert-mermaid", insertMermaid);
    view.focus();
    if (!position && cursor)
      view.dispatch({
        effects: EditorView.scrollIntoView(Math.min(cursor, content.length), {
          y: "center",
        }),
      });
    const capture = () =>
      positionCallback.current?.({
        anchor: view.state.selection.main.anchor,
        head: view.state.selection.main.head,
        top: view.scrollDOM.scrollTop,
        left: view.scrollDOM.scrollLeft,
      });
    view.scrollDOM.addEventListener("scroll", capture);
    if (position)
      view.requestMeasure({
        read: () => null,
        write: () => {
          view.scrollDOM.scrollTop = Math.max(0, position.top);
          view.scrollDOM.scrollLeft = Math.max(0, position.left);
        },
      });
    return () => {
      view.scrollDOM.removeEventListener("scroll", capture);
      view.destroy();
      window.removeEventListener("worknotes:find", find);
      window.removeEventListener("worknotes:insert-mermaid", insertMermaid);
      editor.current = null;
    };
    // Parent keys the editor by note path; edits are owned by this editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    editor.current?.dispatch({
      effects: colorTheme.current.reconfigure([
        dark ? oneDark : syntaxHighlighting(defaultHighlightStyle),
        mermaidDark.of(dark),
      ]),
    });
  }, [dark]);
  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    const position = Math.max(0, Math.min(cursor, view.state.doc.length));
    if (view.state.selection.main.head !== position) {
      view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
      view.focus();
    }
  }, [cursor]);
  return <div className="editor" ref={host} />;
}
