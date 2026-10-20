# Contributing to WorkLog

Bug reports, documentation improvements, and focused pull requests are welcome. For a substantial feature, dependency, workspace-format change, or redesign, open an issue to agree on the problem and approach before implementation. Maintainers review contributions as time permits; there is no guaranteed response time.

## Getting started

Follow the [development guide](docs/development.md) for prerequisites, setup, checks, and packaging. Read the [architecture guide](docs/architecture.md) before changing storage or the desktop boundary.

Use a disposable workspace containing synthetic data. Never include real work notes, access tokens, private keys, internal URLs, or backup credentials in issues, tests, screenshots, or logs. The browser preview uses sample data; desktop testing is required for filesystem behavior.

## Issues

Search existing issues first. For bugs, include the WorkLog version, OS, package type, minimal reproduction, expected and actual behavior, and sanitized error output. For features, explain the user problem and alternatives. Use [GitHub Issues](https://github.com/jpxor/worklog/issues) for ordinary support and defects; follow [SECURITY.md](SECURITY.md) for suspected vulnerabilities.

## Development practices

- Keep changes focused and follow the surrounding TypeScript, React, and Rust conventions. Prefer explicit types at boundaries and small, readable functions. Avoid unrelated formatting or generated-file changes.
- Add regression coverage for changed behavior, especially path validation, deletion, stale writes, backup/restore, rendering, and MCP authentication. Use temporary directories and synthetic data in tests; never depend on a contributor's real workspace or credentials.
- Preserve workspace format 3 and existing `worknotes` identifiers. Discuss migrations before implementing them. Treat data loss, backup fidelity, and security boundaries as review priorities.
- Update user documentation for behavior changes. Add a user-facing bullet to `## Unreleased` in [release notes](docs/release-notes.md), including compatibility/data impact where relevant. Internal refactors need a note only if users or contributors are affected.
- Commit `package-lock.json` and `src-tauri/Cargo.lock` with dependency changes. Explain why a new dependency is needed and review its license, upstream notices, bundle impact, and maintenance status. Preserve attribution for copied code and assets.
- Keep workspace access in Rust behind validated Tauri commands. Do not enable filesystem or network access in the browser preview or weaken authentication, TLS defaults, or the content security policy to work around a bug.

## Pull requests and review

1. Fork the repository, create a descriptive branch from `main`, and make a focused change. Use clear commit messages describing the resulting behavior; no special commit-message format or sign-off is required.
2. Run the checks in the development guide. Explain any checks you could not run and their reason. For UI work, include screenshots and test both appearances and keyboard behavior. Test desktop changes in the desktop app.
3. Open a PR describing the problem, final behavior, validation, and any storage/security implications. Link related issues and identify new dependencies or imported material.
4. Respond to review feedback and keep the PR description current. Maintainer review and passing Windows/Linux build checks are expected before merge. Prefer independent review; the release guide describes the limited sole-maintainer private validation exception. Configured repository protections still apply. Maintainers choose the merge method and release timing.

Treat others respectfully, assume good faith, and keep feedback focused on the work. Harassment, threats, and disclosure of others' private information are unacceptable; maintainers may moderate discussions and restrict participation.

By intentionally submitting a contribution for inclusion, you agree to license it under [Apache-2.0](LICENSE). You retain ownership of your contribution and must have the right to submit it. Third-party material retains its own license and notices; identify it in the PR. There is no separate contributor license agreement.

Maintainers: follow [the release guide](docs/releasing.md); a version tag publishes a release automatically.
