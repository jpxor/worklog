# WorkLog

A local work logbook for project notes, tests, outcomes, and time tracking. Built with Tauri 2, React, TypeScript, and CodeMirror 6. The product requirements are in [SPEC.md](../SPEC.md).

WorkLog was previously named WorkNotes. Existing data, settings, drafts, and backup destinations remain compatible. The internal application identifier, storage keys, `worknotes.json` data marker, and `WorkNotes-backup` directory keep their original names so the rename does not create a separate workspace or backup. The internal executable/package name remains `worknotes`.

## Development

Install Node.js 22.13 or newer, Git, and Rust. On Windows, use Rust MSVC with Visual C++ build tools or Rust GNU with a compatible MinGW compiler. Windows also requires WebView2. On Ubuntu 22.04 install:

```sh
sudo apt-get update
sudo apt-get install -y build-essential curl libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

Then:

```sh
npm ci
npm run tauri dev
```

`npm run dev` opens only an interface preview. It cannot access or save real data; use the Tauri command for the local application.

On this Windows development computer, Rust GNU and MSYS2 GCC are available. `./scripts/desktop.ps1 dev` adds their locations to the current process PATH and starts the desktop app. Use `./scripts/desktop.ps1 build` to produce a Windows installer. This script does not change the machine's permanent PATH.

## Build and checks

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build -- --no-bundle
```

The executable is in `src-tauri/target/release/`. To package locally on Windows, run `npm run tauri build -- --bundles nsis`; the installer is under `src-tauri/target/release/bundle/nsis/`. The included GitHub Actions workflow builds Windows installers and Ubuntu 22.04 DEB/AppImage packages when the source is hosted on GitHub. Clean-machine installation checks are separate release steps. The Linux executable requires its GTK/WebKit runtime libraries.

**Ubuntu 20.04 is not yet a verified target.** Tauri 2 requires WebKitGTK 4.1. Do not assume a binary built on Ubuntu 22.04 works on 20.04. Confirm the work laptop's version and verify a suitable packaging/runtime approach before release.

## Using WorkLog

Click the project name at the top of the notes tree to open its overview. Notes containing unfinished Markdown checkboxes (`- [ ] Follow up`) appear first, with the most recently edited notes first in each group. Check an item directly to update its original note, or click its text to open the note at that line. Note titles open their files. The overview stays stationary while you use it; completed items remain visible until you leave and reopen it. Dates come from file modification times and can change when files are copied or cloned. There is no separate task store.

1. Choose an empty local data folder or open existing WorkLog data.
2. Type a project name into the project field and select Create (or press Enter).
3. Press Ctrl+N or use + to add a note. Enter its name and press Enter to start writing immediately. Notes default to the project root; optionally enter a path such as `meetings/planning.md`. Add folders from the sidebar. Prose wraps in a regular reading font; blockquotes and fenced code use monospace and stay within the editor width. Each block scrolls its own long lines horizontally without moving the rest of the note.
4. Use Ctrl+P to find a project or note; Ctrl+F searches a note, Ctrl+W closes its tab.
5. Log a date, project, duration (`45m`, `1.5h`, `1:30`), and optional note.
6. Use Reports to choose inclusive dates and export Markdown.

Ctrl+Shift+L toggles the docked Log time panel; Ctrl+Shift+T toggles its popup. Both keep the current entry draft. These are app shortcuts, not system-wide shortcuts. Settings → Appearance offers System, Light, and Dark modes; the choice persists across restarts and includes the notes editor.

Help starts a guided tour with popups pointing at the main features. Use Back/Next, Skip, or Escape, and replay it whenever needed. Creating your first project is guided directly at the project selector rather than through Settings.

Help → Keyboard shortcuts, Settings → Keyboard shortcuts, or F1 opens the shortcut reference. The final tour step also links there. Click an app shortcut and press a new combination to change it, or clear it; duplicate assignments and reserved editing keys are rejected. Changes save automatically on this computer. Reset to defaults restores the original bindings. Common fixed editing/navigation controls are listed below the app shortcuts. Tooltips and tour text show your chosen bindings.

The corner timer records start/stop timestamps, including elapsed time while asleep or closed. Use time copies whole elapsed minutes into the form; it never logs automatically. Stop before starting another interval. Reset clears only timer state.

Notes save after a short idle interval. External modifications cause a save conflict instead of overwriting another edit; the current draft remains in the editor. Logged today shows the total and a Details button. Details lists that date's time entries and project totals; edit the date, project, duration, or note, or remove an entry. Recent-entry Edit opens the same editor for that entry's date.

Time remains plaintext in `time.jsonl`, with one current JSON entry per line. Edits update the same ID and removals delete the entry; the complete file is replaced atomically. Git retains previous versions. Stale edits/removals are rejected rather than overwriting newer changes. Incomplete time-file lines are reported without silently repairing or deleting them.

Version 0.1.5 upgrades data from format 1 to format 2 on opening. It resolves earlier correction/void events into current entries and preserves the original file at `.migration/time-v1.jsonl`. Project notes are unchanged. Format 2 data should be opened with WorkLog 0.1.5 or later; earlier versions reject the newer format.

## Notes and diagrams

Mermaid diagrams render directly below fenced `mermaid` blocks in Markdown notes. Use the note's **… → Insert Mermaid diagram** action to insert a starter block, or type:

````markdown
```mermaid
flowchart LR
    Plan --> Work --> Review
```
````

