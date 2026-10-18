import { expect, it, vi } from "vitest";
import { deleteWithConfirmation } from "./deleteFile";
const path = "projects/p/notes/file.pdf";
it("confirms before moving a file to the system bin", async () => {
  const ask = vi.fn().mockResolvedValue(true),
    remove = vi.fn().mockResolvedValue(undefined);
  expect(
    await deleteWithConfirmation(path, false, "Recycle Bin", ask, remove),
  ).toBe("trashed");
  expect(ask).toHaveBeenCalledWith('Move "file.pdf" to the Recycle Bin?');
  expect(remove).toHaveBeenCalledExactlyOnceWith(false);
});
it("does nothing when the initial confirmation is cancelled", async () => {
  const remove = vi.fn();
  expect(
    await deleteWithConfirmation(
      path,
      false,
      "Trash",
      vi.fn().mockResolvedValue(false),
      remove,
    ),
  ).toBeNull();
  expect(remove).not.toHaveBeenCalled();
});
it("requires a separate explicit confirmation for permanent deletion after trash failure", async () => {
  const ask = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true);
  const remove = vi
    .fn()
    .mockRejectedValueOnce("TRASH_UNAVAILABLE: Unsupported drive")
    .mockResolvedValueOnce(undefined);
  expect(
    await deleteWithConfirmation(path, false, "Recycle Bin", ask, remove),
  ).toBe("permanent");
  expect(ask.mock.calls[1][0]).toContain("Permanently delete it instead?");
  expect(remove.mock.calls).toEqual([[false], [true]]);
});
it("retains the file when permanent deletion is declined", async () => {
  const remove = vi.fn().mockRejectedValue("TRASH_UNAVAILABLE: Unavailable");
  const ask = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(
    await deleteWithConfirmation(path, false, "Trash", ask, remove),
  ).toBeNull();
  expect(remove).toHaveBeenCalledExactlyOnceWith(false);
});
it("does not offer permanent deletion for validation errors", async () => {
  const ask = vi.fn().mockResolvedValue(true);
  await expect(
    deleteWithConfirmation(
      path,
      true,
      "Trash",
      ask,
      vi.fn().mockRejectedValue("Folder is not empty"),
    ),
  ).rejects.toBe("Folder is not empty");
  expect(ask).toHaveBeenCalledTimes(1);
});
