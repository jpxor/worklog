# Querying WorkLog from an LLM harness

WorkLog exposes one **read-only MCP Streamable HTTP endpoint** for local desktop harnesses and reachable corporate-network LLM servers. The model can discover and retrieve raw task data for any user question. WorkLog does not call an LLM, generate summaries, fetch external links, or let clients execute commands or edit files. There is no separate local/remote tool implementation.

## Connect locally

1. Open a data workspace in the desktop app.
2. Open **Settings → LLM data access (MCP)**. Leave Listen IP at `127.0.0.1` and the default port `43127`, or choose a free port.
3. Click **Start sharing**. Copy the saved MCP endpoint and reveal/copy the bearer token into your harness's secret/header settings.
4. Configure the harness for **Streamable HTTP**, with URL `http://127.0.0.1:43127/mcp` and header `Authorization: Bearer <token>`. Token-only fields should receive just the token.
5. Ask the harness to list the server's tools, then query the workspace.

The harness must support HTTP MCP servers and configured bearer headers. A stdio-only harness needs its own HTTP adapter; WorkLog does not offer a second stdio interface. Clients requiring an OAuth login flow cannot use this static-token service without an appropriate corporate gateway. No provider-specific configuration file format is assumed.

## Connect from a corporate LLM server

Use the same endpoint and tools. In Settings, enter this computer's **specific corporate interface IP** rather than a wildcard. Supply full local paths to a PEM TLS certificate chain and private key, then start sharing. For example, an interface at `10.20.30.40` gives `https://10.20.30.40:43127/mcp`.

The certificate must cover the IP/hostname used by the client, and the LLM backend must trust its issuer. If using a corporate DNS name, add that name under Additional hostnames and configure the harness with that hostname in its URL. The backend must be able to reach the chosen IP and port; being able to reach it from your browser alone does not prove backend connectivity. Firewall configuration, certificates and corporate routing are managed outside WorkLog. WorkLog does not create firewall rules, tunnels or public hosting.

Network listeners require TLS by default. For a trusted private network or encrypted VPN, you can instead enable **Allow HTTP on a private network** and leave both TLS file fields blank. This permits HTTP only when binding to a private IPv4 address (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) or an IPv6 unique-local address (`fc00::/7`). For example, use `http://192.168.1.20:43127/mcp`. HTTP sends the bearer token and workspace data without encryption; the address restriction does not establish that a network is trustworthy. Public interface addresses still require TLS. The option defaults off, is saved locally, and does not change token authentication or Host/Origin checks. Supplying both TLS files always selects HTTPS, even with the option enabled. Supplying only one TLS file is rejected. Loopback HTTP remains available without this option. IPv4 and IPv6 interface addresses are supported. For IPv6, bracket the address in client URLs. A client on the same computer can also use the network endpoint, provided it trusts the certificate.

Origin validation rejects all browser Origin headers unless explicitly allowlisted. Usually leave Allowed browser origins empty: backend MCP clients normally send no Origin header. Allowed origins are exact scheme/host/port values; omitted ports mean the scheme default. These settings do not add browser CORS support: use the LLM tool backend, not arbitrary website JavaScript, to connect.

## Available tools

| Tool | Data returned |
| --- | --- |
| `list_tasks` | Current task IDs/names/closed state, matching time totals and work-date bounds, note counts, and file-date evidence. Optional `includeGit` adds commit evidence. All current tasks remain discoverable even when no timestamps match. |
| `list_project_codes` | Reporting code IDs, current labels, and archived status. |
| `list_time_entries` | Individual allocations, dates, descriptions and task IDs, with task/code identities and overall, `taskTotals`, and `projectCodeTotals` calculated over the entire matching set. Filter by `taskId` and/or `projectCodeId`. |
| `list_notes` | Saved paths, task IDs, file creation/modification timestamps, kinds, sizes and revisions. Includes attachment metadata, not attachment bytes. |
| `search_notes` | Literal case-insensitive matches in saved Markdown/text notes, one match per matching line, with path, line, character column, bounded excerpt and note revision. |
| `read_note` | Exact note text in character pages with line references, revision and continuation offset. Optional full Git commit SHA reads an earlier version, including a deleted note. |
| `list_history` | Git commits, author/commit timestamps, subjects and changed note paths. Scope to a task or path, optionally within a date range. Renames are shown as old/new paths. |

Tools accept only their documented schema fields. The server advertises read-only, non-destructive tool annotations. File reads are restricted to task and global notes, traversal and symbolic links are rejected, and Git arguments are constructed by the app rather than supplied as executable commands.

### Dates and interpretation

The optional `from` and `through` fields must be supplied together as inclusive `YYYY-MM-DD` dates. Time entries already contain explicit work dates. File timestamps are returned with UTC offsets; activity filtering converts them to the app computer's local calendar date. Git history filtering uses the app computer's local commit-date boundaries; author dates are returned separately.

A timestamp shows when evidence was recorded, not necessarily when the work described happened. Creation times may be unavailable on some filesystems or may change after copying. An old note can contain relevant work even if its latest modification falls outside the review period, so note search and listing deliberately have no date exclusion. External MR/ticket dates must be retrieved and reconciled by the harness using links in the raw notes.

Task discovery shows up to ten file events and ten Git commit examples per task, with counts. Git discovery considers at most 200 matching commits; `list_history` provides complete pagination beyond that discovery window. Current task metadata is listed; use Git history paths to discover evidence from externally removed notes/tasks. Historical Git note reads do not require the file or its task directory to still exist. No generated task summaries are assumed.