The source remains editable plaintext, and the preview updates after a short typing pause. Diagrams follow the app theme and work offline. Syntax errors appear beneath the source without changing it. `.txt` files keep this syntax as ordinary text.

Notes support `.md` and UTF-8 `.txt` files inside each project's `notes` directory. Files added there using the OS appear on the next workspace refresh (the background check runs every 30 seconds). Right-click notes for rename/move, deletion, opening the containing folder, moving to another project, or pinning to the top of the tree. Right-click folders to open them or delete empty directory trees. Drag folders or notes onto folders or Project root; occupied destinations are never overwritten. Tabs can be reordered by dragging and renamed through their context menu. Markdown exports suggest a filename containing the selected date range.

Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.svg`, `.ico`) and `.pdf` files in the same notes directory open in read-only workspace tabs. Images support fit and zoom; PDFs support page navigation, fit-width, zoom, and passwords. Files are read on demand and released when their viewer closes. Binary files can be renamed (preserving their extension), moved, pinned, and deleted through the OS Recycle Bin/Trash. They are included in ordinary backups. PDF viewing uses bundled PDF.js, fonts, character maps, and decoders; it does not need internet access. The current PDF view renders pages without text selection or annotation editing. `npm run dev` and `npm run build` prepare the bundled PDF assets automatically.

## History and backups

The data folder is a separate Git repository. Git commits use a local WorkLog identity. Files save even if Git is missing; the status reports history errors. Background local history commits run every 30 seconds, without pushing or copying backups. Git must be on PATH for Git history and remote backups. WorkLog uses configured SSH keys or Git credential helpers and disables interactive credential prompts; authenticate with your provider outside the app first.

External backups run once daily at the local time selected in Settings (default 17:00). While the app is open, the schedule is checked every 30 seconds. A background check shortly after startup catches up the most recent missed daily backup, including before today's scheduled time. WorkLog compares data contents with the last completed backup and skips unchanged data. Both configured destinations are attempted. Failed backups remain due and retry every 10 minutes while open; the status bar and Settings show the error. Back up now remains available. The app must be open to perform a backup; no separate service runs when it is closed. Backup progress and the last successful content fingerprint are kept in machine-local settings.

Settings can connect a remote to the current workspace, or clone an empty/existing WorkLog repository into a new local folder. Remote changes are not automatically merged and force-push is never used. A rejected push leaves local records intact.

Alternatively choose a backup parent folder, including a mounted network location. Back up now writes `WorkNotes-backup` inside it, including Git history. It stages the new copy before replacing the old backup. It retains one completed snapshot. If replacement is interrupted, inspect the `.previous` directory before retrying. Keep this destination outside the working data folder.

Restore a remote backup by cloning it through Settings. Restore a file backup by copying `WorkNotes-backup` to a local directory and choosing that folder. The app validates its format and ledger on opening.

Deletion asks for confirmation and moves files or empty folders to the OS Recycle Bin/Trash. Recover them using the OS file manager. If recycling fails, WorkLog asks separately before permanent deletion. New deletions create no private `.trash` copies. Legacy `.trash` folders from earlier versions are left for the user to manage; Git and older backups may already retain previous versions.

Workspace tabs/cursors, time-entry drafts, unsaved note recovery drafts, and timer state are machine-specific and stored in the webview's local storage, outside Git. Backups cover project data and history, not machine UI state.



## Review and development history

The [goal assessment and performance-review evidence design](project-review.md) describes current capabilities, gaps, and a proposed retrieval workflow. Time history in the top toolbar browses all projects by Monday–Sunday week with a date jump and entry editing. The time form follows local today unless you explicitly choose a date; Use today resumes automatic dating. Existing saved entries are never automatically redated. Markdown headings and their markers use neutral text in both appearance modes.

Keep source changes in focused commits with relevant checks. This source repository is separate from the app’s work-data repository; configuring data backups does not back up the application source.

## Finding notes, daily logs, and timesheets

**Search notes** in the top toolbar (Ctrl+Shift+F by default) searches literal text case-insensitively across Markdown/text note bodies in all projects, including closed projects and unsaved drafts. Results show the relative path, project, line number, and a bounded snippet. Open a result to jump to its first match; Ctrl+F searches further within the note. Results initially show 50 matching notes; Show more reveals the next 50. Images/PDFs are not searched. Ctrl+P remains the filename/project switcher. Both shortcuts can be changed in Keyboard shortcuts.

**Today’s log** above the notes tree (Ctrl+Shift+D by default) suggests `daily/YYYY-MM-DD.md` in the active project using the local date. The full path is selected: press Enter to create it, or type another name. If that daily note already exists, the action opens it directly. Ordinary New note keeps its existing behavior. New shortcut defaults that overlap older custom bindings are left unassigned so existing preferences survive.

**Reports** offers Today, Yesterday, This week, and Last week presets. Weeks run Monday–Sunday; From/Through stay editable for other timesheet periods. The preview and Markdown export retain entry descriptions and project totals, and add daily totals with project breakdowns. Dates without entries show 0m so gaps remain visible. Daily breakdowns are another view of the same entries and are not added again to the grand total.

## LLM data access

Settings → LLM data access (MCP) starts an authenticated, read-only Streamable HTTP endpoint. Local and corporate-network LLM harnesses use the same tools to query project/time data, search/read saved notes, and inspect optional Git history. WorkLog supplies raw data; the harness creates summaries and retrieves external links. Git is optional. Sharing starts manually and is pinned to one workspace. Network access requires a TLS certificate. See the [connection guide and tool reference](mcp.md).

