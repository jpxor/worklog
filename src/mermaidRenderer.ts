let sequence = 0;
let queue: Promise<unknown> = Promise.resolve();
export function renderMermaid(
  source: string,
  dark: boolean,
  active: () => boolean,
): Promise<string | null> {
  const job = queue
    .catch(() => {})
    .then(async () => {
      if (!active()) return null;
      const { default: mermaid } = await import("mermaid");
      if (!active()) return null;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: dark ? "dark" : "neutral",
        fontFamily: '"Segoe UI", Arial, sans-serif',
        htmlLabels: false,
        flowchart: { htmlLabels: false },
        maxTextSize: 50_000,
        maxEdges: 500,
        secure: [
          "secure",
          "securityLevel",
          "startOnLoad",
          "maxTextSize",
          "maxEdges",
          "suppressErrorRendering",
          "htmlLabels",
          "flowchart",
          "dompurifyConfig",
        ],
      });
      const { svg } = await mermaid.render(
        `worknotes-mermaid-${++sequence}`,
        source,
      );
      return active() ? svg : null;
    });
  queue = job;
  return job;
}
