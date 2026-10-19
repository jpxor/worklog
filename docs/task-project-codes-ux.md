# Tasks, project codes, and global notes: UX specification

Companion to [the implementation plan](task-project-codes-plan.md). This specifies the intended interface; it is not a record of implemented behavior.

## Layout and visual hierarchy

Retain the existing sidebar, central editor, and docked/popup time form. Add scope to these surfaces instead of adding another navigation layer. Use the current typography, spacing, colors, and components in both themes.

```text
LEFT SIDEBAR                  EDITOR                              LOG TIME
Task                          [Global · Reference] | [Fix.md]      Task
[Fix login timeout       v]                                       [Fix login timeout    v]
                              Fix login timeout / Fix.md
v Task notes          +  …                                        Project code
    Investigation.md          <note content>                      [PORTAL               v]
    Fix.md                                                        Task default

v Global notes        +  …                                        Date       Duration
    Reference.md                                                  [Today]    [45m]
                                                                  Description
                                                                  [                     ]
                                                                  [Log time]
```

- Keep the existing sidebar width/resizing behavior. Task selection sits above both tree roots; Task notes comes first and Global notes second. Each is a collapsible section in the same tree, not a tab that hides the other root.
- Root rows use a chevron, text label, New note (+), and overflow menu. Keep the + discoverable; use overflow for New folder and less frequent actions. All controls remain keyboard focusable and have accessible names such as “New global note.” Avoid a full action toolbar on every file row.
- File rows retain existing icons. Do not badge every item under Global notes: the tree root establishes its scope. Pinned/search items outside that hierarchy do need scope text.
- Use one quiet ownership breadcrumb above the editor, not an extra colored header/card. Global tab badges are compact muted text; task tabs do not need a repeated Task badge. A divider separates global tabs from task tabs without repeating a group title.
- Use text and shape to convey ownership, not just color. Reserve warning color for actionable problems. Keep the main editor visually dominant.
- Match current control sizing; target at least 28–32 px-high tree rows and 32 px-high inputs/actions with comfortable hit areas. Never shrink text or controls just to fit more labels. Keep focus outlines visible.

## Ctrl+N and creating notes

1. Ctrl+N opens the existing note-creation surface with the filename focused and the selected task's notes root as destination. This is true while a global note is active or the global tree has focus. The generic New note button uses the same rule.
2. Above/beside the name field show a compact destination selector: `Create in: Fix login timeout`. It can explicitly switch to Global notes; do not remember a previous global destination for the next Ctrl+N invocation.
3. Root + and folder context actions supply their own destination. Global root + starts directly at `Create in: Global notes`; a folder action includes that folder in the displayed destination.
4. Enter creates and opens the note; Escape cancels without creating a file. Keep validation near the filename, preserve the typed name on failure, and avoid a second confirmation.
5. If no task is selected, Ctrl+N still opens creation but requires a destination. Offer Select/create task and Global notes in that surface. The task empty state also offers Create task, while global root + works immediately.
6. Today's log remains a task-specific action. Its accessible label/help identifies the selected task. It never creates a global daily log because a global tab happens to be active.

No extra global-note keyboard shortcut is necessary initially. Root + and the destination selector provide the explicit path.

## Tabs, focus, and ownership

- All open global tabs precede the active task's tabs; within each group, preserve the user's order. A global tab reads `Global · Reference.md`; a task tab reads `Fix.md`. Keep “Global” visible before truncating the filename. Tooltips expose the full path, but scope does not depend on hovering.
- Breadcrumbs read `Global notes / folder / Reference.md` or `<task name> / folder / Fix.md`. Allow wrapping to a second line for long owner names instead of hiding ownership. The active file is also selected in its tree when that root is expanded; do not force collapsed roots open merely because tasks changed.
- Selecting task B replaces A's task tabs with B's saved session and focuses B's last task tab. Global tabs remain open. Selecting a global tab does not change the main task selector or the time form.
- Use ordinary tab overflow scrolling or the existing overflow menu. Ensure the restored active tab scrolls into view; global tabs need not all fit simultaneously. Overflow entries retain Global labels. Dragging tabs only reorders within their ownership group; file-tree dragging or Move changes ownership.
- A deliberately empty task session stays empty. Show “No notes open for <task>” with Open overview and New note when no global tab is focused. First-time tasks open their overview automatically.
- Closing a global tab closes it for this workspace, not just the selected task. This is ordinary close behavior with no confirmation unless unsaved-data recovery requires it.
- Save failures block the task transition and identify the file inline. Avoid a modal on every task switch or success toast on normal tab restoration.

