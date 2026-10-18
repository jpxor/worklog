# WorkLog specification

Product specification based on the agreed WorkLog requirements. Formerly named WorkNotes; retain the existing internal application identity, settings keys, data marker, and backup directory names for compatibility.

## Purpose

WorkLog is a local desktop application for a single user to take project notes and manually record time worked. Note taking is the main workspace. Time logging is quick and unobtrusive. The application runs on Windows and Linux from its first release, without a hosted application server.

## Scope

- Organize plaintext notes by project.
- Select an active project and edit notes in tabs.
- Quickly log a duration against a project and work date.
- Provide a small optional timer as a separate aid.
- Filter time records by date range and produce aggregated reports.
- Store data in ordinary files with Git history and backups.

This is a single-user, single-running-instance application. Collaboration, concurrent editing from multiple computers, billing, invoicing, accounts, and cloud application services are outside the initial scope. CSV export is excluded from the initial version.

## Main workspace

The window contains an active-project selector, a notes sidebar on the left, and an editable content pane with tabs for open notes. A Log time action opens the compact time-entry interface. That interface is docked to the right by default and can also be displayed as a popup.

Switching the active project changes the notes shown in the sidebar. Open tabs remain available and clearly identify their project when necessary. WorkLog restores the active project, open tabs, cursor positions, and panel visibility after restart.

The notes sidebar is a folder tree from the first version, supporting nested folders and note creation, selection, renaming, and deletion. Confirm deletion and use the OS Recycle Bin/Trash for user-managed recovery. Do not create private app trash copies. If the OS bin is unavailable, require a separate explicit confirmation before permanently deleting; cancellation or failure keeps the item in the workspace. Optional Git history may retain earlier versions independently.

## Projects

Each project has a stable ID, display name, directory, and open/closed status. Renaming a project does not change the identity referenced by its time records.

The notes tree's root row displays the active project's name and serves as the drop target for moving notes and folders to the project root.

Clicking the root opens or focuses one project overview tab. Show a single list of project notes/files: notes with unfinished Markdown checklist items first, then other notes, with newest filesystem modification times first within each group and path as a deterministic tie-breaker. Show the relative note path and last-edited date. No frontmatter, creation dates, task database, Kanban board, or separate task records are required. Filesystem dates may change after copying or Git cloning.

List unfinished Markdown checkboxes beneath each source note, excluding fenced/indented code and non-Markdown documents. Support nested, quoted, and numbered list checkboxes. Clicking the item text opens its note at the exact source position; clicking the note title opens the note. Checking an item updates only the checkbox marker in the original file through normal conflict-checked saving. Preserve line endings and other content; save pending drafts before opening or updating an overview, and never overwrite an external edit. Keep note ordering stable during a visit and retain newly completed items as checked until leaving/reopening, when sorting and visibility refresh. Overview tabs support normal selection, closing, persistence, and reordering, but are not files and cannot be renamed. Empty overviews offer note creation in their own project.

Project selectors support typing to filter open projects, Arrow Up/Down to highlight results, Enter to select, and Escape to dismiss. Clicking the input or its dropdown arrow must reopen the full list even when the input remains focused after selection. If the entered name does not match an existing project, an explicit Create action creates and selects it. Merely typing an unmatched name must not silently create a project.

An empty workspace invites the user to create their first project. Its creation button focuses the sidebar project selector and displays an anchored tutorial explaining typing a name and choosing Create or pressing Enter. It must not open Settings. Show this guidance automatically when opening a workspace with no projects, allow dismissal, and close it after a project is selected or created. The sidebar also offers a Create project action to show the guidance again.

Users can close and reopen projects. Closed projects disappear from ordinary project selection and recent-project buttons. Closing retains notes and time records; closed projects remain included in applicable reports. A closed-project view allows reopening them. Closing a project is separate from closing a note tab.

## Notes and editing

Notes are ordinary UTF-8 Markdown or plain-text files that remain usable in external text editors. Existing `.txt` files in a project's notes directory appear in the tree and can be edited and saved. Markdown uses restrained source styling and syntax highlighting; `.txt` files do not receive Markdown formatting. No OS file associations or import flow are required.

Notes can be dragged onto a folder in the active project's tree, including collapsed folders, or onto Project root. Highlight drop targets and preserve filenames. Right-click a note for Rename / move, including notes that are not open; the existing note menu offers the same action. A new path can create nested folders. Save pending edits before moving; preserve open tabs, cursor positions, and recoverable drafts at the new path. Refuse to overwrite an existing destination and retain the original note on failure. Notes remain ordinary Markdown files.

