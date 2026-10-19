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
  projectCodeId: "test",
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
      {
        ...a,
        id: "admin",
        projectId: "admin",
        projectCodeId: "test",
        minutes: 30,
      },
      { ...a, id: "extra", minutes: 15 },
      { ...a, id: "tomorrow", date: "2026-10-02", minutes: 200 },
      {
        ...a,
        id: "voided",
        projectId: "removed",
        projectCodeId: "test",
        minutes: 60,
      },
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
      projectCodes: [{ id: "test", label: "Test", archived: false }],
      projects: [
        {
          id: "p",
          name: "Closed project",
          closed: true,
          defaultProjectCodeId: "test",
        },
      ],
      records: [
        a,
        b,
        { ...a, id: "outside", date: "2026-10-02", minutes: 500 },
      ],
    };
    const md = report(data, "2026-10-01", "2026-10-01");
    expect(md).toContain("Test [1h 30m]");
    expect(md).toContain("Total: 1h 30m");
    expect(md).toContain(
      `2026-10-01 [1h 30m] Closed project\n    First | task\n    Follow-up`,
    );
    expect(md).not.toContain("| Date |");
    expect(md).not.toContain("<br>");
    expect(md).not.toContain("2026-10-02");
  });
  it("formats unpadded bracketed durations, including long durations", () => {
    const md = report(
      {
        ...emptySnapshot,
        projectCodes: [{ id: "test", label: "Test", archived: false }],
        projects: [
          { id: "p", name: "One", closed: false, defaultProjectCodeId: "test" },
          { id: "q", name: "Two", closed: false, defaultProjectCodeId: "test" },
        ],
        records: [
          { ...a, id: "short", minutes: 5, note: "Short" },
          {
            ...a,
            id: "long",
            projectId: "q",
            projectCodeId: "test",
            minutes: 595,
            note: "Long",
          },
          {
            ...a,
            id: "long-extra",
            projectId: "q",
            projectCodeId: "test",
            minutes: 10,
            note: "",
          },
          { ...a, id: "hour", minutes: 60, note: "Hour" },
        ],
      },
      "2026-10-01",
      "2026-10-01",
    );
    expect(md).toContain(
      `2026-10-01 [1h 05m] One\n    Hour\n    Short`,
    );
    expect(md).toContain("2026-10-01 [10h 05m] Two\n    Long");
  });
  it("validates dates and ranges", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2024-02-29")).toBe(true);
    expect(() => report(emptySnapshot, "2026-10-02", "2026-10-01")).toThrow();
  });
  it("omits empty note lines", () => {
    const md = report(
      {
        ...emptySnapshot,
        projectCodes: [{ id: "test", label: "Test", archived: false }],
        projects: [
          {
            id: "p",
            name: "Project",
            closed: false,
            defaultProjectCodeId: "test",
          },
        ],
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
      `2026-10-01 [1h 30m] Project\n    First\n    Second\n    Last\n`,
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
  it("reports the PORTAL and SUPPORT acceptance example by code and task", () => {
    const data = {
      ...emptySnapshot,
      projectCodes: [
        { id: "portal", label: "PORTAL", archived: false },
        { id: "support", label: "SUPPORT", archived: false },
      ],
      projects: [
        {
          id: "login",
          name: "Fix login timeout",
          closed: false,
          defaultProjectCodeId: "portal",
        },
        {
          id: "reset",
          name: "Password reset",
          closed: false,
          defaultProjectCodeId: "portal",
        },
      ],
      records: [
        {
          ...a,
          id: "1",
          projectId: "login",
          projectCodeId: "portal",
          minutes: 45,
          note: "Investigated",
        },
        {
          ...a,
          id: "2",
          projectId: "login",
          projectCodeId: "support",
          minutes: 30,
          note: "Customer help",
        },
        {
          ...a,
          id: "3",
          projectId: "reset",
          projectCodeId: "portal",
          minutes: 60,
          note: "",
        },
      ],
    };
    const original = JSON.stringify(data);
    const text = report(data, "2026-10-01", "2026-10-01");
    expect(text).toContain("## PORTAL [1h 45m]");
    expect(text).toContain("## SUPPORT [0h 30m]");
    expect(text).toMatch(
      /2026-10-01 \[0h 45m\] Fix login timeout\n    Investigated/,
    );
    expect(text).toMatch(/2026-10-01 \[1h 00m\] Password reset\n/);
    expect(text).toMatch(
      /2026-10-01 \[0h 30m\] Fix login timeout\n    Customer help/,
    );
    expect(text).toContain("Total: 2h 15m");
    expect(JSON.stringify(data)).toBe(original);
  });
  it("combines effective entries per project and day without changing the ledger", () => {
    const data = {
      ...emptySnapshot,
      projectCodes: [{ id: "test", label: "Test", archived: false }],
      projects: [
        { id: "p", name: "One", closed: false, defaultProjectCodeId: "test" },
        { id: "q", name: "Two", closed: true, defaultProjectCodeId: "test" },
      ],
      records: [
        { ...a, id: "a", minutes: 30, note: "Old description" },
        {
          ...a,
          id: "b",
          replaces: "a",
          minutes: 45,
          note: "Fixed report\nTested export",
        },
        { ...a, id: "c", minutes: 15, note: "" },
        { ...a, id: "d", minutes: 60, note: "Updated docs" },
        { ...a, id: "e", minutes: 10, note: "Removed" },
        { type: "void" as const, id: "void", target: "e" },
        {
          ...a,
          id: "f",
          projectId: "q",
          projectCodeId: "test",
          minutes: 20,
          note: "Other project",
        },
        { ...a, id: "g", date: "2026-10-02", minutes: 25, note: " \n\t" },
        { ...a, id: "h", date: "2026-10-02", minutes: 5, note: "" },
        {
          ...a,
          id: "outside",
          date: "2026-10-03",
          minutes: 500,
          note: "Outside",
        },
      ],
    };
    const original = JSON.stringify(data);
    const text = report(data, "2026-10-01", "2026-10-02");
    expect(text).toContain(
      `2026-10-01 [2h 00m] One\n    Fixed report\n    Tested export\n    Updated docs\n\n2026-10-01 [0h 20m] Two\n    Other project\n\n2026-10-02 [0h 30m] One\n`,
    );
    expect(text.match(/^2026-10-01 \[/gm)).toHaveLength(2);
    expect(text).toContain("2026-10-01 [0h 20m] Two\n    Other project");
    expect(text).toContain("Test [2h 50m]");
    expect(text).toContain("Total: 2h 50m");
    expect(text).not.toMatch(/Old description|Removed|Outside/);
    expect(JSON.stringify(data)).toBe(original);
  });
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
  it("groups by day with project subtotals, aligned notes and a single grand total", () => {
    const text = report(
      {
        ...emptySnapshot,
        projectCodes: [{ id: "test", label: "Test", archived: false }],
        projects: [
          { id: "p", name: "One", closed: false, defaultProjectCodeId: "test" },
          { id: "q", name: "Two", closed: true, defaultProjectCodeId: "test" },
        ],
        records: [
          { ...a, id: "one", minutes: 45 },
          {
            ...a,
            id: "two",
            projectId: "q",
            projectCodeId: "test",
            minutes: 30,
          },
          { ...a, id: "three", date: "2026-10-03", minutes: 90 },
          { ...a, id: "outside", date: "2026-10-04", minutes: 300 },
        ],
      },
      "2026-10-01",
      "2026-10-03",
      "day",
    );
    expect(text).toContain("## 2026-10-01 [1h 15m]\n\nTest [1h 15m]\n    One: First | task\n         Follow-up\n    Two: First | task\n         Follow-up");
    expect(text).toContain("## 2026-10-03 [1h 30m]");
    expect(text).not.toContain("Daily totals");
    expect(text.match(/Total:/g)).toHaveLength(1);
    expect(text).toContain("Total: 2h 45m");
    expect(text).not.toContain("2026-10-04");
  });
});

 it("groups a task across codes and days and retains unknown code time", () => {
  const data = {
    ...emptySnapshot,
    projects: [{ id: "p", name: "Task", closed: true, defaultProjectCodeId: "test" }],
    projectCodes: [{ id: "test", label: "Project A", archived: true }],
    records: [a, { ...a, id: "other", projectCodeId: "missing", date: "2026-10-02", minutes: 60, note: "" }],
  };
  const text = report(data, "2026-10-01", "2026-10-02", "task");
  expect(text).toContain("## Task [1h 45m]\n\n2026-10-01 [0h 45m] Project A\n    First | task\n    Follow-up\n\n2026-10-02 [1h 00m] missing\n");
  expect(text).not.toContain("Daily totals");
  expect(report(data, "2026-10-01", "2026-10-02")).toContain("## missing [1h 00m]");
  expect(report(emptySnapshot, "2026-10-01", "2026-10-02", "day")).toContain("Total: 0h 00m");
});