## Moving notes between roots

The Global notes root label opens its overview; the chevron alone expands/collapses it. A drag gesture and drop on the root must not accidentally open the overview.

- Drag a note, attachment, or folder from either tree root onto the other root or one of its folders to **move** it. Do not implement copy/link modifier behavior in this change. Task/global root containers themselves are not draggable.
- A root-row drop targets that root's notes directory. A folder-row drop targets that folder. File rows are not folder targets, and dropping on blank sidebar space must not choose an ambiguous destination. Keep empty and collapsed root rows usable as drop targets.
- While dragging, outline the valid target row and show one small drag hint: `Move to Global notes` or `Move to Fix login timeout / research`. A collapsed folder/root may expand after roughly 600 ms of hover; expand immediately after a successful drop to reveal the result. Autoscroll the tree near its edges.
- Reject the current parent (no-op), folder descendants, non-note roots, and a missing task destination. Use a forbidden cursor and concise reason where appropriate. Escape cancels. Do not move anything until drop.
- Before the filesystem move, save affected dirty files using existing conflict protection. If that fails, leave the file and tab where they were, retain edits, and identify the affected note. For folders, handle descendants as a single validated move rather than a series of partially completed child moves.
- Never overwrite or silently merge on a name collision. Leave the source intact and show “A note named Fix.md already exists in Global notes. Rename it or choose another folder.” The user can then rename or use Move; a new conflict-resolution wizard is unnecessary.
- On success, select/reveal the destination item and show a brief status message: `Moved Fix.md to Global notes`. Keep the editor focused on the same file if it remains visible; its tab transfers groups and its breadcrumb updates immediately. Persist tab, pin, cursor, and recovery-draft path references. The selected task and time draft do not change.
- Moving a global note into the current task makes its tab task-specific; it disappears on switching away and returns with that task. Moving a task note into Global notes makes its tab survive subsequent task switches. Moving an open note to another task through Move transfers the saved tab into that task's session and focuses a remaining visible tab without switching tasks automatically.
- Provide the same operation through a keyboard-accessible file context menu **Move…**, with destinations labeled Global notes and Task: <name>. This also supports other tasks whose trees are not currently displayed. Drag-and-drop is a shortcut, not the only way to fix location.
- Preserve existing move semantics for links inside Markdown: do not promise automatic rewriting of arbitrary relative links. Test that ownership changes do not introduce any additional rewriting or content loss.

## Global notes overview

- Clicking the Global notes root label opens or focuses one tab named **Global · Overview**. Use `Global notes / Overview` as its breadcrumb. It belongs to the global session, survives task switches, and does not change task selection or time attribution. Closing the tab does not remove any notes.
- Use the existing overview page styling: **Global notes** as the heading, a single **New global note** action, and simple list sections. Avoid dashboard cards, charts, time totals, or a second task selector.
- **Unchecked items:** list unchecked Markdown items from global notes only, grouped by source note. Clicking an item opens the global note at the relevant line. Reuse existing checkbox behavior and save/conflict handling; source notes remain authoritative.
- **Pinned notes:** list only pinned global notes in their saved pin order. Opening a pin leaves the selected task unchanged. Pins from any task are excluded, even if their filenames match.
- **Recent notes:** show the ten most recently modified global notes, newest first, with filename, relative folder when needed, and last-modified date. Use path as a stable tie-breaker. This is modification recency, not recently opened task files. Pinned notes may also appear here so the meaning of Recent stays consistent; the tree provides access to all global files.
- Keep global scope implicit within these lists: the heading and breadcrumb already establish ownership, so avoid a Global badge on every row. Do show folder context to distinguish duplicate filenames.
- When no global notes exist, show: “Notes shared across all tasks in this workspace. Use them for reference material, procedures, and general notes.” Include **New global note**, which targets the global root explicitly. Ctrl+N still defaults to the selected task as specified above.
- When notes exist, use short section empty states such as “No unchecked items” and “No pinned notes.” Do not keep the introductory paragraph visible above populated lists.
- Refresh membership after editing, pinning, renaming, moving, or deleting. A note moved into global scope appears in the appropriate global lists; moving it to a task removes it. Task overview lists stay scoped to their own task.

