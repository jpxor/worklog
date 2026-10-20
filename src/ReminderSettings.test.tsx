// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  granted: vi.fn(),
  request: vi.fn(),
  send: vi.fn(),
}));
vi.mock("./api", () => ({ desktop: true }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: mocks.granted,
  requestPermission: mocks.request,
  sendNotification: mocks.send,
}));
import ReminderSettings from "./ReminderSettings";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.invoke.mockResolvedValue({
    enabled: false,
    time: "16:00",
    days: [0, 1, 2, 3, 4],
  });
  mocks.granted.mockResolvedValue(true);
});
afterEach(cleanup);
it("saves the chosen local time and weekdays", async () => {
  render(<ReminderSettings />);
  fireEvent.click(await screen.findByLabelText("Enable timesheet reminder"));
  fireEvent.change(screen.getByLabelText("Reminder time"), {
    target: { value: "17:30" },
  });
  fireEvent.click(screen.getByLabelText("Monday"));
  fireEvent.click(screen.getByLabelText("Saturday"));
  fireEvent.click(screen.getByText("Save reminder settings"));
  await screen.findByText("Timesheet reminder saved.");
  expect(mocks.invoke).toHaveBeenLastCalledWith("reminder_settings", {
    settings: { enabled: true, time: "17:30", days: [1, 2, 3, 4, 5] },
  });
});
it("does not enable reminders if OS permission is denied", async () => {
  mocks.granted.mockResolvedValue(false);
  mocks.request.mockResolvedValue("denied");
  render(<ReminderSettings />);
  fireEvent.click(await screen.findByLabelText("Enable timesheet reminder"));
  fireEvent.click(screen.getByText("Save reminder settings"));
  await screen.findByText(/Notifications are blocked/);
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
});
it("tests delivery without saving or enabling the schedule", async () => {
  render(<ReminderSettings />);
  fireEvent.click(await screen.findByText("Test notification"));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
});
