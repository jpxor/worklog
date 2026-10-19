export interface Project {
  id: string;
  name: string;
  closed: boolean;
  defaultProjectCodeId: string;
}
export interface ProjectCode {
  id: string;
  label: string;
  archived: boolean;
}
export interface Note {
  scope?: "task" | "global";
  path: string;
  content: string;
  kind?: "image" | "pdf";
  revision?: string;
  modified?: number;
}
export interface Entry {
  type: "entry";
  id: string;
  projectId: string;
  projectCodeId: string;
  date: string;
  minutes: number;
  note: string;
  replaces?: string;
}
export interface Void {
  type: "void";
  id: string;
  target: string;
}
export type Record = Entry | Void;
export interface Snapshot {
  root: string;
  projects: Project[];
  projectCodes: ProjectCode[];
  notes: Note[];
  records: Record[];
  folders: string[];
  git: string;
  remote: string;
  backupPath: string;
  lastBackup: string;
  backupTime: string;
  backupSlot: string;
  backupError: string;
}
export const emptySnapshot: Snapshot = {
  root: "",
  projects: [],
  projectCodes: [],
  notes: [],
  records: [],
  folders: [],
  git: "",
  remote: "",
  backupPath: "",
  lastBackup: "",
  backupTime: "17:00",
  backupSlot: "",
  backupError: "",
};
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Monday–Sunday calendar dates; noon avoids DST midnight boundaries. */
export function weekRange(date: string): [string, string] {
  const value = new Date(date + "T12:00:00");
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  const calendar = () =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const from = calendar();
  value.setDate(value.getDate() + 6);
  return [from, calendar()];
}
export type ReportPreset = "today" | "yesterday" | "thisWeek" | "lastWeek";
export function reportRange(
  preset: ReportPreset,
  date = today(),
): [string, string] {
  if (preset === "today") return [date, date];
  if (preset === "thisWeek") return weekRange(date);
  const value = new Date(date + "T12:00:00");
  value.setDate(value.getDate() - (preset === "yesterday" ? 1 : 7));
  const previous = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return preset === "yesterday" ? [previous, previous] : weekRange(previous);
}
export function duration(text: string): number | null {
  const s = text.trim().toLowerCase();
  let value = 0;
  const clock = /^(\d+):([0-5]\d)$/.exec(s);
  if (clock) value = Number(clock[1]) * 60 + Number(clock[2]);
  else {
    const units = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/.exec(s);
    if (!units || (!units[1] && !units[2])) return null;
    value = Number(units[1] || 0) * 60 + Number(units[2] || 0);
  }
  const rounded = Math.round(value);
  return rounded > 0 &&
    Number.isSafeInteger(rounded) &&
    Math.abs(value - rounded) < 1e-8
    ? rounded
    : null;
}
export function formatTime(minutes: number) {
  return (
    `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h` : ""}${minutes % 60 ? `${minutes >= 60 ? " " : ""}${minutes % 60}m` : ""}` ||
    "0m"
  );
}
export function validDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}
export function effective(records: Record[]): Entry[] {
  const ids = new Set<string>();
  const active = new Map<string, Entry>();
  for (const r of records) {
    if (!r.id || ids.has(r.id))
      throw new Error("Duplicate or missing ledger ID");
    ids.add(r.id);
    if (r.type === "entry") {
      if (
        !r.projectId ||
        !r.projectCodeId ||
        !validDate(r.date) ||
        !Number.isSafeInteger(r.minutes) ||
        r.minutes <= 0 ||
        typeof r.note !== "string"
      )
        throw new Error("Invalid time entry");
      if (r.replaces && !active.delete(r.replaces))
        throw new Error("Correction references an inactive entry");
      active.set(r.id, r);
    } else if (r.type === "void") {
      if (!active.delete(r.target))
        throw new Error("Void references an inactive entry");
    } else throw new Error("Unknown ledger record");
  }
  return [...active.values()];
}
export function dailyTotals(
  records: Record[],
  date: string,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of effective(records)) {
    if (entry.date === date)
      totals.set(
        entry.projectId,
        (totals.get(entry.projectId) || 0) + entry.minutes,
      );
  }
  return totals;
}
export type ReportGrouping = "project" | "day" | "task";
export function report(
  data: Snapshot,
  from: string,
  through: string,
  grouping: ReportGrouping = "project",
) {
  if (!validDate(from) || !validDate(through) || from > through)
    throw new Error("Choose a valid date range");
  const entries = effective(data.records)
    .filter((e) => e.date >= from && e.date <= through)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const grouped = new Map<
    string,
    {
      projectId: string;
      projectCodeId: string;
      date: string;
      minutes: number;
      notes: string[];
    }
  >();
  for (const entry of entries) {
    const key = JSON.stringify([
      entry.projectCodeId,
      entry.projectId,
      entry.date,
    ]);
    let row = grouped.get(key);
    if (!row) {
      row = {
        projectCodeId: entry.projectCodeId,
        projectId: entry.projectId,
        date: entry.date,
        minutes: 0,
        notes: [],
      };
      grouped.set(key, row);
    }
    row.minutes += entry.minutes;
    row.notes.push(entry.note);
  }
  const dailyEntries = [...grouped.values()];
  const time = (minutes: number) =>
    `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  const total = (rows: typeof dailyEntries) =>
    time(rows.reduce((sum, row) => sum + row.minutes, 0));
  const singleLine = (value: string) => value.replace(/[\r\n]/g, " ");
  const taskName = (id: string) =>
    singleLine(data.projects.find((task) => task.id === id)?.name || id);
  const codeName = (id: string) =>
    singleLine(data.projectCodes.find((code) => code.id === id)?.label || id);
  const notes = (row: (typeof dailyEntries)[number]) =>
    row.notes
      .flatMap((note) => note.split(/\r?\n/))
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0);
  const codes = [...new Set(dailyEntries.map((row) => row.projectCodeId))].sort(
    (a, b) => codeName(a).localeCompare(codeName(b)) || a.localeCompare(b),
  );
  const tasks = [...new Set(dailyEntries.map((row) => row.projectId))].sort(
    (a, b) => taskName(a).localeCompare(taskName(b)) || a.localeCompare(b),
  );
  const dates = [...new Set(dailyEntries.map((row) => row.date))].sort();
  const blocks = [
    `# Time report — by ${grouping}\n${from} to ${through}\nTotal: ${total(dailyEntries)}`,
  ];
  if (grouping === "day") {
    for (const date of dates) {
      const dayRows = dailyEntries.filter((row) => row.date === date);
      blocks.push(`## ${date} [${total(dayRows)}]`);
      for (const code of codes) {
        const rows = dayRows
          .filter((row) => row.projectCodeId === code)
          .sort(
            (a, b) =>
              taskName(a.projectId).localeCompare(taskName(b.projectId)) ||
              a.projectId.localeCompare(b.projectId),
          );
        if (!rows.length) continue;
        const lines = [`${codeName(code)} [${total(rows)}]`];
        for (const row of rows) {
          const name = taskName(row.projectId);
          const text = notes(row);
          lines.push(`    ${name}${text.length ? ": " + text[0] : ""}`);
          for (const line of text.slice(1))
            lines.push(" ".repeat(4 + name.length + 2) + line);
        }
        blocks.push(lines.join("\n"));
      }
    }
  } else {
    for (const id of grouping === "project" ? codes : tasks) {
      const rows = dailyEntries
        .filter(
          (row) =>
            (grouping === "project" ? row.projectCodeId : row.projectId) === id,
        )
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            (grouping === "project"
              ? taskName(a.projectId).localeCompare(taskName(b.projectId))
              : codeName(a.projectCodeId).localeCompare(
                  codeName(b.projectCodeId),
                )) ||
            a.projectId.localeCompare(b.projectId) ||
            a.projectCodeId.localeCompare(b.projectCodeId),
        );
      blocks.push(
        `## ${grouping === "project" ? codeName(id) : taskName(id)} [${total(rows)}]`,
      );
      for (const row of rows) {
        const name =
          grouping === "project"
            ? taskName(row.projectId)
            : codeName(row.projectCodeId);
        blocks.push(
          [
            `${row.date} [${time(row.minutes)}] ${name}`,
            ...notes(row).map((line) => `    ${line}`),
          ].join("\n"),
        );
      }
    }
  }
  return blocks.join("\n\n") + "\n";
}
