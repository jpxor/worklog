export type DeleteOutcome = "trashed" | "permanent" | null;
export async function deleteWithConfirmation(
  path: string,
  folder: boolean,
  trashName: string,
  ask: (message: string) => Promise<boolean>,
  remove: (permanent: boolean) => Promise<unknown>,
): Promise<DeleteOutcome> {
  const name = path.split("/").at(-1) || path;
  if (
    !(await ask(
      folder
        ? `Move empty folder "${name}" and its empty subfolders to the ${trashName}? Folders containing files will not be deleted.`
        : `Move "${name}" to the ${trashName}?`,
    ))
  )
    return null;
  try {
    await remove(false);
    return "trashed";
  } catch (error) {
    const message = String(error);
    if (!message.startsWith("TRASH_UNAVAILABLE:")) throw error;
    if (
      !(await ask(
        `Could not move "${name}" to the ${trashName}.\n\nPermanently delete it instead? This cannot be undone through the OS.\n\n${message.slice("TRASH_UNAVAILABLE:".length).trim()}`,
      ))
    )
      return null;
    await remove(true);
    return "permanent";
  }
}