Folders can also be dragged onto folders or Project root. Reject moves into the folder itself or its descendants and refuse to merge with existing destinations. Update descendant tab paths, cursors, pins, and pending drafts. The tree's note context menu includes Delete note/file (confirm and move to the OS bin), Open containing folder in the OS file explorer, Move to another project (choose another open project's root, preserving the filename), and Pin to top/Unpin. Pinned notes appear above the ordinary tree for their project, including notes in nested directories. Pins are machine-local UI preferences. Folder context menus offer Open folder and Delete empty folder; deletion may move an entire tree of empty subdirectories to the OS bin, but must refuse any contained file except WorkLog `.gitkeep` markers, including files not displayed by the app. Project roots cannot be moved or deleted.

Tabs support drag-and-drop reordering and a right-click Rename / move action for the clicked note. Preserve the active note and persist tab order. Split view and Vim bindings are not part of this change.

Closed fenced Markdown blocks whose language is `mermaid` render diagrams directly below their editable source. Support backtick and tilde fences, matching fence lengths, CRLF input, multiple diagrams, and normal-code fences containing Mermaid examples without rendering those examples. Do not render Mermaid in plain `.txt` files. Debounce updates while typing, show syntax errors as text below the source, adapt to the app's light/dark theme, and preserve note contents unchanged. The note's … menu includes Insert Mermaid diagram, which appends a starter block and selects its diagram source for immediate editing. Bundle and lazy-load Mermaid locally; serialize renders so diagrams cannot interfere with each other's configuration. Use strict rendering, disabled click callbacks/HTML labels, and display the rendered SVG through an image URL. Cancel pending work and release image URLs when previews are removed. Keep Mermaid instructions in documentation rather than the quick guided tour.

Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.svg`, `.ico`) and PDFs in a project's notes directory appear in the tree and quick switcher and open as read-only workspace tabs. Images support fit-to-window and zoom. PDFs use locally bundled PDF.js with a local worker, fonts, CMaps, ICC profiles, and decoders; support previous/next page, page-number entry, fit-width, zoom, and password prompts. No remote service, document scripting, annotation editing, or text selection is required. Show clear loading and file/render errors. Load binary contents on demand through a validated workspace-scoped command; snapshots carry only kind and revision metadata. Do not allow text saves to overwrite binary files or extension changes to mislabel media. Release object URLs, render tasks, and PDF workers on close or replacement. Existing move/rename, pin, delete, and backup behavior applies to these files and preserves their bytes. Changing files outside the app refreshes their metadata and viewer on the next workspace refresh.

- Prose wraps visually to the editor width without inserting hard line breaks.
- Fenced code blocks support unwrapped lines and horizontal scrolling for code, logs, and commands.
- Prose uses a regular reading font; blockquotes (including continuation lines) and code use a console/monospace font. Each blockquote and fenced code block stays within the available editor width and has its own horizontal scrollbar for long, unwrapped lines. Scrolling a block must not shift the surrounding note. Home/End navigate the actual line start/end and reveal the caret within the block; Shift extends the selection. Ctrl+Home/End still navigate the entire note.
- Standard selection, clipboard, undo/redo, and find operations work with familiar editor shortcuts.
- Notes autosave, with a quiet indication of save state and visible errors when a save fails.
- External file changes must not silently overwrite unsaved edits.

Mixed wrapping inside one document must be prototyped early to verify the editor implementation.

## Quick switcher and navigation

Ctrl+P opens a keyboard-driven quick switcher searching project names and note filenames. Results distinguish projects from notes and identify the owning project. Selecting a project activates it; selecting a note opens and focuses it and activates its project. Escape dismisses the switcher.

Use familiar code-editor conventions where applicable, including Ctrl+N for creating a note, Ctrl+F for searching the current note and Ctrl+W for closing the active note tab. The new-note dialog explicitly asks for a note name, defaults to the project root, and explains optional folder paths with an example. Enter creates and opens the note with the editor immediately focused for writing. App shortcuts must not interfere with normal typing or multiline input.

Ctrl+Shift+L toggles the docked time panel; Ctrl+Shift+T toggles the popup. Switching between the two preserves the same entry draft. These shortcuts operate while WorkLog has focus. Settings offers System, Light, and Dark appearance modes, remembered across restarts. Switching themes must preserve editor content, selection, and undo history. Keep interface copy functional, retaining only “Less friction. More focus.” in the empty workspace.

Dark mode uses neutral charcoal and grey surfaces and text, with restrained blue accents for focus and primary actions. Do not tint its backgrounds green. Editor syntax highlighting may retain token colors; Markdown headings and heading markers use neutral text with bold headings in both modes.

A Help action opens a replayable guided tour. Popups point at and highlight project selection, note/folder creation, editing and shortcuts, time logging, totals and corrections, the timer, reports, project closing/reopening, and settings/backups. Include Back, Next, Skip, and completion controls. Reveal the time panel and timer when necessary, then restore their previous visibility when the tour ends. The tour must not create or modify user data.

Help, Settings, and the final tour step link to a Keyboard shortcuts reference. F1 opens it by default. Users can reassign or clear app shortcuts and restore defaults; changes persist on the current machine. Reject duplicate bindings, unmodified typing keys, and reserved editing/window controls. Include common fixed editor/navigation shortcuts as a reference. App tooltips and tour instructions must display the current configured bindings. Customizing Find must route to the note editor's search and replace its previous app binding.

## Time entry

Time records are manual allocations of duration, not timer start/stop events. Each entry contains:

- Stable entry ID.
- Work date as an ISO calendar date (`YYYY-MM-DD`).
- Stable project ID.
- Duration stored as a positive integer number of minutes.
- Optional short free-text note, accepting multiple lines.

The form contains date, searchable/creatable project selection, free-form duration, a small optional multiline note field, and a submit button. Date defaults to today in the user's local timezone; project defaults to the active project. Duration accepts `45m`, `2h`, `1h 30m`, decimal hours such as `1.5h`, and hours:minutes such as `1:30` (90 minutes). Bare numbers such as `2` require a unit. Invalid or ambiguous input requires correction before submission; normalized duration is shown to the user. Durations must resolve to whole minutes; reject finer precision rather than silently rounding.

Recent-project buttons appear unobtrusively at the bottom. They select the form's project without navigating away from the note workspace.

Automatic date defaults follow the local calendar day across midnight and restart. Explicit date choices remain fixed; Use today returns to automatic dating. Preserve the date of legacy unfinished drafts whose intent is unknown.

After a successful entry, retain the chosen date and project, clear duration and note, and return focus to duration. Preserve unfinished form drafts when dismissed or restarted. Confirm success only after the entry has been saved locally, and prevent duplicate submission.

A collapsible recent-entry list supports reviewing, editing, and removing entries. Logged today displays today's overall total and a Details button. Details opens a date-scoped list with per-project totals and controls to edit each entry's date, project, duration, and optional note, or remove it after confirmation. The main time-entry draft is preserved while details are open. Recent entries use the same details editor for their work date. Successful changes immediately update totals and reports; failed saves retain the edit form.

The global Time history action in the top toolbar provides Monday–Sunday weekly pages across all projects, including closed projects, with previous/next week, This week, and Jump to date. Reuse the existing edit/remove operations and totals. Ask before discarding an open edit during weekly navigation.

## Optional timer

A small timer widget sits in a bottom corner and can be hidden. It has manual start, stop, and reset controls. It does not automatically create time entries. An action copies its duration into the time-entry form for review and submission. Hiding the widget must not silently reset it.

The timer tracks persisted start and stop timestamps. It continues across computer sleep and application closure until the user explicitly stops it. When reopened, the app calculates elapsed time from those timestamps, including time spent asleep or with the app closed, rather than counting UI ticks. This timer state is separate from the manual time-entry ledger.

## Data storage

Use one shared, directly editable plaintext JSON Lines file (`time.jsonl`) for all projects, alongside individual project directories and Markdown notes. Each line contains one current time entry. Use standard JSON parsing rather than a custom ledger grammar. There is no database.

Illustrative layout:

```text
work-data/
  .git/
  time.jsonl
  projects/
    <project-directory>/
      project.json
      notes/
        overview.md
        meetings/
          2026-10-17.md
