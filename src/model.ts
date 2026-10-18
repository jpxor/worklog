export interface Project {
  id: string;
  name: string;
  closed: boolean;
}
export interface Note {
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
export function report(data: Snapshot, from: string, through: string) {
  if (!validDate(from) || !validDate(through) || from > through)
    throw new Error("Choose a valid date range");
  const entries = effective(data.records)
    .filter((e) => e.date >= from && e.date <= through)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const hourWidth = entries.reduce(
    (width, e) => Math.max(width, String(Math.floor(e.minutes / 60)).length),
    1,
  );
  let out = `# Time report: ${from} – ${through}\n\nDates inclusive. Durations shown in hours and minutes.\n`;
  for (const p of [...data.projects].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const rows = entries.filter((e) => e.projectId === p.id);
    if (!rows.length) continue;
    out += `\n## ${p.name.replace(/[\r\n]/g, " ")} — ${formatTime(rows.reduce((n, e) => n + e.minutes, 0))}\n\n`;
    for (const e of rows) {
      const hours = String(Math.floor(e.minutes / 60)).padStart(hourWidth, " ");
      const minutes = String(e.minutes % 60).padStart(2, "0");
      const prefix = `${e.date} | ${hours}h ${minutes}m | `;
      const note = e.note
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.trim().length > 0)
        .join(`\n${" ".repeat(prefix.length)}`);
      out += `${prefix}${note}`.trimEnd() + "\n";
    }
  }
  out += "\n## Daily totals\n\n";
  // Include zero-entry days so gaps in a timesheet are visible.
  for (let date = from; date <= through;) {
    const rows = entries.filter((e) => e.date === date);
    out += `${date} — ${formatTime(rows.reduce((n, e) => n + e.minutes, 0))}\n`;
    for (const project of [...data.projects].sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const minutes = rows
        .filter((e) => e.projectId === project.id)
        .reduce((n, e) => n + e.minutes, 0);
      if (minutes)
        out += `  ${project.name.replace(/[\r\n]/g, " ")} — ${formatTime(minutes)}\n`;
    }
    if (date === through) break;
    const next = new Date(date + "T12:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    date = next.toISOString().slice(0, 10);
  }
  return `${out}\nTotal: ${formatTime(entries.reduce((n, e) => n + e.minutes, 0))}\n`;
}
