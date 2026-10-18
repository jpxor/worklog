Project notes and time tracking in a local desktop app.

- Organize Markdown notes and daily logs by project, search their text, and collect unfinished checkbox tasks in project overviews.
- Record time manually or from the timer; export daily and project totals as Markdown timesheets.
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

On first launch, choose an empty local data folder or an existing WorkLog workspace. Existing WorkNotes workspaces remain compatible.

See the [user guide](https://github.com/jpxor/worklog/blob/main/docs/user-guide.md) for setup, backups, and recovery, and the [MCP guide](https://github.com/jpxor/worklog/blob/main/docs/mcp.md) for assistant connections.
