import { expect, it } from "vitest";
import { latestBackupSlot } from "./backups";

it("catches up yesterday before today's time and becomes due at the scheduled minute", () => {
  expect(latestBackupSlot(new Date(2026, 9, 17, 16, 59), "17:00")).toBe(
    "2026-10-16T17:00",
  );
  expect(latestBackupSlot(new Date(2026, 9, 17, 17, 0), "17:00")).toBe(
    "2026-10-17T17:00",
  );
  expect(latestBackupSlot(new Date(2026, 9, 17, 23, 59), "17:00")).toBe(
    "2026-10-17T17:00",
  );
});
it("handles year boundaries, skipped days, and configurable times", () => {
  expect(latestBackupSlot(new Date(2027, 0, 1, 8), "09:30")).toBe(
    "2026-12-31T09:30",
  );
  expect(latestBackupSlot(new Date(2027, 0, 5, 10), "09:30")).toBe(
    "2027-01-05T09:30",
  );
  expect(latestBackupSlot(new Date(2026, 2, 9, 1), "17:00")).toBe(
    "2026-03-08T17:00",
  );
});
it("rejects invalid schedule values", () => {
  for (const value of ["", "24:00", "17:60", "9:30"])
    expect(() => latestBackupSlot(new Date(), value)).toThrow();
});
