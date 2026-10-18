import { describe, it, expect } from "vitest";
import { searchNotes } from "./noteSearch";
describe("note content search", () => {
  it("finds literal text case-insensitively across notes with exact line positions", () => {
    const content = "# Notes\r\nİ start\r\nDiscuss [a+b] outcome";
    const results = searchNotes(
      [
        { path: "projects/p/notes/nested/a.md", content },
        { path: "projects/closed/notes/old.txt", content: "[A+B] old work" },
        { path: "projects/p/notes/image.png", content: "[a+b]", kind: "image" },
        { path: "projects/p/notes/pdf.pdf", content: "[a+b]", kind: "pdf" },
        { path: "projects/p/notes/unrelated.md", content: "Other work" },
      ],
      " [a+b] ",
    );
    expect(results).toHaveLength(2);
    const match = results.find((result) => result.path.endsWith("a.md"))!;
    expect(match.cursor).toBe(content.indexOf("[a+b]"));
    expect(match.line).toBe(3);
    expect(match.snippet).toBe("Discuss [a+b] outcome");
    expect(searchNotes([{ path: "a.md", content }], "  ")).toEqual([]);
  });
  it("returns bounded context around the first match in each note", () => {
    const results = searchNotes(
      [
        {
          path: "a.md",
          content: "x".repeat(500) + "needle" + "y".repeat(500) + "needle",
        },
      ],
      "needle",
    );
    expect(results).toHaveLength(1);
    expect(results[0].snippet.length).toBeLessThan(180);
    expect(results[0].cursor).toBe(500);
    expect(results[0].snippet.startsWith("…")).toBe(true);
  });
});
