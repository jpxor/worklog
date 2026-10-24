# Security review — October 24, 2026

Remediation status: application Git operations now disable hooks and external filesystem monitors. Remote backups reject effective push destinations that differ from the displayed URL or include multiple targets; saving backup settings replaces local push URLs with the selected URL. Regression tests verify hooks stay inactive, hidden destinations receive no data, and folder backups continue when a remote is blocked. The owner confirmed that backing up all workspace files is intentional, so finding 3 is accepted as the intended backup scope, with a brief secrets reminder rather than content filtering. Other Git execution mechanisms discussed below, including filters and credential helpers, are outside this targeted hooks fix. The findings below record the original review.

Remediation validation: 31 backend tests passed (one Recycle Bin integration test intentionally ignored), 123 frontend tests passed, and the TypeScript/production frontend build succeeded. Nine release/licensing tests, release metadata verification, license freshness, Rust formatting, and diff whitespace checks also passed. No dependency or workspace-format changes were made. Tests used synthetic workspaces and local bare backup repositories. A Windows x64 NSIS installer was subsequently built successfully as version 0.1.28, with the prepared notices, inventory and all six corresponding-source archives verified. Installing the new package and Linux packaging were not exercised locally.

Reviewed WorkLog 0.1.27 source, desktop permissions/CSP, MCP transport and tools, workspace storage, Git and folder backups, dependency lockfiles, build/release scripts, and workflows. This is a source review with targeted local reproductions, not a forensic certification of installed binaries or the host computer. Application behavior has not been changed.

## Findings

### 1. High: opening a supplied workspace can execute its Git hooks

Relevant code: `src-tauri/src/storage.rs:137`, `:490`, `:518`, `:574`; `src-tauri/src/evidence.rs:477`.

Workspace opening validates the data format and then calls `commit()`. The Git wrapper inherits repository configuration and does not disable hooks. A valid workspace delivered as a folder/archive or restored folder backup can contain `.git/hooks/pre-commit`, or executable hooks selected by `core.hooksPath`. Opening it with changes to commit executes that hook as the desktop user. Subsequent automatic commits also reach this path. Repository-configured filters and external filesystem monitors expand the Git execution surface beyond commit hooks.

**Prerequisite:** the user opens/restores a supplied workspace containing attacker-controlled Git metadata, or a process with workspace access tampers with that metadata. A normal remote clone does not copy the remote repository's `.git/hooks`. This is not an unauthenticated MCP command-execution finding.

**Verification:** using the same `git add` and `git commit` arguments as the backend, a synthetic pre-commit hook successfully wrote a harmless marker. Only synthetic files and local repositories were used.

**Recommendation:** treat imported workspace Git metadata as untrusted. Use a consistent restricted Git execution policy for storage and evidence commands, disable hooks and external filesystem monitors, and address filters, config includes, external helpers, environment overrides, and automatic Git maintenance. Consider an application-managed history repository if workspace configuration cannot be isolated safely. Disabling hooks alone is only a partial fix.

### 2. Medium: the displayed backup URL can differ from the actual destinations

Relevant code: `src-tauri/src/storage.rs:484`, `:940`, `:1083`; `src/App.tsx:664`.

The app displays `git remote get-url origin`, but backs up with `git push -u origin HEAD`. A separate `remote.origin.pushurl` takes precedence for pushing and can contain multiple destinations. Settings can therefore show an expected destination while scheduled backups send the workspace and history somewhere else. Updating the ordinary origin URL does not clear an existing push URL. Git URL rewrites also need consideration.

**Prerequisite:** imported/restored or externally modified Git configuration, or a legitimate existing separate push URL. The configuration mismatch was reproduced; no malicious configuration was found in the application source repository's local config.

