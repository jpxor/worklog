import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { desktop } from "./api";

type Settings = { enabled: boolean; time: string; days: number[] };
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export default function ReminderSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (desktop)
      invoke<Settings>("reminder_settings", { settings: null })
        .then(setSettings)
        .catch((error) => setMessage(String(error)));
  }, []);
  async function permission() {
    if (
      !(await isPermissionGranted()) &&
      (await requestPermission()) !== "granted"
    )
      throw new Error(
        "Notifications are blocked. Allow WorkLog notifications in your system settings, then try again.",
      );
  }
  async function perform(test: boolean) {
    if (!settings) return;
    setBusy(true);
    setMessage("");
    try {
      if (test || settings.enabled) await permission();
      if (test) {
        await sendNotification({
          title: "Time to fill out your timesheet",
          body: "Open WorkLog to review your time and complete your timesheet.",
        });
        setMessage("Test notification sent. Check your system notifications.");
      } else {
        await invoke("reminder_settings", { settings });
        setMessage(
          settings.enabled
            ? "Timesheet reminder saved."
            : "Timesheet reminder turned off.",
        );
      }
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reminder-settings" aria-label="Timesheet reminders">
      <h3>Timesheet reminders</h3>
      <p className="muted small">
        Get a native notification to fill out your timesheet. Keep WorkLog open
        (minimized is fine). Times use your computer’s local timezone. If a
        reminder is missed, it is sent when WorkLog next runs that day.
      </p>
      {!desktop ? (
        <p className="muted small">Available in the desktop app.</p>
      ) : !settings ? (
        <p role="status">{message || "Loading reminder settings…"}</p>
      ) : (
        <>
          <fieldset disabled={busy}>
            <label className="reminder-option">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) =>
                  setSettings({ ...settings, enabled: event.target.checked })
                }
              />
              Enable timesheet reminder
            </label>
            <label>
              Reminder time
              <input
                type="time"
                required
                value={settings.time}
                onChange={(event) =>
                  setSettings({ ...settings, time: event.target.value })
                }
              />
            </label>
            <fieldset>
              <legend>Days of the week</legend>
              <div className="reminder-days">
                {weekdays.map((day, index) => (
                  <label className="reminder-option" key={day}>
                    <input
                      type="checkbox"
                      checked={settings.days.includes(index)}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          days: event.target.checked
                            ? [...settings.days, index]
                            : settings.days.filter((value) => value !== index),
                        })
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="settings-actions">
              <button
                disabled={
                  !settings.time ||
                  (settings.enabled && settings.days.length === 0)
                }
                onClick={() => perform(false)}
              >
                Save reminder settings
              </button>
              <button onClick={() => perform(true)}>Test notification</button>
            </div>
          </fieldset>
          {settings.enabled && settings.days.length === 0 && (
            <p role="alert">Choose at least one day.</p>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
    </section>
  );
}
