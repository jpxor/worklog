<div align="center">

# WorkLog

### Task notes and time tracking in a local desktop app

[Download](https://github.com/jpxor/worklog/releases/latest) · [Getting started](#getting-started) · [User guide](docs/user-guide.md) · [LLM connection](docs/mcp.md)

</div>

![WorkLog task overview with notes, unfinished tasks, and time entry](docs/screenshots/project-overview-light.png)

## Features

- **Global notes:** Keep shared notes in a separate workspace root, with tabs that remain open across task switches. Each task remembers its own tabs and editor positions.
- **Project codes:** Select or create independent reporting codes inline; each task supplies a default and each time entry keeps its own code.
- **Task notes:** Organize Markdown and text files by task and folder, create dated daily logs, and open multiple notes in tabs.
- **Unfinished tasks:** See unchecked Markdown tasks in the task overview and jump to their source notes.
- **Time tracking:** Enter durations such as `45m`, `1.5h`, or `1:30`, or copy elapsed time from the timer into an entry. Edit past entries by work date, task, and description.
- **Timesheets:** Review totals by project code, date, and task for a preset or custom date range, then export Markdown.
- **Search:** Search note text across tasks, including closed tasks, and open matching lines.
- **Attachments and diagrams:** View images and PDFs beside notes and render Mermaid diagrams in Markdown.
- **Appearance and shortcuts:** Choose light, dark, or system appearance and customize keyboard shortcuts.
- **Plain-text storage:** Notes are Markdown or UTF-8 text files; time entries are JSON Lines. Read your records with a text editor outside WorkLog.
- **Backups:** Keep local Git history and back up to a folder or Git remote, manually or on a daily schedule while the app is open.

## LLM connection

A compatible assistant can read your notes, time entries, and Git history through WorkLog's read-only MCP endpoint. Use it to summarize a period of work, find past decisions, or draft a performance review from your records.

Sharing is off at launch. Start it in **Settings → LLM data access (MCP)**. Connections require a bearer token; network connections require TLS unless you explicitly allow HTTP on a trusted private network. The assistant generates responses and uses its own connections to access linked tickets or documents.

See the [connection guide and tool reference](docs/mcp.md) for setup, supported tools, and retrieval examples.

## Screenshots

The workspace above uses light appearance; dark appearance is shown below.

![WorkLog dark workspace](docs/screenshots/project-overview-dark.png)

*Screenshots show the browser interface preview with bundled sample data. Saving notes and time requires the desktop app.*

## Getting started

Download the Windows installer or Linux DEB from the [latest release](https://github.com/jpxor/worklog/releases/latest). Portable archives include the executable and required licensing materials. Linux packages are built on Ubuntu 22.04 for x86-64; the standalone Linux binary requires GTK/WebKit runtime libraries. Windows operation is owner-confirmed; builds are unsigned. Ubuntu 22.04 installation testing is pending with public testers. Ubuntu 20.04 is unsupported and failed to install in owner testing. AppImage downloads are withheld pending native-library licensing review. macOS and ARM builds are unverified. WorkLog is early-stage software; back up your workspace before upgrading.

1. Launch the WorkLog desktop app and choose an empty local data folder, or open an existing WorkLog workspace.
2. Create a task and its default project code inline, then add a note or use **Today's log** to start a dated daily entry.
3. Write your notes. Add Markdown checkboxes for tasks you want listed in the task overview.
4. Log your time with a work date, task, project code, duration, and description.
5. Open **Reports** to review a period and export a Markdown timesheet.

The [user guide](docs/user-guide.md) covers shortcuts, attachments, time corrections, history, backups, and workspace recovery.

## Your data and backups

Format 3 adds `project-codes.json` and `global/notes/`, included in history and backups. Task paths and internal `projectId` references are retained. Only version-3 workspaces are supported; see [workspace format](docs/user-guide.md#workspace-format).

Task notes and time records use **plain-text storage** in a local folder you choose: Markdown and UTF-8 text files for notes, and JSON Lines in `time.jsonl` for time records. You can read these files outside WorkLog with a text editor. Image and PDF attachments retain their original formats. The workspace is separate from this application source repository.

WorkLog supports local Git history, scheduled backups to a Git remote or folder, and manual backups. Git history requires Git on your PATH. Scheduled backups run while the app is open, and remote backups use your existing SSH keys or Git credential helper.

Settings → Timesheet reminders lets you enable native OS notifications at a local time on selected weekdays. Reminders are off by default and require notification permission. Use Test notification to check delivery. Keep WorkLog open (minimized is fine); reminders do not run after quitting. A missed reminder is delivered when the app next runs on that selected day, with at most one scheduled notification per day across restarts. On Windows, test notifications from an installed build; system notification settings and Do Not Disturb can suppress banners.

See [history and backups](docs/user-guide.md#history-and-backups) for scheduling, restore steps, and what backups include.

## Development

Built with **Tauri 2, React 19, TypeScript, Rust, and CodeMirror 6**.

### Prerequisites

- Node.js **22.13 or newer** and npm.
- Git and a Rust toolchain.
- Windows: compatible C++ build tools and WebView2.
- Ubuntu 22.04: GTK/WebKit build dependencies listed in the [development guide](docs/development.md).

### Run locally

```sh
npm ci
npm run tauri dev
```

For an interface-only browser preview:

```sh
npm run dev
```

The browser preview uses sample data and cannot save a real workspace.

### Check and build

```sh
npm test
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run test:release
npm run release:check
npm run tauri build
```

The included [GitHub Actions workflow](.github/workflows/build.yml) runs checks and builds Windows NSIS installers and Ubuntu 22.04 DEB/AppImage packages. Local build output is under `src-tauri/target/release/`; packaged installers are under its `bundle/` directory. Ubuntu 20.04 compatibility is not verified.

See the [development guide](docs/development.md) for setup, the Windows helper script, checks, and packaging, and [architecture](docs/architecture.md) for module boundaries and workspace invariants.

Pushing a `vX.Y.Z` tag runs checks/builds and automatically publishes a GitHub release with installers, standalone binaries, and SHA-256 checksums. All npm/Cargo/Tauri version metadata and release notes must agree. Follow the [release guide](docs/releasing.md) for version updates, release notes, testing, publication, and recovery.

The GitHub Pages source is in [`site/`](site/). With Pages enabled using GitHub Actions in repository settings, the **Deploy project page** workflow automatically deploys changes to `site/`, its source screenshot (`docs/screenshots/project-overview-light.png`), or the Pages workflow when pushed to `main`. The workflow can also be run manually. Release tags do not deploy the site.

## Contributing and support

See [CONTRIBUTING.md](CONTRIBUTING.md) for expected development practices, bug reports, pull requests, and review. Use [GitHub Issues](https://github.com/jpxor/worklog/issues) for ordinary bugs and feature requests, with sanitized examples. Follow [SECURITY.md](SECURITY.md) for suspected vulnerabilities and [privacy](docs/privacy.md) for data handling. Maintainers respond as time permits.

## License

Original WorkLog code, documentation, and original assets are licensed under [Apache-2.0](LICENSE). Third-party components and imported material retain their own licenses and notices. See [third-party notices](THIRD-PARTY-NOTICES.txt) and the [distribution materials guide](docs/third-party.md). The [publication readiness checklist](docs/open-source-readiness.md) records remaining installer and native-library verification.

## Documentation

- [User guide](docs/user-guide.md) — everyday workflows, shortcuts, data formats, and backups.
- [Contributing](CONTRIBUTING.md) and [development](docs/development.md) — setup, practices, checks, and review.
- [Release guide](docs/releasing.md) and [release notes](docs/release-notes.md) — versioning, publication, and changes.
- [Publication readiness](docs/open-source-readiness.md) — remaining owner audits and GitHub configuration.
- [LLM connection guide](docs/mcp.md) — MCP setup, authentication, tools, and retrieval examples.
- [Product specification](SPEC.md) — requirements and implementation context.
- [Task review design](docs/project-review.md) — review evidence, current capabilities, and proposed workflows.

<details>
<summary>Compatibility with earlier WorkNotes versions</summary>

WorkLog was previously named WorkNotes. The application identity and backup destination names are retained; this build requires workspace format 3. Internal package/executable names, application identifiers, storage keys, the `worknotes.json` marker, and the `WorkNotes-backup` folder retain their original names to preserve existing workspaces.

</details>
