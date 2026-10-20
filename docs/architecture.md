# Architecture and invariants

WorkLog stores user records in a chosen workspace, separate from this source repository. The current supported workspace format is **3**; older formats are rejected without automatic migration. The [user guide](user-guide.md#workspace-format) describes the on-disk layout.

## Source map

| Area | Main files | Responsibility |
| --- | --- | --- |
| UI and state | `src/App.tsx`, `src/model.ts`, `src/taskSessions.ts` | Workspace state, time/report calculations, task-specific and global tab sessions. |
| Editor and navigation | `src/Editor.tsx`, `src/NoteTree.tsx`, `src/NoteTabs.tsx`, `src/notePaths.ts` | CodeMirror editing, tree/tab interactions, note navigation. |
| Overviews and time | `src/ProjectOverview.tsx`, `src/GlobalOverview.tsx`, `src/TimeDetails.tsx` | Unfinished note tasks and time-entry UI. |
| Desktop boundary | `src/api.ts`, `src-tauri/src/main.rs` | Typed frontend wrappers and Tauri command handlers. Browser preview rejects real workspace operations. |
| Storage and backup | `src-tauri/src/storage.rs`, `src-tauri/src/system_trash.rs` | Validated paths, workspace lock, atomic writes, ledger validation, Git history, backup/restore, OS trash. |
| Documents | `src/DocumentViewer.tsx`, `src/mermaid*.ts`, `scripts/pdf-assets.mjs` | Read-only image/PDF views, diagram rendering, locally bundled PDF resources. |
| Assistant access | `src-tauri/src/mcp.rs`, `src-tauri/src/evidence.rs`, `src/McpSettings.tsx` | Authenticated read-only MCP and evidence retrieval; see [MCP guide](mcp.md). |
| Reminders | `src-tauri/src/reminders.rs`, `src/ReminderSettings.tsx` | Opt-in native notifications, schedule validation, persisted daily deduplication. |
| Packaging | `src-tauri/tauri.conf.json`, `.github/workflows/build.yml` | App identity, CSP, installers, CI, and tag publication. |

## Data flow

React requests workspace actions through `src/api.ts`. Tauri command handlers run blocking storage/Git work off the UI thread. A shared mutex serializes workspace operations; an on-disk lock prevents another writer. Rust validates paths and persisted records, performs the mutation, and returns a snapshot for the UI. Documents are read on demand through a separate validated command. The frontend must not become an alternate unchecked filesystem route.

Notes remain Markdown/UTF-8 text, attachments keep their original bytes, and time records are JSON Lines. Task directories retain `projects/` and internal `projectId` names for compatibility. Reporting codes are independent of tasks. Global notes have a separate root; global tabs survive task switches, while task tab/editor sessions remain separate.

## Change constraints

- Preserve `worknotes` package/executable names, `local.worknotes.desktop`, storage keys, `worknotes.json`, and backup names unless an explicit compatibility design replaces them.
- Validate user-controlled paths at the Rust boundary, including traversal, workspace roots, symlinks, and source/destination collisions. Read-only MCP must not introduce mutation or arbitrary filesystem access.
- Preserve atomic writes, stale-edit protection, locking, and backup/restore integrity. Never silently discard malformed ledger data or bypass format validation.
- Git history and backups can retain deleted data. Test restore against a disposable destination and keep any destructive operation explicit.
- Preserve manual MCP startup, workspace pinning, bearer authentication, and secure network defaults. Review host/origin/TLS changes against [MCP documentation](mcp.md) and regression tests.
- Keep untrusted note/document rendering within the configured content security policy. Changes to Mermaid, PDF.js, SVG handling, or capabilities need a boundary review.
- Update `SPEC.md` and user documentation when changing established behavior; design documents may contain proposals and do not prove a feature has shipped.
