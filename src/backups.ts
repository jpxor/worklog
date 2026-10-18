// Most recent scheduled backup in the user's local timezone, including yesterday
// before today's scheduled time. Calendar arithmetic handles DST transitions.
export function latestBackupSlot(now: Date, time: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Invalid backup time");
  const [hours, minutes] = time.split(":").map(Number);
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);
  if (scheduled > now) scheduled.setDate(scheduled.getDate() - 1);
  return `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, "0")}-${String(scheduled.getDate()).padStart(2, "0")}T${time}`;
}