```

Filenames and directory structure beyond these roles are implementation details. The app source repository and user data repository are separate. Machine-specific workspace state and rebuildable caches should stay outside the versioned user data.

Example creation record:

```json
{"type":"entry","id":"entry-001","projectId":"project-001","date":"2026-10-17","minutes":90,"note":"Reviewed drawings"}
```

Editing updates the existing entry while preserving its ID. Removing an entry removes its line. Validate records and replace the complete time file atomically, rejecting stale edits or removals when the entry has changed since it was opened. Git retains version history; do not add correction or void events to the live time file. The work date remains the date used for reports.

Data format version 2 uses current entries. On opening version 1 data, validate the original ledger, resolve replacement and void events, and migrate to current entries. Preserve the original plaintext file once at `.migration/time-v1.jsonl`, remove legacy event fields from current entries, and update `worknotes.json` to version 2. Migration must be safe to retry after interruption and must not reimport removed entries on subsequent opens. Invalid legacy data must remain untouched and report an error.

Writes must be serialized and durable before reporting success. Detect malformed records and interrupted final writes without silently discarding data. Save notes using a safe replacement strategy. A second app instance must not concurrently write the same data directory.

## Reports and exports

Users select an inclusive date range. Reports include all effective entries in that range, including records belonging to closed projects.

The required report content matches the readable report discussed:

- Selected date range.
- Entries grouped by project, with readable project names.
- Each entry's work date, duration, and note.
- Project subtotals.
- Overall total.

The app calculates totals deterministically in minutes and displays readable hours/minutes. Export reports as readable Markdown with project headings and simple entry lines in date, duration, note order. Do not use Markdown tables. Do not add blank lines between entries. Omit blank and whitespace-only lines from exported notes, trim trailing whitespace, and indent nonempty continuation lines to the note column. Include the individual time-entry notes alongside calculated totals. Structured JSON and CSV exports are outside the initial scope. No integrated LLM service is required initially.

Report entry format: date | Hh MMm | note. Always show hours and two-digit minutes, including zero values. Pad hours to the widest entry in the selected report so note columns align across projects. Align multiline note continuations with the note column.

The suggested export filename includes the selected inclusive range: `worklog-report_YYYY-MM-DD_to_YYYY-MM-DD.md`.

## Git history and backups

Git tracks project metadata, Markdown notes, and the shared time ledger. Commit time records promptly and group note autosaves into commits after an idle interval rather than committing every keystroke. Serialize Git operations with data writes where needed to produce coherent snapshots.

Maintain local Git history even when no remote is configured. Users can connect to an existing remote Git repository by entering its URL. The repository may be empty or already contain WorkLog data. For an empty repository, initialize local WorkLog data and push its history. For an existing WorkLog repository, clone it into a local data folder, validate its data format, and open its projects, notes, and time records. Do not overwrite an occupied local folder or automatically combine unrelated local and remote datasets.

Git backup means pushing committed history to the connected repository using existing Git authentication. Use Git credential helpers or SSH configuration rather than storing credentials in project files. Local history commits do not trigger external backups. Back up once daily at a configurable local time, default 17:00, using all configured destinations. Shortly after opening, catch up the latest missed scheduled backup. Compare current data contents and destination identity with the last completed backup and skip unchanged data. Persist the handled schedule slot and successful content fingerprint across restarts. Failed backups remain due, retry every 10 minutes while open, and display a persistent error until success. The app does not run a background service when closed. Keep a manual Back up now action. Do not create hosting accounts or remote repositories for the user. Git bundle exports are outside the initial scope.

As an alternative backup method, users can choose another filesystem location, including a mounted network drive. Copy a consistent snapshot of the WorkLog data files and local Git history to that location, replacing the previous backup rather than retaining dated snapshots. There are no backup retention settings; Git provides version history. Coordinate snapshot creation with saves and Git operations so the copy does not mix partially written files or repository operations. Stage the replacement before publishing it so an interrupted copy does not destroy the last successful backup. The backup destination must be outside the working data directory. The working data remains local regardless of backup method.

Distinguish saving files, committing history, and completing an external backup. A local commit alone is not an external backup. Show last successful backup and actionable failures without distracting routine notifications. Offline or unavailable backup destinations must not prevent local work; retry later.

Never automatically force-push or discard user data to resolve a Git error. Connecting to valid existing WorkLog history is supported; unexpected divergence after connection must preserve local data and produce an actionable error. A successful push provides an external copy of committed history. Restore a remote backup by cloning the data repository; restore a file-copy backup by copying the completed snapshot to a local data folder. Open and validate the recovered folder in WorkLog. Restore procedures for both methods must be documented and tested.

## Technology

Retain Tauri rather than Electron to avoid bundling Chromium and favor a lower application memory footprint. Windows and Linux remain the initial targets; mobile support is not part of the initial scope.

- Tauri 2 desktop shell.
- React, TypeScript, and Vite for the interface.
- CodeMirror 6 for note editing.
- CSS for application styling.
- Small Rust backend for safe file operations, ledger access, and Git integration.
- Git CLI for history and backups, with clear handling when Git is unavailable.

No SQLite database or hosted server is required. Any future cache must be reconstructible from source files.

## Windows and Linux delivery

Maintain one codebase and produce separate Windows and Linux packages. Development takes place on Windows. Hosted Linux CI builds and tests the Linux version; no local WSL or VM installation is required. The work laptop can validate a downloaded package without Codex installed.

Establish builds for both platforms early. Choose the initial Linux package and baseline to match the intended work laptop before release. Verify package installation without development tools, editor behavior, shortcuts, scaling, case-sensitive paths, Unicode filenames, file safety, Git/backups, and timer sleep/resume behavior.

The user believes the work laptop runs Ubuntu 20 (likely 20.04); the exact version needs confirmation. This introduces a stack compatibility decision: Tauri 2 requires WebKitGTK 4.1, and its documented standard build baselines include Ubuntu 22.04 and Debian 12. Do not claim stock Ubuntu 20.04 support or finalize Tauri packaging until the actual laptop version and a compatible deployment path are confirmed. Reference: https://v2.tauri.app/distribute/appimage/.

## Initial acceptance criteria

1. Windows and Linux builds are produced from the same source.
2. A user can create, select, rename, close, and reopen a project without losing records.
3. Notes can be organized in nested folders, save as Markdown, reopen correctly, and provide wrapped prose and unwrapped fenced blocks.
4. Ctrl+P finds and opens projects and notes by name.
5. A user can log `45m` or `1h 30m` with a date, project, and note using the compact form.
6. A restart preserves saved entries, note content, workspace state, and unfinished entry drafts.
7. Users can open today's details, edit and remove entries, and see correct totals and reports. Existing ledger data migrates without losing effective entries or original plaintext; stale edits and removals are rejected.
8. An inclusive date-range report exports Markdown containing the required entries, grouping, and totals.
9. The optional timer can be hidden and can populate a time entry without logging automatically.
10. Local Git history works without a remote. Users can connect to either an empty remote repository or an existing WorkLog data repository. Push backups have distinct success states from local commits, and push failures do not block local saving.
11. Users can alternatively back up by copying a consistent snapshot to another location, including a network drive. A failed copy preserves the last completed backup and does not block local saving.
12. Restore tests recover notes, time records, project metadata, and Git history from both remote and file-copy backups.



## Logbook and timesheet usability updates

Provide global literal, case-insensitive note-content search separately from filename/project navigation. Include Markdown/text files, closed projects and current unsaved drafts; exclude binary attachments. Show one first-match result per note with relative path, project, line and bounded excerpt. Open at the exact match, including when the note is already open. Show results in batches of 50 with a remaining count and Show more. Search must preserve drafts and never change note contents. Default shortcut: Ctrl+Shift+F.

Provide Today’s log above the note tree, with configurable Ctrl+Shift+D shortcut. In the active project, open `daily/YYYY-MM-DD.md` if it exists; otherwise present that local-date path selected in the standard note-name dialog. Enter accepts the path; typing replaces it. Preserve ordinary New note behavior, validation, conflict protection and editor focus.

Reports offer Today, Yesterday, This week and Last week presets, using local calendar dates and Monday–Sunday weeks. Keep inclusive From/Through fields editable. Append daily subtotals and per-day project totals to the preview and Markdown export, including 0m for empty dates. Grand totals count entries once. Disable export for invalid date ranges.

## Read-only LLM access

Expose a single authenticated MCP Streamable HTTP interface for local and reachable corporate-network harnesses. Provide paginated project discovery, time entries/totals, note metadata, literal content search, exact current/historical note reads and optional Git history. Supply raw evidence, source paths, timestamps and revisions; do not generate summaries, fetch URLs, invoke a model, or expose write/command execution tools. Git is optional; file/time queries continue without it, and absent history is explicit.

Sharing starts off, is controlled in Settings, and pins the selected workspace until restarted. Persist connection settings and a generated bearer token in machine-local settings outside work-data backups. Allow loopback HTTP; require TLS for a specific network-interface bind. Validate Host/Origin, require authorization, bound bodies/output/concurrency and reject traversal/symlink reads. Preserve source content, distinguish recording dates from work dates, and detect stale pagination. See docs/mcp.md for the implemented contract and limits.
