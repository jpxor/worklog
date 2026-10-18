import { describe, expect, it } from "vitest";
import {
  dailyTotals,
  weekRange,
  duration,
  effective,
  emptySnapshot,
  formatTime,
  report,
  reportRange,
  validDate,
  type Entry,
} from "./model";

describe("duration input", () => {
  it.each([
    ["45m", 45],
    ["2h", 120],
    ["1h 30m", 90],
    ["1.5h", 90],
    ["1:30", 90],
    ["0.1h", 6],
    [" 2H ", 120],
  ])("accepts %s", (input, value) =>
    expect(duration(input as string)).toBe(value),
  );
  it.each(["2", "0m", "-1h", "1:60", "0.001h", "1h banana", "", "1.5m"])(
    "rejects %s",
    (input) => expect(duration(input)).toBeNull(),
  );
});
const a: Entry = {
  type: "entry",
  id: "a",
  projectId: "p",
  date: "2026-10-01",
  minutes: 45,
  note: "First | task\nFollow-up",
};
const b: Entry = { ...a, id: "b", minutes: 90, replaces: "a" };
describe("ledger and report", () => {
  it("groups today's effective time by project, excluding voided and other-day entries", () => {
    const records = [
      a,
      b,
      { ...a, id: "admin", projectId: "admin", minutes: 30 },
      { ...a, id: "extra", minutes: 15 },
      { ...a, id: "tomorrow", date: "2026-10-02", minutes: 200 },
      { ...a, id: "voided", projectId: "removed", minutes: 60 },
      { type: "void" as const, id: "void-record", target: "voided" },
    ];
    expect([...dailyTotals(records, "2026-10-01")]).toEqual([
      ["p", 105],
      ["admin", 30],
    ]);
    expect([...dailyTotals(records, "2026-10-03")]).toEqual([]);
  });
  it("counts only effective entries and preserves corrections", () => {
    expect(effective([a, b])).toEqual([b]);
    expect(effective([a, b, { type: "void", id: "c", target: "b" }])).toEqual(
      [],
    );
    expect(() => effective([a, b, { ...b, id: "d" }])).toThrow();
    expect(() => effective([a, a])).toThrow();
  });
  it("filters inclusive dates and exports plain entries under project headings", () => {
    const data = {
      ...emptySnapshot,
      projects: [{ id: "p", name: "Closed project", closed: true }],
      records: [
        a,
        b,
        { ...a, id: "outside", date: "2026-10-02", minutes: 500 },
      ],
    };
    const md = report(data, "2026-10-01", "2026-10-01");
    expect(md).toContain("Closed project — 1h 30m");
    expect(md).toContain("Total: 1h 30m");
    expect(md).toContain(
      `2026-10-01 | 1h 30m | First | task\n${" ".repeat(22)}Follow-up`,
    );
    expect(md).not.toContain("| Date |");
    expect(md).not.toContain("<br>");
    expect(md).not.toContain("2026-10-02");
  });
  it("aligns duration and note columns across projects, including long durations", () => {
    const md = report(
      {
        ...emptySnapshot,
        projects: [
          { id: "p", name: "One", closed: false },
          { id: "q", name: "Two", closed: false },
        ],
        records: [
          { ...a, id: "short", minutes: 5, note: "Short" },
          { ...a, id: "long", projectId: "q", minutes: 605, note: "Long" },
          { ...a, id: "hour", minutes: 60, note: "Hour" },
        ],
      },
      "2026-10-01",
      "2026-10-01",
    );
    expect(md).toContain("2026-10-01 |  0h 05m | Short");
    expect(md).toContain("2026-10-01 | 10h 05m | Long");
    expect(md).toContain("2026-10-01 |  1h 00m | Hour");
  });
  it("validates dates and ranges", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2024-02-29")).toBe(true);
    expect(() => report(emptySnapshot, "2026-10-02", "2026-10-01")).toThrow();
  });
  it("omits blank and whitespace-only lines between and within report entries", () => {
    const md = report(
      {
        ...emptySnapshot,
        projects: [{ id: "p", name: "Project", closed: false }],
        records: [
          {
            ...a,
            id: "1",
            minutes: 60,
            note: "\n  \r\nFirst  \n\t\nSecond\n   ",
          },
          { ...a, id: "2", minutes: 10, note: " \n\t" },
          { ...a, id: "3", minutes: 20, note: "Last" },
        ],
      },
      "2026-10-01",
      "2026-10-01",
    );
    expect(md).toContain(
      `2026-10-01 | 1h 00m | First\n${" ".repeat(22)}Second\n2026-10-01 | 0h 10m |\n2026-10-01 | 0h 20m | Last\n`,
    );
    expect(
      md
        .split("\n")
        .some((line) => line.length > 0 && line.trim().length === 0),
    ).toBe(false);
  });
  it("formats totals", () => {
    expect(formatTime(0)).toBe("0m");
    expect(formatTime(60)).toBe("1h");
    expect(formatTime(135)).toBe("2h 15m");
  });
});

describe("calendar weeks", () => {
  it("handles Sunday and year boundaries", () => {
    expect(weekRange("2026-10-18")).toEqual(["2026-10-12", "2026-10-18"]);
    expect(weekRange("2027-01-01")).toEqual(["2026-12-28", "2027-01-03"]);
  });
});

describe("timesheet reports", () => {
  it("offers calendar presets across month and year boundaries", () => {
    expect(reportRange("today", "2027-01-01")).toEqual([
      "2027-01-01",
      "2027-01-01",
    ]);
    expect(reportRange("yesterday", "2027-01-01")).toEqual([
      "2026-12-31",
      "2026-12-31",
    ]);
    expect(reportRange("thisWeek", "2027-01-01")).toEqual([
      "2026-12-28",
      "2027-01-03",
    ]);
    expect(reportRange("lastWeek", "2027-01-01")).toEqual([
      "2026-12-21",
      "2026-12-27",
    ]);
    expect(reportRange("yesterday", "2024-03-01")).toEqual([
      "2024-02-29",
      "2024-02-29",
    ]);
  });
  it("includes daily project subtotals, empty days and a nonduplicated grand total", () => {
    const text = report(
      {
        ...emptySnapshot,
        projects: [
          { id: "p", name: "One", closed: false },
          { id: "q", name: "Two", closed: true },
        ],
        records: [
          { ...a, id: "one", minutes: 45 },
          { ...a, id: "two", projectId: "q", minutes: 30 },
          { ...a, id: "three", date: "2026-10-03", minutes: 90 },
          { ...a, id: "outside", date: "2026-10-04", minutes: 300 },
        ],
      },
      "2026-10-01",
      "2026-10-03",
    );
    expect(text).toContain(
      "## Daily totals\n\n2026-10-01 — 1h 15m\n  One — 45m\n  Two — 30m\n2026-10-02 — 0m\n2026-10-03 — 1h 30m\n  One — 1h 30m",
    );
    expect(text).toContain("Total: 2h 45m");
    expect(text).not.toContain("2026-10-04");
  });
});