**Verification:** two local bare repositories represented the displayed and actual destinations. The displayed URL remained the first repository, while the exact backup push command delivered the synthetic commit to the second. No network transfer occurred. This matches [Git's documented push URL behavior](https://git-scm.com/docs/git-config#Documentation/git-config.txt-remoteltnamegtpushurl).

**Recommendation:** resolve and display every effective push destination, bind automatic backups to approved effective destinations, and stop automatic transfers when they change. When changing the backup URL, explicitly handle existing push URLs rather than leaving an undisclosed destination active.

### 3. Medium: backup selection includes unrelated files in the workspace

Relevant code: `src-tauri/src/storage.rs:384`, `:496`, `:539`, `:1083`.

Every commit runs `git add -- .`, and folder backup copies the entire workspace, including `.git`, excluding only the lock file. The generated workspace ignore file excludes only the lock and temporary file patterns. An unrelated `.env`, private key, exported credential file, or other private file placed in the workspace can enter history and later leave through backup. Previously committed contents can remain in Git history after deletion.

**Verification:** a synthetic unrelated file at the workspace root was automatically staged, committed, and present in the local destination repository.

**Assessment:** this is an overly broad data-selection risk, not evidence of a hidden uploader. Backing up attachments and history is intentional; arbitrary workspace-root files are not distinguished from application data.

**Recommendation:** explicitly define supported application data and attachments for staging and copying, or clearly present whole-folder backup scope with sensitive-file detection. An exclusion added later does not remove already committed secrets; remediation of an actual leak also requires credential rotation and history/backup cleanup.

## Dependency warnings

The live npm audit returned zero known vulnerabilities. Cargo audit using the locally cached advisory database reported zero entries in its vulnerability category, but did report:

- `glib 0.18.5`: [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html), an unsound iterator implementation affecting versions before 0.20.0. This is in the Linux GUI dependency chain; exploitability through WorkLog was not established. It should not be described as a completely clean Rust audit.
- Unmaintained packages: `proc-macro-error 1.0.4`, `zbus_names 4.3.5`, `zvariant 5.15.1`, and `zvariant_derive 5.15.1`.

Upgrade through compatible upstream desktop dependencies and track the remaining advisories. The Rust audit was run with `--no-fetch`; it is not a claim that today's advisory database was downloaded.

## Network and unexpected-content review

- The only application listener found in source is optional MCP. It defaults to loopback, starts manually, authenticates requests with a random bearer token using constant-time comparison, validates Host/Origin, rejects wildcard listening addresses, and requires TLS outside loopback unless private-network HTTP is explicitly enabled.
- MCP tools expose reads rather than a generic command or write endpoint. Sharing is pinned to the selected workspace, and ordinary path traversal and symbolic links are checked. No authentication bypass was demonstrated. A token intentionally grants broad workspace/history access; it is not a per-task permission system.
- Explicit private-network HTTP sends tokens and data unencrypted. This is documented and defaults off; retain TLS for network sharing.
- The frontend CSP limits external connections. PDF resources are bundled locally, and Mermaid uses strict mode and image rendering. No hidden telemetry, hardcoded exfiltration endpoint, or unexpected runtime downloader was identified in the reviewed application source.
- The source repository had no active files in `.git/hooks`, and its local config key inventory showed no push URLs, hook-path overrides, or similar unexpected execution settings. Dependency lockfile sources did not reveal an unexpected external package registry or Git source.
- Ignored `.tools` contains development, auditing, packaging, and release-review artifacts. The examined `neutralize.cjs` changes stylesheet colors; its name was not evidence of a security bypass. These ignored artifacts are distinct from application source and do not receive a blanket trust assessment here.

## Validation and limits

- `npm audit --json --ignore-scripts`: passed, zero known vulnerabilities.
- Gitleaks 8.30.1 full reachable-history scan with redaction and inline allow comments disabled: 58 commits, approximately 5.02 MB, no leaks detected. An initial sandbox-constrained scan was incomplete; the successful repeat supersedes it. Unreachable objects, arbitrary ignored files, and actual user data/backup repositories were not comprehensively scanned.
- Local Git reproductions: hook execution, displayed/actual backup destination mismatch, and unrelated-file inclusion all confirmed. Evidence is in ignored `.test-tmp/security-review/proof.json` and the reproduction script beside it.
- Rust dependency audit: completed against the cached database with warnings listed above.
- Backend tests: `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml` completed successfully with the GNU toolchain PATH configured: 28 passed, zero failed, one Recycle Bin integration test intentionally ignored. This includes actual HTTP/TLS MCP clients, authentication, Host/Origin rejection, request-size checks, workspace pinning, token rotation, path validation, Git history reads, and backup roundtrips. Sandbox-constrained attempts encountered toolchain/process restrictions; the successful run outside the sandbox supersedes those attempts.

Priority: restrict untrusted Git execution first, then make automatic backup destinations explicit and constrain backup contents.
