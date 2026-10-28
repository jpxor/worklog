# Release notes

Add user-facing changes to Unreleased. Maintainers move them into a version section before tagging; see [releasing](releasing.md). The release workflow publishes only the matching version section and shared download guidance below.

## Unreleased

- Simplify note/folder creation to a name field and destination label. New note uses the current task; create global notes from Global notes.

- Keep text selection visible through fenced code-block backgrounds in both appearances (#25).

- Limit new note/folder destinations to the active task and Global notes. Switch tasks before creating content for another task (#24). Workspace data is unchanged.

- Keep the start of long filenames visible in tabs and truncate the end with an ellipsis (#23).

- Fix dark-mode contrast in the Create note/folder destination dropdown (#22). Workspace data is unchanged.

- Reduce CI work: test/build the frontend once, skip installer packaging on PRs, skip expensive desktop work for documentation-only changes, cancel superseded PR runs, and publish verified packages from the exact tagged commit without rebuilding. Keep package artifacts seven days and temporary frontend artifacts one day. Security and platform-specific Rust checks remain enabled.
## 0.2.0

- Show a workspace-first welcome state. Task/note creation, search, reports, time logging, and their shortcuts open folder selection until a workspace is open; cancelling leaves the welcome state intact.
- Rename the executable/package to `worklog` and use WorkLog consistently for app identity, settings keys, workspace markers, locks, backups, packaging, and documentation. Earlier app settings and UI preferences are not imported. Existing version-3 workspaces require a manual marker update; see the user guide. Notes and time records are unchanged.
- Associate Linux windows with the installed WorkLog launcher and icon on GNOME/Wayland. Use the DEB for desktop integration.
- Add Ubuntu 24.04 installation, reinstallation, runtime dependency and removal checks for the same package built on Ubuntu 22.04. Graphical launch and dock behavior still need desktop smoke testing.
- Since the last published release (0.1.27): disable Git hooks and external filesystem monitors during app Git operations. Block remote backups when effective push destinations differ from the configured URL; saving backup settings repairs local push URLs. File-copy backups continue when remote backup is blocked.
- Upgrade note: this release does not import earlier settings or UI preferences. Back up existing workspaces and update their root marker to `worklog.json` with `{"format":"worklog","version":3}` before opening; see the user guide. Do not run earlier builds against the same folder concurrently.

## 0.1.28

- Disable Git hooks and external filesystem monitors during app Git operations. Block remote backups when effective push destinations differ from the URL shown in Settings; saving backup settings replaces local push URLs with the selected destination. File-copy backups still run when a remote is blocked. Whole-workspace backup coverage and workspace format 3 are unchanged; no migration is required.

## 0.1.27

- Update rustls-webpki and webpki-root-certs to fix the certificate trust issues reported as RUSTSEC-2026-0382 and RUSTSEC-2026-0383.

- Include complete dependency/asset notices and Liberation font/MPL corresponding sources in installers and portable archives. Windows portable downloads use ZIP so licensing materials accompany the executable.
- Add automated license freshness, secret and dependency-security checks.
- Withhold AppImage downloads pending the bundled native-library licensing review; provide Ubuntu 22.04 DEB and portable archives.
- Windows operation is owner-confirmed. Ubuntu 22.04 installation testing is pending with public testers; Ubuntu 20.04 installation failed and is unsupported. Additional installation testing was waived by the owner for this tester launch.
- Workspace format 3 is unchanged; no migration is required.

## 0.1.26

- Since the last published release (0.1.21): add tasks with independent project codes, global notes, per-task tab sessions, and updated reports/MCP tools. Require workspace format 3; older formats are rejected without automatic migration.
- Include Project/Day/Task report views, copy-success feedback, sidebar and time-entry refinements, and the editor search layout fix prepared in versions 0.1.22–0.1.25.
- Add optional private-network HTTP for MCP; TLS remains the default for network sharing and is required for public interface addresses.
- Add opt-in native timesheet reminders with weekday and local-time settings, a test notification, and at most one scheduled notification per day across restarts. WorkLog must remain open; Windows notifications should be tested from an installed build.
- Add contributor and development guides, issue/PR templates, Apache-2.0 licensing, and a documented release process with version and release-note validation.
- Harden release automation with pinned Actions, dependency-update checks, and enforcement that release commits belong to main. Assemble release assets in a draft before automatic publication.
- Update the Vitest development test runner to a patched 4.1 release, resolving the npm audit findings in the previous test-tool dependencies.
- Workspace compatibility: format 3 is unchanged; no migration is required for existing format-3 workspaces.
- Validation: Windows and Linux automated checks and packaging run in CI. Clean-machine installation, upgrade, and installed notification delivery remain unverified; builds are unsigned on Windows.

## 0.1.25

- Confirm successful report copying with a brief Copied! message on the Copy button. Reset the confirmation when the report changes or closes.

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

<!-- release-downloads -->

## Downloads

| Platform | File | Use |
| --- | --- | --- |
| Windows x64 | `*_x64-setup.exe` | Installer; recommended for Windows. |
| Windows x64 | `WorkLog-windows-x64.zip` | Portable archive with executable, licenses and corresponding source; requires WebView2. |
| Linux x86-64 | `*.deb` | Recommended Ubuntu installer, built on Ubuntu 22.04; install or upgrade with `sudo apt install ./FILENAME.deb`. |
| Linux x86-64 | `WorkLog-linux-x64.tar.gz` | Standalone executable; requires GTK 3 and WebKitGTK 4.1 runtime libraries. |
| All | `SHA256SUMS.txt` | SHA-256 checksums for the files above. |

Windows builds are unsigned. Linux builds target Ubuntu 22.04; Ubuntu 20.04 is unsupported (installation failed in owner testing). Ubuntu 22.04 installation testing is pending with public testers. Automated checks run before publication; they do not replace installation testing on your machine.

On first launch, choose an empty local data folder or an existing WorkLog workspace. This build requires format 3; older workspaces are not upgraded on opening.

See the [user guide](https://github.com/jpxor/worklog/blob/main/docs/user-guide.md) for setup, backups, and recovery, and the [MCP guide](https://github.com/jpxor/worklog/blob/main/docs/mcp.md) for assistant connections.
