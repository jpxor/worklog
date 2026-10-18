// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import TimeDetails from "./TimeDetails";
import type { Entry } from "./model";
afterEach(cleanup);
const entry: Entry = {
  type: "entry",
  id: "one",
  projectId: "p",
  date: "2026-10-17",
  minutes: 45,
  note: "Reviewed drawings",
};
const projects = [
  { id: "p", name: "Design", closed: false },
  { id: "q", name: "Admin", closed: false },
];
const base = () => ({
  entries: [entry],
  projects,
  date: "2026-10-17",
  busy: false,
  error: "",
  onSave: vi.fn().mockResolvedValue(true),
  onRemove: vi.fn().mockResolvedValue(true),
});
describe("time details", () => {
  it("shows date-scoped totals and project breakdown", () => {
    render(
      <TimeDetails
        {...base()}
        entries={[
          entry,
          { ...entry, id: "two", projectId: "q", minutes: 30 },
          { ...entry, id: "old", date: "2026-10-16", note: "Yesterday only" },
        ]}
      />,
    );
    expect(screen.getByText("1h 15m")).toBeTruthy();
    expect(screen.getAllByText("Design").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
    expect(screen.queryByText("Yesterday only")).toBeNull();
  });
  it("updates the same record and passes the original for conflict protection", async () => {
    const props = base();
    render(<TimeDetails {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Duration"), {
      target: { value: "1.5h" },
    });
    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: "q" },
    });
    fireEvent.change(screen.getByLabelText(/Note/), {
      target: { value: "Updated work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(props.onSave).toHaveBeenCalledWith(
        { ...entry, projectId: "q", minutes: 90, note: "Updated work" },
        entry,
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("form", { name: "Edit time entry" }),
      ).toBeNull(),
    );
  });
  it("retains edits after a failed save and disables invalid durations", async () => {
    const props = base();
    props.onSave.mockResolvedValue(false);
    render(<TimeDetails {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Duration"), {
      target: { value: "2" },
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Save changes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("Duration"), {
      target: { value: "2h" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect((screen.getByLabelText("Duration") as HTMLInputElement).value).toBe(
      "2h",
    );
  });
  it("removes the selected entry and leaves others untouched", () => {
    const props = base();
    render(<TimeDetails {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(props.onRemove).toHaveBeenCalledWith(entry);
  });
});

it("browses all projects by week and jumps to historical dates", () => {
  render(
    <TimeDetails
      {...base()}
      weekly
      entries={[
        entry,
        { ...entry, id: "next", date: "2026-10-19", note: "Next week task" },
        { ...entry, id: "other", projectId: "q", note: "Other project work" },
      ]}
    />,
  );
  expect(screen.getByText("Other project work")).toBeTruthy();
  expect(screen.queryByText("Next week task")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next week" }));
  expect(screen.getByText("Next week task")).toBeTruthy();
  expect(screen.queryByText("Other project work")).toBeNull();
  fireEvent.change(screen.getByLabelText("Jump to date"), {
    target: { value: "2026-10-17" },
  });
  expect(screen.getByText("Other project work")).toBeTruthy();
});