### Pagination and consistency

List/search tools return `items`, `offset`, `nextOffset` and a dataset `revision`; most also return `total`. Default page size is 50, maximum 100. Supply `offset: nextOffset` and `expectedRevision: revision` when continuing. A changed source causes an explicit error instead of silently mixing pages; restart retrieval and deduplicate as appropriate. Time totals cover all matching entries, not just the current page.

For `read_note`, offsets/limits count Unicode scalar characters, not bytes. Default page size is 8,000 characters, maximum 24,000. Continue with `nextOffset` until null. Use its content revision as `expectedRevision`; a search result's `noteRevision` can also be used for the first read. Historical reads take a full 40/64-character commit SHA in `revision`; the returned content hash still goes in `expectedRevision` for continuation.

The endpoint limits requests to 64 KiB, tool data to 512 KiB per response, Git output/individual note reads to 16 MiB, and concurrent retrieval workers to four. Oversized results return a clear error: reduce the page size or narrow the query. Git commands have a 15-second deadline. These are retrieval limits, not limits on your stored notes.

### Task and global note scopes

Note listing, search, read, and history accept `scope: all | task | global`. Without a task filter the default is all. `taskId` narrows to one task; combining it with global scope is an error. Task scope without an ID excludes global notes. Reads infer ownership from validated paths and reject disagreeing constraints. Global results have explicit global scope and no task association. Internal task paths remain `projects/<id>/notes/`; global paths use `global/notes/`. Task discovery counts and activity exclude global notes. Code metadata and global-note changes participate in retrieval revisions. No legacy tool aliases are provided.

## Example retrieval conversation

1. `list_tasks({from: "2026-01-01", through: "2026-06-30", includeGit: true})` returns candidate tasks and activity evidence. Follow every page; missing evidence is not proof of no work.
2. `list_time_entries({taskId: "<id>", from: "2026-01-01", through: "2026-06-30"})` establishes explicit dated allocations.
3. `search_notes({taskId: "<id>", query: "challenge"})` locates candidate evidence. The harness can search other terms based on the user's actual questions.
4. `read_note({path: "projects/<id>/notes/daily/2026-03-12.md", expectedRevision: "<noteRevision>"})` retrieves raw content, including its links.
5. `list_history({taskId: "<id>", from: "2026-01-01", through: "2026-06-30"})` discovers earlier records; `read_note({path: "<historical-path>", revision: "<commit>"})` retrieves historical text.

The LLM decides which additional evidence to retrieve, follows external links with its own tools, and writes its answer. WorkLog performs none of those model tasks. Saving generated summaries is not part of this read-only interface; the user can paste a summary into a note.

## Git is optional

Notes/time entries remain ordinary local files. `list_tasks`, `list_notes`, `search_notes`, `read_note` of current files and `list_time_entries` work without Git installed and without a repository. If `includeGit` is requested, discovery still returns the file/time evidence and an explicit `gitWarning`. `list_history` and historical note reads return an error when Git/history is unavailable. No missing history is invented or treated as an absence of work.

## Lifetime, credentials and scope

Sharing is off on every application launch. It runs only while the desktop app is open and sharing has been started. Connection settings and the bearer token are saved in machine-local `mcp-sharing.json` beside other application settings, outside the work-data repository and its backups. The token never appears in MCP tool responses. Anyone holding it and able to connect can read the whole shared workspace, including closed tasks and Git history.

The service is pinned to the workspace selected at start. Switching workspaces makes tool calls fail until you stop/start sharing; it does not automatically expose the new folder. Rotation stops the listener and replaces the token. Restart sharing and update the harness token afterward. Stop sharing closes the endpoint. Requests already processing may finish; no writes or external actions are exposed.

Only saved files are served; unsaved editor drafts remain local to the UI. Binary attachment contents and machine settings are excluded. There is no mutation or summary-writing tool. The integration does not require a hosted service, data synchronization or an LLM API key.

## Protocol and validation

Uses the official Rust MCP SDK's Streamable HTTP transport, with stateless JSON responses and compatibility with its supported legacy initialize lifecycle and current per-request metadata lifecycle. No long-lived session ID is required. The same authorization and Host/Origin checks apply to every request.

Automated checks exercise an SDK client over HTTP and trusted-certificate TLS, a legacy 2025-11-25 handshake, unauthenticated/invalid-host/invalid-origin/oversized requests, workspace switching, token rotation/persistence, raw Unicode pagination, conflict detection, Git historical reads and plain-file fallback. Connectivity from an actual corporate LLM backend and its client-specific configuration must be tested in that environment.

Protocol references: [official Rust SDK](https://github.com/modelcontextprotocol/rust-sdk), [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

Host means the endpoint name used by the caller (for example `10.20.30.40:43127` or an explicitly allowed corporate hostname). Origin, when present, identifies the website that initiated a request. Neither header is an allowlist of caller IP addresses. Network-level source-IP restrictions belong in the corporate firewall. Valid Host/Origin headers never replace the bearer token.

Build validation also runs the frontend production bundle and a desktop development build. Clippy was unavailable in the installed Rust GNU toolchain; compiler and runtime tests provide the verified checks.
## Privacy and security reporting

See [data and privacy](privacy.md) for local settings, tokens, history, and backup retention. Report suspected vulnerabilities through the route in [SECURITY.md](../SECURITY.md); keep private workspace contents and credentials out of public issues.
