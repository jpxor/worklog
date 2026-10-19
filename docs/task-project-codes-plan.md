# Tasks and project codes: implementation plan

Status: implemented. The workspace has been updated; the temporary workspace upgrade tooling has been removed.

## Agreed behavior

- Existing projects represent tasks: features, fixes, investigations, or other work items.
- Notes, daily logs, checkboxes, attachments, and task overviews belong to tasks.
- Each task remembers its own open tabs, tab order, active tab, and cursor positions. Switching tasks replaces the visible task tabs with those previously open for the selected task.
- Global notes belong to the current workspace and have their own root in the left file tree. Open global-note tabs remain visible when switching tasks.
- Project codes are independent reporting categories shared across tasks.
- Each task has one default project code. Each time entry stores its own project code, which may differ from the task default.
- Changing a task default affects future entries only. Editing an entry can change that entry's code.
- A code can be searched, selected, or created directly in the time-entry form, without opening Settings or another dialog.
- Only version-3 workspaces are supported. No upgrade command or fallback handling is included.

## Confirmed decisions

1. Each project code has a single label.
2. New tasks preselect the last-used active code, with the picker visible for changes. If none exists, create/select the first code inline.
3. Reports retain separate rows for different tasks, combining entries only within the same code, task, and day.
4. Task tab sessions are restored when switching away and back.
5. Global notes are shared across tasks, with a separate file-tree root and tabs that survive task switching.
6. Ctrl+N defaults to the selected task's notes, including when a global note is active. Creating a global note is an explicit choice.
7. Drag-and-drop moves notes between Task notes and Global notes, including their folders, to correct ownership without recreating files.
8. Clicking Global notes opens a global overview with unchecked items, recent notes, pinned notes, and New global note. All lists include only global notes, never notes from individual tasks. The overview tab survives task switching and has no time totals.

Working defaults: code renames update the displayed label on historical reports; archived codes cannot be selected for new entries. These are implementation assumptions, not additional user decisions.

Additional working defaults: Global notes are shared within one workspace, not between different workspaces. Global tabs appear before the selected task's tabs, with ordering remembered separately within each group; dragging reorders tabs within their group. Switching tasks focuses that task's last active task tab. On its first visit, open its overview; if the user deliberately closed all its tabs, preserve that empty session and focus an open global tab or show an empty editor. Global notes do not contribute checkboxes to individual task overviews. No global daily-log or global time-entry feature is added.

## Scope and implementation order

Implement in this order: storage contract and fixtures; task/code entry and editing; scoped note paths and Global notes storage; task/global tab sessions and tree; reports and assistant retrieval; documentation and end-to-end checks. The numbered sections below describe the work, not independent releases. Use the existing compact-report changes as the starting point and preserve them throughout.

This work does not introduce billing, accounts, time splitting within a single entry, or automatic code assignment rules. To charge an interval to two codes, create two time entries. Renaming user-facing projects to Tasks does not require renaming existing directories or persisted `projectId` references.

## User experience contract

The user should be able to tell which task they are viewing, where a note belongs, and where time will be charged without opening Settings or hovering over anything. Keep these three pieces of context separate and visible.

The detailed layout, control states, keyboard behavior, and drag-and-drop interactions are specified in [task and global notes UX specification](task-project-codes-ux.md). Implement these together; the specification refines the behavior below without adding a separate dashboard or permanent instructional panels.

### Navigation and note ownership

