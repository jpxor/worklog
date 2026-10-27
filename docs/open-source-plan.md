# WorkLog open-source release plan

Status: historical proposal, based on the repository at version 0.1.25. The license and contributor baseline have since been added; use [publication readiness](open-source-readiness.md) for current status and [releasing](releasing.md) for the maintained procedure. This historical proposal does not change repository visibility.

## Recommendation

Release WorkLog under **Apache-2.0**, assuming the goal is broad personal and workplace adoption, contributions, and permission for commercial reuse. Apply it to original application code, documentation, and original assets; explicitly preserve third-party exceptions.

Apache-2.0 permits commercial use, modification, redistribution, and proprietary derivatives. It includes an explicit contributor patent grant, with patent-litigation termination terms. Redistributors must preserve applicable notices, provide the license, and mark modified files. It does not grant trademark rights. See the [official license, sections 2–6](https://www.apache.org/licenses/LICENSE-2.0).

This is a project-fit recommendation: a local productivity application with a React/Rust stack and potential workplace users benefits from permissive reuse and explicit patent terms. MIT is simpler but lacks an explicit patent grant. GPL-3.0 would be preferable if requiring distributed derivatives to remain open source were the primary goal; that is not assumed here. Do not dual-license merely because the backend uses Rust.

Before applying the license, confirm who owns the existing code and assets, including any employer rights and imported code. Git authorship alone does not establish ownership. Use the confirmed copyright holder and actual year range, rather than guessing from the account name.

## Current state and gaps

- README already explains installation, Windows/Linux packages, development commands, screenshots, backups, and MCP. Keep it as the entry point.
- `docs/user-guide.md` and `docs/mcp.md` already contain substantial user and security-relevant guidance. Extend and link these rather than duplicate them.
- No root license, contribution guide, security policy, conduct policy, or third-party notice inventory was found.
- Neither `package.json` nor `src-tauri/Cargo.toml` declares a license. npm's `private: true` prevents accidental npm publication; retain it for this desktop application.
- `package-lock.json` has no license fields for its package entries. This is missing metadata, not evidence that dependencies are unlicensed or compatible.
- `scripts/pdf-assets.mjs` copies PDF.js CMaps, standard fonts, WASM, and ICC assets into the distributed frontend. Their licensing must be checked individually, including embedded components and accompanying notices.
- CI already checks the frontend and Rust backend and packages Windows and Ubuntu 22.04 builds. Tag releases publish binaries and checksums. Pages has a separate manual deployment workflow.
- Some documentation refers to a private repository and a maintainer-specific development machine. Public documentation should replace those passages with verified public setup instructions.

## Implementation order

### 1. Clear publication blockers

1. Confirm rights to code, icons, screenshots, preview PDF/SVG, and other copied material. Replace anything without a clear redistribution basis.
2. Scan the complete Git history, branches/tags intended for publication, tracked files, release assets, and workflow logs/artifacts for credentials and private information. Review screenshots and sample content for employer/customer names, internal URLs, personal paths, or real work records. Rotate exposed credentials before removing them; deletion from the latest tree is insufficient.
3. Inventory exact locked npm and Cargo dependencies, including transitive and platform-specific components. Inspect their actual license texts and required notices. Review all bundled PDF.js assets separately. Record unknowns and resolve them before shipping; a direct-dependency list is insufficient.
4. Review GitHub Actions for safe external PR execution, least permissions, and absence of secrets in untrusted builds. Preserve the current separation between PR checks and tag publication.

Deliverable: a checked publication checklist and resolved provenance/license inventory. These audits have not been completed by writing this plan.

### 2. Add the legal and contributor baseline

| File | What it should contain |
| --- | --- |
| `LICENSE` | The complete, unmodified Apache License 2.0 text. Associate original WorkLog material with the confirmed copyright notice in the README or other suitable project notice. |
| `THIRD_PARTY_NOTICES.md` and, where needed, `licenses/` | Resolved component name/version, source, license expression, copyright/attribution, required license text or bundled text path, and any upstream NOTICE content. Include JS, Rust, fonts, WASM, ICC/CMap data, icons, and sample assets as applicable. Preserve full required texts; a table of links alone is insufficient. |
| `NOTICE` | Add only when required by included notices or useful for project attribution. Apache-2.0 adoption alone does not require every non-ASF project to create this file. Keep it factual and avoid extra license restrictions. |
| `CONTRIBUTING.md` | Development setup link; how to reproduce bugs safely; small focused PRs; relevant checks; storage compatibility and MCP security expectations; review process; contribution licensing. Use the draft below. |
| `SECURITY.md` | Private reporting route, supported-version policy, safe report contents, disclosure process, and scope. Enable and verify GitHub private vulnerability reporting before naming it as the route. |
| `CODE_OF_CONDUCT.md` | Adopt a standard policy such as Contributor Covenant with its attribution, an actual monitored private reporting contact, and an enforcement owner. Do not ship unresolved contact placeholders. |

Set `license: "Apache-2.0"` in npm metadata and `license = "Apache-2.0"` in Cargo metadata, updating lockfile root metadata as needed. Consider SPDX headers for original source files; preserve upstream headers. Ensure license texts and required notices actually accompany installers, standalone binaries, and archives, with an accessible licenses view or installed resource location. A file only in the source repository does not cover every binary distribution.

### 3. Make documentation usable by an outside contributor

| File | Proposed content/change |
| --- | --- |
| `README.md` | Keep current feature overview and screenshots. Remove private-access wording after visibility changes. Add License, Contributing, Security, Privacy, support links, and an explicit Windows/Linux support statement. State that macOS is unverified unless tested. Document workspace compatibility. |
| `docs/development.md` | Move development details out of the user guide into one canonical guide. Include Node >=22.13, Rust/Git, Windows compiler/WebView2 requirements, Ubuntu dependencies, clone/install/run commands, browser-preview limits, checks, packaging, and troubleshooting. Explain any machine-specific paths in `scripts/desktop.ps1` or make them configurable. |
| `docs/architecture.md` | Explain React/CodeMirror UI, Tauri command boundary, Rust storage and locking, workspace format 3, Git history/backups, attachment rendering, and read-only MCP. Map the main source modules. Explain internal `projectId` references and the `worklog` application identifiers. Document invariants a contributor must preserve. |
| `docs/privacy.md` | Describe local notes/time/attachments; settings and token storage; explicit Git/folder backups; MCP data exposure and assistant-provider handling; retained Git history; deletion and recovery limits. Verify telemetry, crash reporting, external resource loading, and at-rest encryption behavior before making absolute claims. |
| `docs/user-guide.md` | Retain workflows, shortcuts, workspace schema, backup/restore, and recovery. Link to the new development guide. Replace maintainer-machine instructions and incidental work-laptop references. Clearly document the format-3-only limitation and advise backing up before upgrades. |
| `docs/mcp.md` | Retain detailed protocol/tool guidance. Add links to privacy and private vulnerability reporting. Keep the bearer-token scope, manual startup, TLS/private-network caveat, and workspace-switch behavior prominent. |
| `docs/releasing.md` | Explain version updates in npm/Cargo/Tauri metadata, lockfiles, release notes, checks, clean-machine smoke tests, artifact license inclusion, tag publication, checksums, signing status, and rollback/withdrawal steps. The current workflow validates npm/Tauri versions; extend it to validate Cargo too. |
| `CHANGELOG.md` | Versioned user-facing changes with migration/data-impact notes, known limitations, and links to releases. Keep `docs/release-notes.md` as the current release body if useful; avoid two competing histories. |
| `docs/roadmap.md` | Concise project direction and verified limitations. Separate shipped behavior from proposals in SPEC and design documents; list candidate contributions without promising dates. |
| `.github/ISSUE_TEMPLATE/` | Bug form requesting version, OS/package, reproduction, expected/actual result, and sanitized logs; feature form requesting the user problem and alternatives. Route vulnerabilities to private reporting. |
| `.github/pull_request_template.md` | Problem/behavior change, relevant checks, screenshots for UI changes, and workspace-format or security impact when applicable. |

### Suggested CONTRIBUTING wording

> WorkLog welcomes bug reports, documentation improvements, and focused pull requests. For substantial changes, open an issue describing the user problem and proposed approach before implementation. Maintainers review contributions as time permits; there is no guaranteed response time.
>
> Follow the development guide to run the desktop app. The browser preview uses sample data and cannot save a real workspace. Use a disposable workspace for development and never attach private work notes, tokens, or real backup repositories to an issue.
>
> Run `npm test`, `npm run build`, and `cargo test --manifest-path src-tauri/Cargo.toml` for relevant code changes. Explain any checks you could not run. Update user documentation when behavior changes, and include before/after screenshots for visible UI changes.
>
> Preserve workspace compatibility and backup/restore behavior. Discuss format changes before implementation. Changes to path handling, file deletion, Git commands, rendering, or MCP authentication require focused regression coverage.
>
> By intentionally submitting a contribution for inclusion, you agree to license it under Apache-2.0. Keep third-party attribution and identify newly added dependencies or copied material. You retain ownership of your contribution.

Use Apache-2.0's contribution terms initially; a separate CLA or mandatory sign-off workflow would add administration without an established project need.

### Suggested SECURITY wording

Publish this only after enabling and verifying the private reporting route:

> Please report suspected vulnerabilities through this repository's Security tab using “Report a vulnerability.” Do not post exploit details, workspace contents, bearer tokens, certificates/private keys, or credentials in public issues.
>
> Include the affected version and platform, reproduction steps using synthetic data, the expected security boundary, and the potential impact. Areas of particular interest include workspace path escape, unintended file access or deletion, unsafe document rendering, Git command execution, and unauthorized MCP access.
>
> Security fixes target the latest release. Older versions may require an upgrade. Reports are reviewed as maintainer availability permits; no response deadline is guaranteed. We will coordinate disclosure with the reporter when practical.

### Suggested privacy wording

Verify against implementation before publishing:

> WorkLog stores your notes, time records, and attachments in the local workspace folder you choose. Local storage does not by itself encrypt those files. File-system permissions, device security, and any folder synchronization service also affect who can access them.
>
> Backups copy workspace data to your selected folder or Git remote. Git history and backups can retain earlier versions of deleted or edited notes. Removing a note from the current workspace does not remove every historical copy.
>
> MCP sharing starts only when you enable it for the current app session. Anyone with the bearer token and network access can read the shared workspace, including closed tasks and available Git history. The assistant service you connect may process or retain returned information under its own policies. WorkLog does not itself call an LLM.

Add an implementation-verified network/telemetry statement and exact settings paths rather than making unsupported “nothing ever leaves your device” claims.

### Suggested README additions

After the license is actually applied:

> **License:** WorkLog's original code and documentation are licensed under Apache-2.0. Third-party components retain their own licenses; see LICENSE and THIRD_PARTY_NOTICES.md.
>
> **Contributing:** See CONTRIBUTING.md for setup, checks, and the review process. Report reproducible bugs through GitHub Issues using sanitized sample data. Report vulnerabilities privately through the route in SECURITY.md.
>
> **Project status:** WorkLog is an early-stage desktop application. Automated packaging covers Windows and Linux x86-64 on Ubuntu 22.04. Back up your workspace before upgrading. See the user guide for supported data formats and recovery.

Turn file references into links. Link privacy and roadmap documents nearby. Keep any support commitment consistent with actual maintainer capacity.

### 4. Validate and publish

1. Complete the document set above with working links and real reporting contacts; check that it describes current behavior rather than proposals.
2. Validate a fresh clone on Windows and Ubuntu 22.04 using the public instructions. Run existing frontend/build/Rust checks and package both platforms. A planning-only change does not need application test runs.
3. Smoke-test install, create/reopen workspace, note/time saves, backup/restore, upgrade behavior, and authenticated MCP start/stop using synthetic data. Inspect packaged license resources and verify checksums. State actual signing status and platform limits in release notes.
4. Configure issue labels/templates, private security reporting, branch protection for main, and required CI checks. Keep publish permissions confined to release jobs.
5. After blockers are resolved, change repository visibility, verify public source/release access, enable Pages through Actions, and run its deployment workflow. Update README Pages/private-repository wording to match the resulting state.
6. Publish the first explicitly open-source release with license/notices included, current release notes, compatibility information, and checksums. Earlier binary releases need separate review; licensing the latest source does not prove their redistribution obligations were met.

## Completion criteria

- Rights and full-history sensitive-data review completed; any exposures remediated.
- Apache-2.0 applied consistently to owned material; exceptions and dependencies resolved.
- Source and binary distributions contain required license texts and notices.
- An outside contributor can build from the instructions without maintainer-specific paths.
- Users can find privacy, support, security, and recovery information.
- Windows/Linux checks and clean-machine smoke tests pass, or explicit limitations are documented.
- Public repository, release downloads, and project-page links work without repository membership.

## Decisions still requiring owner facts

The recommendation and document structure are ready. Implementation still needs the confirmed rights holder/year range, asset provenance, a monitored conduct-reporting contact, and the intended security support commitment. The latest-release-only policy above is a proposed manageable default. No repository visibility, licensing, or GitHub configuration changes are made by this plan.