## Time entry with minimal extra controls

- Put Task and Project code next to each other only when both labels/values fit comfortably; otherwise stack them above date and duration. Keep both visible when editing or logging. The code dropdown is the main added control.
- Beneath the code show one small state label: Task default, This entry only, or Archived. Do not add persistent explanatory paragraphs. Put the explanation “Time is reported against this code” in help/first-use copy.
- Search results show existing labels first and a distinct `+ Create code “SUPPORT”` option when appropriate. It is an explicit choice, never an automatic consequence of typing or losing focus. On successful creation select it immediately, dismiss the picker, and focus the next field. Preserve all other input on failure and announce the error.
- Inline task creation shows only Task name and Default project code with Create task/Cancel. Preselect the last-used active code and identify the suggestion with a small Last used label. Reuse the same code picker, including inline creation. No nested modal or settings detour.
- A code override affects this entry only. Changing the saved default belongs in Edit task; do not add a permanent “Make default” checkbox to every time entry.
- If the editor task differs from a nonempty entry draft, insert one conditional notice directly above the Task field: `Time entry is still for Fix login timeout` and a text button `Use current task`. The action adopts the current task's default code, retaining date, duration, and description. With no current task, omit that action. In edit mode, use `Editing an entry for Fix login timeout` and require direct field changes.
- When the docked time form is hidden, put a small **Draft** marker on its existing Log time launcher while a draft exists; when mismatched, its accessible label/tooltip names the target task. Revealing the form shows the full mismatch notice before saving. Do not add a persistent application-wide warning banner.
- Successful save feedback names duration, task, and code. If the next entry returns from an override to the task default, show that reset alongside the normal feedback; do not add another toast. Failed saves preserve input and put the error near the relevant field/save action.
- Archived defaults present Choose another code/Restore code beside the field only when needed. Manage codes remains a secondary settings/menu action for renaming and archiving, not a required step for routine entry.
- Keep the timer's existing controls. When Use time would fill a draft for another task, name that task in the button's adjacent contextual text. Timer state never implies that time has already been assigned or saved.

## Search, reports, and small-window behavior

- Keep search result rows compact: filename on the first line; owner (`Global notes` or task name) and relative folder on the second. Identical filenames remain distinguishable. Opening a task result switches task; opening a global result keeps the current task.
- Reports use a heading per Project code, with Date, Task, Time, and Description columns. Reuse the existing plain-text preview/export; wrap description continuation lines consistently without introducing a second report designer. Different task rows stay separate.
- Narrow windows preserve labels and scope; the time form uses its existing popup alternative when docking would squeeze the editor. Do not add another global/task mode toggle. Menus handle infrequent commands; visible root headings and breadcrumbs carry context.
- First-use explanations appear in empty states/help and disappear as the workspace fills. Normal populated views contain no tutorial cards, repeated ownership banners, or success notifications for ordinary navigation.

## UX acceptance checks

1. With a global note active, press Ctrl+N and create Fix.md: it belongs to the selected task. Repeat while the global tree is focused.
2. Use global root + to create Reference.md: its breadcrumb and tab say Global, and it stays open through A → B → A.
3. Open two files named Notes.md in different scopes: identify each without hovering, in light/dark themes and a narrow window.
4. Drag a dirty task note to Global notes: save, move, keep the same text/cursor, update the tab/breadcrumb, and verify it survives switching tasks. Reverse the move and verify task-specific restoration.
5. Attempt a move onto an occupied filename or invalid folder: source and edits remain intact, with an actionable error.
6. Start time for task A, switch the editor to B: the preserved draft visibly still targets A. Use current task intentionally retargets it to B and B's default code.
7. Create a task and code from an empty workspace using only the keyboard and without opening Settings. Enter in the code picker must not submit the time entry.
8. Check tab overflow, collapsed roots, long names, file moves with keyboard controls, and failed saves. No ownership information relies solely on color, a tooltip, or a hidden panel.
9. Open Global notes overview with recent/pinned notes and unchecked items in multiple tasks and the global root. Only global-owned content appears. Verify its source links, empty state, new-note destination, and persistence through task switching; click the chevron separately to confirm it only toggles the tree.