- Label the main selector **Task**, showing the selected task name. Reserve **Project code** for time reporting; never use an ambiguous **Project** label for either concept. A short first-use explanation can say: “Tasks hold your notes. Project codes group your time.”
- In the left tree, use a **Task notes** heading below the selected task name and a separate **Global notes** heading. Show “Available in every task in this workspace” in the global empty state and help tooltip, rather than permanent explanatory copy. Each root has its own creation actions and independent remembered expanded/collapsed state.
- Mark global tabs with a small visible **Global** label, and separate their group from task tabs with a subtle divider. Retain the Global marker on visible global tabs when tabs overflow; switching tasks must not scroll the new task's active tab out of view. Use consistent scope text in the tree, tabs, search, pinned files, and editor breadcrumb. Color can reinforce scope but cannot be the only indicator; avoid duplicating icons and badges unnecessarily.
- Above the editor, always show the ownership breadcrumb: `Global notes / Team conventions.md` or `Fix login timeout / Investigation.md`. The owner remains readable even when filenames are truncated or two roots contain identically named files. Global means workspace-wide availability, not cloud sharing or collaboration.
- Opening a global tab leaves the selected task visible and unchanged. Its Global breadcrumb makes clear why the note remains when the task changes. Switching tasks explicitly restores the destination task's last active task tab, keeping the global tabs open.
- Ctrl+N and the generic New note action always default to the selected task's notes root, regardless of the active tab or focused tree node. Show “Create in <task>” beside the name field, with an inline destination selector. Root/folder creation actions instead target their explicit root/folder. With no selected task, show an unselected destination and offer Select/create task or Global notes explicitly; never silently turn Ctrl+N into global creation.
- Keep **Today's log** visibly associated with the selected task, even while a global note is open. Disable it with an explanation when no task is selected. Task overview headings should say **Unchecked items in task notes** or equivalent clear copy; global checkboxes remain editable in their source notes.
- Scope changes through Move show a labeled destination such as **Global notes** or **Task: Password reset**, not an internal filesystem path. Global deletion uses the existing confirmation with the scope identified (“Delete global note …?”); closing its tab only hides the tab and never deletes the note.

### Time entry and defaults

- Keep Task and Project code visible together in the entry form, including narrow layouts. Put “Time is reported against this code” in first-use help or the field's help tooltip. Show the small muted state **Task default** when applicable and **This entry only** when overridden, without adding a separate status panel.
- Both pickers support keyboard search, arrow navigation, Enter to select/create the highlighted option, and Escape to dismiss. Distinguish **Create task “…”** from **Create code “…”**; Enter inside a picker must not accidentally submit time. Provide visible labels, focus indicators, announced errors, and descriptive names for icon-only controls.
- Creating a new task keeps its name and default-code picker in one inline form. Show **Last used** on the preselected code so the suggestion is understood. Selecting/creating the code and saving the task returns focus to time entry without another dialog or losing typed fields.
- When editor navigation preserves a draft for another task, show a persistent inline notice: “Time entry is still for <task>.” Offer **Use current task**, which explicitly changes the draft's task and code to that task's default while retaining date, duration, and description. Do not auto-retarget on behalf of the user. Disable this shortcut while editing an existing entry; changing its Task field remains explicit and retains its saved code.
- After a successful save, show brief feedback including duration, task, and code (for example, “Logged 45m · Fix login timeout · SUPPORT”). When an override resets, show “Next entry uses task default: PORTAL” beside the reset picker. No extra confirmation is needed for normal saves.
- Archived-default errors appear beside the code picker with **Choose another code** and an explicit **Restore code** action, preserving all other fields. Before archiving a code, show how many task defaults it affects. Renaming explains once that historical reports will show the new label.
- The timer measures elapsed time and fills the visible time-entry draft; it is not automatically charged to the currently viewed task. The Use time action makes the draft's destination clear, especially when it differs from the selected task.

### Feedback and visual verification

