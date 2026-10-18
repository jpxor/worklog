export interface MermaidBlock {
  from: number;
  to: number;
  source: string;
}
export function findMermaidBlocks(text: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  let fence: {
    char: string;
    length: number;
    mermaid: boolean;
    from: number;
    lines: string[];
  } | null = null;
  let offset = 0;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!fence) {
      if (marker)
        fence = {
          char: marker[1][0],
          length: marker[1].length,
          mermaid: marker[2].trim().toLowerCase() === "mermaid",
          from: offset,
          lines: [],
        };
    } else if (
      marker &&
      marker[1][0] === fence.char &&
      marker[1].length >= fence.length &&
      !marker[2].trim()
    ) {
      if (fence.mermaid)
        blocks.push({
          from: fence.from,
          to: offset + line.length,
          source: fence.lines.join("\n"),
        });
      fence = null;
    } else if (fence.mermaid) fence.lines.push(line);
    offset += raw.length + 1;
  }
  return blocks;
}
