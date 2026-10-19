## 0.1.24

- Add an opt-in Allow HTTP on a private network setting for remote MCP access without certificate files. TLS remains the default for network sharing, and public interface addresses still require TLS.
- Include tasks, independent project codes, per-task tab sessions, global notes and their overview, and updated reports and MCP tools.
- This build requires a format-3 workspace; older workspace formats are not upgraded automatically.

## 0.1.23

- Rename the Settings backup section to "Git repository Backup".

## 0.1.22

- Fix the note editor's Ctrl+F panel so search checkboxes stay beside their labels and search fields remain compact.
- Add Project, Day, and Task report views with bracketed durations, indented notes, and matching copy/export output.
- Simplify the sidebar with Global notes first and collapsed at startup, date suggestions for new global notes, and a cleaner creation dialog.
- Move Time history into the Log time panel in place of Recent entries.
- Simplify Log time with Date and Duration side by side, a conditional Use today action, and an inline Use current task action. Widen the popup while keeping the docked panel compact.

## Tasks and project codes (included in 0.1.24)

Tasks own separate note/tab sessions. Independent project codes classify each saved entry, with inline creation and task defaults. Global notes have their own workspace root and overview; global tabs survive task switching. Reports combine only entries sharing code, task, and date, preserving compact multiline descriptions. MCP uses list_tasks, taskId, list_project_codes, and explicit note scopes.

Format 3 includes project-codes.json and global/notes/ in backups and history. Older formats are rejected on opening. Workspace upgrade tooling has been removed. Automated checks cover the implementation; clean-machine installation has not been verified.

Task notes and time tracking in a local desktop app.

- Organize Markdown notes and daily logs by task, search their text, and collect unfinished checkbox tasks in task overviews.
- Record time manually or from the timer; export daily and task totals as Markdown timesheets.
- Keep data in plain-text files: Markdown/UTF-8 notes and a JSON Lines time ledger. Image and PDF attachments retain their original formats.
- Keep local Git history and back up to a folder or Git remote, manually or on a daily schedule while the app is open. Git history and remote backups require Git.
- Optionally connect an assistant through the authenticated, read-only MCP endpoint. Sharing is off at launch.

## Downloads

| Platform | File | Use |
| --- | --- | --- |
| Windows x64 | `*_x64-setup.exe` | Installer; recommended for Windows. |
| Windows x64 | `WorkLog-windows-x64.exe` | Standalone app executable; requires WebView2. |
| Linux x86-64 | `*.deb` | Debian/Ubuntu package, built on Ubuntu 22.04. |
| Linux x86-64 | `*.AppImage` | AppImage; mark executable before launching. |
| Linux x86-64 | `WorkLog-linux-x64.tar.gz` | Standalone executable; requires GTK 3 and WebKitGTK 4.1 runtime libraries. |
| All | `SHA256SUMS.txt` | SHA-256 checksums for the files above. |

Windows builds are unsigned. Linux builds target Ubuntu 22.04; Ubuntu 20.04 compatibility and clean-machine installation have not been verified. Automated checks run before publication; they do not replace installation testing on your machine.

On first launch, choose an empty local data folder or an existing WorkLog workspace. This build requires format 3; older workspaces are not upgraded on opening.

See the [user guide](https://github.com/jpxor/worklog/blob/main/docs/user-guide.md) for setup, backups, and recovery, and the [MCP guide](https://github.com/jpxor/worklog/blob/main/docs/mcp.md) for assistant connections.