- Normal task switches should feel immediate; only show “Saving notes…” when saving takes long enough to be noticeable. On failure, show the affected note, the reason, and **Retry save**/**Open note** using the existing conflict-resolution flow. Leave the prior task selected and keep entered text intact.
- Reports visibly use Project code headings and Date, Task, Time, Description columns. Keep task names on separate rows as agreed and multiline descriptions aligned under their entry.
- Validate the design with a small realistic workspace: two tasks with identically named notes, one shared global note, two project codes, and a partially filled time entry. Check narrow windows, long names, keyboard-only use, and light/dark appearance. Do not judge usability solely from unit tests.
- Acceptance check: without hovering, the user can identify the selected task, whether the active file is global or task-owned, the destination of a new note, and the task/code receiving time. Complete task switching, inline code creation, and note creation without visiting Settings.

## 1. Define and validate the data

- Add a `ProjectCode` collection with stable IDs, labels, and archived status. Store it in workspace-level `project-codes.json`, included in snapshots and backups. Use `worknotes.json` format version 3 for this complete change.
- Add `defaultProjectCodeId` to task metadata and required `projectCodeId` to each saved time entry.
- Add a workspace-level `global/notes/` directory. Give notes an explicit task/global ownership scope in frontend and retrieval metadata; global notes do not use a fake task ID.
- Keep task IDs, entry IDs, note paths, and the current directory layout. Internal `projectId` fields can continue identifying tasks; changing terminology should not require moving notes or rewriting their links.
- Use IDs for references so renaming a code does not disconnect entries or task defaults. Reports display the current code label.
- Trim code labels, reject empty labels, and prevent case-insensitive duplicates, including archived codes.
- Treat labels as display text, not filesystem names. Reject line breaks/control characters so labels remain usable in pickers and reports; preserve spelling and punctuation after trimming. Use the same duplicate rules in the picker and backend.
- Validate task and code references in Rust on reads and writes. Do not infer codes from task defaults when reading saved entries.
- Require an active code for new time. Preserve an archived code on existing entries when editing unrelated fields; reject a switch to an archived code.
- Allow archiving a code that tasks still reference. Keep those references and historical entries intact, show the default as archived, and require choosing an active code before logging new time. Never silently substitute another code. A task default can only be changed to an active code. Provide unarchive alongside rename/archive; an exact archived-label match offers restore/select rather than creating a duplicate.
- Preserve existing stale-edit protection for time entries. Treat inline creation racing with an identical code as selecting the already-existing code rather than creating a duplicate.

Primary files: `src/model.ts`, `src-tauri/src/storage.rs`, and frontend/backend fixtures.

## 2. Workspace format and initialization

- New workspaces use version 3 directly, including empty project-code storage and the global-notes root. Opening, cloning, restoring, and empty-remote initialization use the same format contract.
- Reject unsupported formats without changing their data. Do not include upgrade commands or runtime compatibility branches.
- Keep the bundled browser sample and test fixtures on the current format. Use workspace-scoped draft and tab-session storage while preserving recoverable unsaved note text.
- Fresh workspaces start with no project codes; users create their first code inline.

## 3. Keep task creation and time entry fast

- Rename user-facing Project labels to Task across navigation, creation, search, overview, closed-task management, time editing, help, and shortcuts.
- Extend or extract the existing searchable picker so Task and Project code have independent accessible labels and keyboard navigation.
- Show Task and Project code in both docked and popup time-entry forms. Search existing codes or choose `Create "<label>"` inline.
- Code creation selects the new code and preserves work date, duration, description, timer state, and selected task. Creation failures retain the typed label and the rest of the draft.
- New tasks include a visible default-code picker, with the agreed initial selection behavior. Creating a task inline from time entry uses the selected code as its default.
- Resolve first-run creation without a detour: when creating a task and no active code is selected, keep the task name in the same inline form and let the user select/create a code there before saving the task. No temporary task with a missing default and no Settings dialog. If code creation succeeds but task saving fails, retain the valid code and entered task name for retry.
- Define last-used as the code on the most recently successfully saved time entry or created task in this workspace. Opening a picker or cancelling a form does not update it. If it is archived or absent, leave the visible picker empty and allow inline creation/selection; do not guess another code.
- Selecting a task for a new entry selects its default code. Selecting a different code overrides it for that entry; saving does not change the task default.
- After saving an entry, clear its duration/description and preselect the current task's default for the next entry. Keep the last-used code separately for new-task creation. Changing a task default does not rewrite an already-started time-entry draft.
- Main-editor task navigation updates a pristine new time-entry form to the destination task/default. If a draft has a duration, description, manually overridden code, or is editing an existing entry, preserve its task/code and content across navigation and keep those fields visible. Explicitly choosing a task in the new-entry form retargets that draft and selects the chosen task's default; editing an existing entry follows the rule below. Switching tasks never resets the timer or logs time automatically.
- Use the mismatch notice and explicit **Use current task** action defined in the UX contract whenever the preserved draft targets another task. A preserved draft must never look as though it automatically follows editor navigation.
- Editing an existing entry loads its saved code, never the task's current default. If its task is changed during editing, retain its saved code unless the user changes the code explicitly.
- Add the default-code picker to task editing. Provide minimal code rename/archive management with no permanent deletion, so historical references remain valid. Routine creation stays inline.
- Show the saved code in time history and entry details. Persist the code with the time-entry draft and scope last-used-code selection to the current workspace.

Primary files: `src/App.tsx`, `src/ProjectCombo.tsx`, `src/TimeDetails.tsx`, `src/ProjectOverview.tsx`, and relevant styles/tests.

## 4. Restore a separate tab session for each task

- Replace the single shared tab list with task sessions keyed by stable task ID plus one global tab session. Persist these under the selected workspace so different workspaces cannot share session state accidentally.
- Remember each task's open note/document/overview tabs, their order, active tab, cursor/selection, and editor scroll position. Remember global tab order, cursor/selection, and scroll position separately. Closing a global tab closes it across all tasks in that workspace.
- Track the last active task-owned tab separately from the globally focused tab. Focusing a global note must not erase a task's remembered selection. Distinguish a never-visited task from a saved session with zero open tabs. Restore editor positions after content/layout is ready and clamp positions if a file changed externally.
- Route task changes through one transition used by the main selector, recent tasks, quick switcher, note search, overview links, and cross-task note navigation. Merely changing the task on a time-entry form must not unexpectedly switch the editor's task session.
- On task switch, capture the outgoing session and restore the destination session while retaining every open global tab. Selecting the currently active task leaves its session untouched.
- Serialize save-and-switch transitions so rapid task selections cannot apply an older restoration over a newer one. Publish the new selected task and visible tab set together only after required saves succeed. A failed transition leaves the previous selection and session intact.
- Save dirty notes using the existing autosave/conflict rules. Keep unsaved text and recovery drafts by path even when their task is hidden; a failed save or conflict must not discard changes or get reported as saved. Keep failed/conflicted documents open and defer the task switch until resolved; restoration of an existing recovery draft must use the normal recovery flow.
- Opening a task-owned result switches to its task, restores that session, then opens/focuses the requested file and match. Opening a global result leaves the selected task and its time-entry draft unchanged.
- Update rename/move/delete handling across inactive task sessions and the global session, including descendant paths. Reconcile externally deleted files on restoration without losing recovery drafts.
- Preserve task sessions when tasks are closed/reopened. On app restart, restore the selected task session and global tabs. Keep machine-specific tab state outside workspace data backups, as today.

Primary files: `src/App.tsx`, editor state/recovery helpers, tab rendering, note navigation, and workspace-state tests.

## 5. Add the Global notes tree root

- Show two clearly labeled roots in the left panel: the selected task's notes and **Global notes**. Keep the global root available without a selected task.
- Clicking the Global notes root label opens/focuses one global overview tab; its chevron independently expands/collapses the tree. Store the overview in the global tab session, with the same persistence and close behavior as other global tabs. Opening it leaves the selected task and time-entry draft unchanged.
- Build the overview from global-owned notes only: unchecked Markdown items linking to their source lines, recent notes ordered by modification date, pinned notes, and a New global note action. Reuse the existing overview parsing/navigation helpers where appropriate, without associating this view with a task or including time totals. Follow the companion UX specification for layout and empty states.
- Update overview lists after edits, pin changes, renames, moves, and deletions. Moving a note into or out of global scope changes its membership immediately; task-owned notes must never appear because they were recently opened or pinned elsewhere.
- Support creating notes/folders directly under the chosen root, with the existing rename/move/delete, pinning, Markdown/Mermaid, image, and PDF behaviors. An action invoked from a root must target that root explicitly.
- Apply the visible Global label, ownership breadcrumb, and explicit create/move destinations from the UX contract to all file types, including image/PDF viewers. Persist root expansion state without letting a collapsed global tree hide the ownership of an open global tab.
- Opening or editing a global note never changes task selection, the task's default code, or the task/code on a time-entry draft. Time remains assigned to tasks and project codes.
- Retain explicit note ownership when a global tab is active; do not infer a task from a path segment in `openNote` or related handlers.
- Extend filesystem traversal, snapshots, path validation, read/write operations, revisions, and document reads to the global root while retaining the existing traversal/symlink protections.
- Include global notes in quick switching and full-text search. Label results with **Global notes** so identical filenames in different roots remain distinguishable.
- Include global notes and attachments in local Git history, folder/remote backups, restore validation, and historical note retrieval. Persist a `.gitkeep` for an empty global root, as with existing empty note folders. Update root-level changes to invalidate cached/retrieval results correctly.
- Support drag-and-drop between the Task notes and Global notes roots and their folders, alongside task/global destinations in the existing Move action. Both use the same validated backend operation and update ownership plus all saved tab/draft/pin references. A moved open tab transfers to the destination task session or the global session without duplication; moving it into another task does not leave it visible under the original task. Preserve existing filename-collision and unsaved-edit protections. Follow the detailed UX specification for target feedback, failures, folder moves, and the keyboard-accessible Move alternative.

Primary files: `src/App.tsx`, file-tree components/helpers, `src/api.ts`, `src-tauri/src/storage.rs`, `src-tauri/src/evidence.rs`, and document viewer tests.

## 6. Update reporting and assistant retrieval

- Build on the current uncommitted compact-report change; keep its newline-separated description formatting and time aggregation.
- Group reports by project code, then work date, with separate rows for each task. Sum all effective entries for each code/task/day and retain project-code totals, daily totals, and the grand total.
- Include the task name on each row and join its nonempty descriptions with newlines. Include a task's name even when all its descriptions are empty, so the total can still be explained. Sort codes by label, dates ascending, and tasks by name with ID tie-breakers; preserve the current stable entry ordering within each group's descriptions. Calculate column widths from aggregated durations.
- Never merge different tasks or different codes. Multiple entries for the same task, code, and day become one row.
- Daily report breakdowns use project codes. Task overviews continue showing effort for the task across all its codes.
- Include code IDs, labels, and task defaults in read-only assistant retrieval. Add code discovery and a code filter for time entries, and return totals by code alongside task totals.
- Use `list_tasks` and `taskId` in the assistant-facing API, add `list_project_codes` and `projectCodeId`, and return task/code identities on time entries. Map these to retained internal `projectId` storage fields explicitly. Return `taskTotals` and `projectCodeTotals` over all filtered entries, not just a page. Do not add legacy tool aliases solely for pre-release compatibility. Keep note-path validation consistent with the retained directory layout.
- Include code metadata in retrieval revision hashes so code renames invalidate paginated results correctly.
- Expose global notes in note listing/search/read/history with explicit global scope and no task association. Note list/search/history accept `scope: all | task | global`, defaulting to all without a task filter. Supplying `taskId` narrows to that task; combining it with global scope is an error. Task scope without an ID means all task-owned notes, excluding global notes. Reads infer ownership from the validated path; any supplied scope/task constraint must agree with it.
- Keep task discovery counts, activity evidence, and checkbox overviews scoped to task-owned notes; do not count shared global notes once for every task. Include global-note changes in retrieval revision hashes.

Primary files: `src/model.ts`, `src-tauri/src/evidence.rs`, MCP tests, `docs/mcp.md`, and `docs/user-guide.md`.

## 7. Verify and finish

- Data tests: shared code across tasks, one task using several codes, invalid references, duplicate/archived codes, code rename, stale edits, and new-format workspace validation.
- Format tests: reject unsupported versions without changing workspace data.
- Cover the boundaries found during plan review: first task/code creation with an empty workspace, archived defaults and unarchiving, last-used selection after cancel/failure, partial time drafts surviving editor navigation, intentionally empty task sessions, rapid task switching, cross-root moves, and clone/restore initialization of version 3.
- UI tests: keyboard-only search/create/select, preserved draft fields after creation/failure, new-task defaults, per-entry overrides, and existing-entry edits retaining their saved code.
- Tab-session tests: A → B → A restores each task's tab set/order/focus/cursor/scroll; global tabs remain visible; closing a global tab persists across switches; restart and workspace isolation; navigation through search and recent tasks; stale paths, rename/move/delete updates, and dirty/save-failure/conflict recovery.
- Global-note tests: create/edit/search/open without changing the selected task or time draft, root-specific file operations and path protections, attachments, backups/restore, Git history, and separation from task overviews.
- Global overview tests: exclude all task-owned notes/items/pins, modification-date ordering, source-line navigation, root label versus chevron behavior, single overview tab persisting across task switches, empty state and explicit global creation, and list updates after cross-root moves. No time totals appear.
- Drag-and-drop tests: both directions across roots, nested folders/attachments, collapsed and empty roots, move with an open/dirty note, same-name collision, forbidden destinations, failed writes, and equivalent keyboard Move behavior. Ctrl+N tests include an active global tab, a focused global tree node, and no selected task.
- UX checks: identical filenames in both scopes remain distinguishable; create/move actions show their destination; code overrides and next-entry resets are visible; mismatched drafts cannot be mistaken for the selected task; picker Enter does not submit time; first-run inline task/code creation works without Settings. Verify labels and feedback in both themes, narrow layouts, tab overflow, and keyboard-only navigation.
- Report tests: multiple tasks sharing a code/day, multiple codes for one task/day, empty/multiline descriptions, corrections/removals, date boundaries, aligned columns, and unchanged grand totals.
- Retrieval tests: code discovery/filtering/totals, task/global note scopes and historical reads, and pagination invalidation after code or global-note changes.
- Run frontend tests, TypeScript/build checks, and Rust tests. Check the desktop entry/edit/report flows and backup/restore of a new-format workspace.
- Update README, page summary, user guide, product specification, and release notes for Tasks, Project codes, task tab sessions, and Global notes, keeping plain-text storage and backups explicit.
- Review the diff. Publishing a new installer is a separate release step after implementation is verified.

## Acceptance example

Task `Fix login timeout` defaults to `PORTAL`. Log 45 minutes to `PORTAL`, then create `SUPPORT` inline and log another 30 minutes to that code. Task `Password reset` also uses `PORTAL` and logs 60 minutes on the same day.

The report shows two rows under `PORTAL` for that day: `Fix login timeout` at 45m and `Password reset` at 1h. `SUPPORT` has a separate 30m row for `Fix login timeout`. Additional same-day entries for the same task and code combine into that task's row, with descriptions separated by newlines. `Fix login timeout` still defaults to `PORTAL` and its original entries remain individually editable. The grand total is 2h 15m.

For task switching, open `Investigation.md` and `Fix.md` under `Fix login timeout`, plus global `Team conventions.md`. Switch to `Password reset`: only its remembered task tabs appear alongside `Team conventions.md`. Open `Design.md` there. Switching back restores `Investigation.md` and `Fix.md` in their previous order and position, with `Team conventions.md` still open. Switching again restores `Design.md`. Editing the global note never changes which task or code receives time.
