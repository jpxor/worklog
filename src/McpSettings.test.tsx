// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ control: vi.fn() }));
vi.mock("./api", () => ({ desktop: true, mcpControl: mocks.control }));
import McpSettings from "./McpSettings";
const config = {
  bindHost: "127.0.0.1",
  port: 43127,
  certificatePath: "",
  privateKeyPath: "",
  allowedHosts: [],
  allowedOrigins: [],
};
const status = {
  config,
  token: "test-token",
  running: false,
  endpoint: "http://127.0.0.1:43127/mcp",
  workspace: null,
  error: null,
};
beforeEach(() => mocks.control.mockReset().mockResolvedValue(status));
afterEach(cleanup);
it("keeps sharing off until requested, masks credentials, and starts with edited settings", async () => {
  mocks.control.mockImplementation(async (action) =>
    action === "start"
      ? { ...status, running: true, workspace: "work-data" }
      : status,
  );
  render(<McpSettings />);
  await screen.findByText("Sharing is off");
  expect(mocks.control).toHaveBeenCalledTimes(1);
  expect((screen.getByLabelText("Bearer token") as HTMLInputElement).type).toBe(
    "password",
  );
  fireEvent.click(screen.getByRole("button", { name: "Show token" }));
  expect((screen.getByLabelText("Bearer token") as HTMLInputElement).type).toBe(
    "text",
  );
  fireEvent.change(screen.getByLabelText("Port"), {
    target: { value: "43128" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Start sharing" }));
  await screen.findByText("Sharing is running");
  expect(mocks.control).toHaveBeenCalledWith("start", {
    ...config,
    port: 43128,
  });
  expect(screen.getByLabelText("Port").matches(":disabled")).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));
  await screen.findByText("Sharing is off");
  expect(mocks.control).toHaveBeenCalledWith("stop", undefined);
});
it("shows startup errors and retains the connection form for correction", async () => {
  mocks.control.mockImplementation(async (action) => {
    if (action === "start") throw new Error("Port is in use");
    return status;
  });
  render(<McpSettings />);
  await screen.findByText("Sharing is off");
  fireEvent.click(screen.getByRole("button", { name: "Start sharing" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Port is in use",
  );
  expect((screen.getByLabelText("Port") as HTMLInputElement).value).toBe(
    "43127",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Rotate token and stop sharing" }),
  );
  await waitFor(() =>
    expect(mocks.control).toHaveBeenCalledWith("rotate_token", undefined),
  );
});
