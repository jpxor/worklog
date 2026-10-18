<div align="center">

# WorkLog

**Your projects. Your progress. Your working memory.**

A personal logbook for keeping track of your projects, work notes, and time.

**Desktop app · Local files · Markdown notes · Time reports · LLM connection**

[Getting started](#getting-started) · [Screenshots](#screenshots) · [User guide](docs/user-guide.md) · [LLM connection](docs/mcp.md)

</div>

![WorkLog project overview with notes, unfinished tasks, and time entry](docs/screenshots/project-overview-light.png)

## Keep the story behind your work

WorkLog brings project notes and time records together, so you can capture what happened today and recall the details months later.

| Capability | What you can do |
| --- | --- |
| **Project logbook** | Capture daily progress, investigations, meetings, decisions, outcomes, challenges, and lessons learned. Keep related notes together and link to tickets, merge requests, and supporting documents. |
| **Time tracking** | Record time spent on projects, with work dates and descriptions. Review and correct past entries. |
| **Reports** | Generate daily, weekly, or custom-period reports with work descriptions and time totals for timesheets and longer-term reference. |
| **Search and recall** | Find information across project notes and revisit past work. |
| **LLM connection** | Let a connected assistant retrieve relevant logbook data to summarize work, answer questions, and help prepare for reviews and check-ins. |

## From daily notes to useful evidence

- **Write in context.** Organize Markdown and text notes by project and folder, create dated daily logs, and keep several notes open in tabs.
- **See what needs attention.** Project overviews gather unfinished Markdown checkboxes and link back to the original notes.
- **Record time your way.** Enter durations such as `45m`, `1.5h`, or `1:30`, or use the timer to fill a time entry. Browse and correct earlier entries.
- **Prepare timesheets.** Choose Today, Yesterday, This week, Last week, or your own date range; review daily and project totals and export Markdown.
- **Keep supporting material close.** View images and PDFs alongside notes, and render Mermaid diagrams directly in Markdown.
- **Make it comfortable.** Choose light, dark, or system appearance and customize app keyboard shortcuts.

## Connect an assistant to your logbook

WorkLog includes an authenticated, read-only MCP endpoint. With a compatible connected assistant, you can:

- Summarize a project or your work over a selected period.
- Search for information and answer questions about past work.
- Identify accomplishments, challenges, decisions, and learning.
- Help answer performance-review and check-in questions.
- Combine logbook evidence with linked external information when the assistant has access.

WorkLog supplies the underlying records; the connected assistant creates summaries and accesses external sources using its own connections. Sharing starts manually in **Settings → LLM data access (MCP)**. Local connections use a bearer token; network connections also require TLS.

See the [connection guide and tool reference](docs/mcp.md) for setup, supported tools, and retrieval examples.

## Screenshots

### Light workspace

The project overview gathers notes and unfinished items beside the time-entry panel.

![WorkLog light workspace](docs/screenshots/project-overview-light.png)

### Dark workspace

The same workspace with dark appearance enabled.

![WorkLog dark workspace](docs/screenshots/project-overview-dark.png)

*Screenshots show the browser interface preview with bundled sample data. Saving notes and time requires the desktop app.*

## Getting started

1. Launch the WorkLog desktop app and choose an empty local data folder, or open an existing WorkLog workspace.
2. Create a project, then add a note or use **Today's log** to start a dated daily entry.
3. Capture progress, decisions, and links as you work. Add Markdown checkboxes for follow-ups.
4. Log your time with a work date, project, duration, and description.
5. Open **Reports** to review a period and export a Markdown timesheet.

The [user guide](docs/user-guide.md) covers shortcuts, attachments, time corrections, history, backups, and workspace recovery.

## Your data and backups

Project notes live in local Markdown and UTF-8 text files; time records live in `time.jsonl`. The workspace is separate from this application source repository.

WorkLog supports local Git history, scheduled backups to a Git remote or folder, and manual backups. Git history requires Git on your PATH. Scheduled backups run while the app is open, and remote backups use your existing SSH keys or Git credential helper.

See [history and backups](docs/user-guide.md#history-and-backups) for scheduling, restore steps, and what backups include.

## Development

Built with **Tauri 2, React 19, TypeScript, Rust, and CodeMirror 6**.

### Prerequisites

- Node.js **22.13 or newer** and npm.
- Git and a Rust toolchain.
- Windows: compatible C++ build tools and WebView2.
- Ubuntu 22.04: GTK/WebKit build dependencies listed in the [development guide](docs/user-guide.md#development).

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
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

The included [GitHub Actions workflow](.github/workflows/build.yml) runs checks and builds Windows NSIS installers and Ubuntu 22.04 DEB/AppImage packages. Local build output is under `src-tauri/target/release/`; packaged installers are under its `bundle/` directory. Ubuntu 20.04 compatibility is not verified.

On the original Windows development setup, `./scripts/desktop.ps1 dev` and `./scripts/desktop.ps1 build` configure the available Rust/MSYS2 paths for the current process. See the [build guide](docs/user-guide.md#build-and-checks) for details.

## Documentation

- [User guide](docs/user-guide.md) — everyday workflows, shortcuts, data formats, and backups.
- [LLM connection guide](docs/mcp.md) — MCP setup, authentication, tools, and retrieval examples.
- [Product specification](SPEC.md) — requirements and implementation context.
- [Project review design](docs/project-review.md) — review evidence, current capabilities, and proposed workflows.

<details>
<summary>Compatibility with earlier WorkNotes versions</summary>

WorkLog was previously named WorkNotes. Existing data, settings, drafts, and backup destinations remain compatible. Internal package/executable names, application identifiers, storage keys, the `worknotes.json` marker, and the `WorkNotes-backup` folder retain their original names to preserve existing workspaces.

</details>
