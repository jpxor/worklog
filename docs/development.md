# Development

WorkLog is a Tauri 2 desktop app with a React 19/TypeScript frontend, CodeMirror 6 editor, and Rust backend. See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution and review expectations and [architecture](architecture.md) for module boundaries and data invariants.

## Prerequisites

- Node.js **22.13 or newer**, npm, Git, and a current stable Rust toolchain. CI uses Node 22 and stable Rust. Check `node --version`, `npm --version`, `rustc --version`, and `cargo --version`.
- Windows x64: Rust's MSVC toolchain, Visual Studio C++ build tools with a Windows SDK, and WebView2. Keep the Rust toolchain and native compiler compatible. The helper script also supports an existing Rust GNU/MSYS2 setup, but MSVC is the CI path.
- Ubuntu 22.04 x86-64: install the native build dependencies below, in addition to Node and Rust.

```sh
sudo apt-get update
sudo apt-get install -y build-essential curl libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

Windows and Ubuntu 22.04 are the automated packaging targets. macOS, ARM, and Ubuntu 20.04 are unverified; successful frontend tests alone do not establish desktop support.

## Setup and run

```sh
git clone https://github.com/jpxor/worklog.git
cd worklog
npm ci
npm run tauri dev
```

Choose a disposable data folder outside the source checkout. Development builds use the existing application identity, so they may share installed-app settings and the last workspace selection. Close an installed WorkLog instance before launching a development build and verify the workspace before editing.

For an interface-only preview at `http://127.0.0.1:1420`:

```sh
npm run dev
```

This preview uses bundled synthetic data and cannot save a real workspace, start MCP sharing, or exercise native notifications. `predev` and `prebuild` copy PDF.js assets from installed dependencies into ignored `public/pdfjs/`; do not commit those generated copies.

On Windows, `./scripts/desktop.ps1 dev`, `build`, or `test` can add `%USERPROFILE%\.cargo\bin` to the current process PATH. For Rust GNU it also detects GCC at `C:\msys64\ucrt64\bin`; if installed elsewhere, put your compatible compiler on PATH yourself. The helper's `test` action runs Rust tests only.

## Checks

Run these before submitting code changes:

```sh
npm run test:release
npm run test:notices
npm run notices:check
npm run release:check
npm test
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

`npm run build` runs TypeScript checking and Vite's production build. `npm test` runs Vitest and colocated component/model tests; `npm test -- src/model.test.ts` selects a file. Rust tests live alongside backend code and use temporary workspaces. The release tooling uses Node's built-in test runner. Documentation-only edits need link/content review; run the release checks if changing notes or version metadata. There is no separate lint or formatting gate currently. Follow surrounding style and avoid whole-file reformatting.

The [build workflow](../.github/workflows/build.yml) runs frontend checks once on Linux and native Rust tests on both supported platforms. PRs skip installer packaging; code changes on `main` package and verify both platforms. Documentation-only changes skip expensive desktop work while preserving required check names. Native jobs reuse the shared frontend output through `tauri.ci.conf.json`; local Tauri builds retain the usual frontend build command. Run `node --test scripts/ci-tests.mjs` when changing CI selection or artifact provenance. Report local limitations in the PR and check CI results. A local pass on one OS does not replace the other platform's build.

## Packaging and smoke testing

```sh
# Executable only
npm run tauri build -- --no-bundle
# Windows installer
npm run tauri build -- --bundles nsis
# Linux packages (run on Linux)
npm run tauri build -- --bundles deb,appimage
```

Executables are under `src-tauri/target/release/` and packages under `src-tauri/target/release/bundle/`. Windows binaries are currently unsigned. Linux standalone binaries need GTK 3 and WebKitGTK 4.1 runtime libraries.

For visible changes, check light/dark appearance, keyboard navigation, popup dismissal, and narrow windows. For desktop changes, create/reopen a synthetic workspace, edit and reopen notes, save/correct time, and exercise the affected native operation. For release validation use the fuller [release checklist](releasing.md).

## Troubleshooting

- If PDF assets are missing, run `npm ci` and restart through the npm scripts so `predev`/`prebuild` runs.
- If port 1420 is busy, stop the other preview/dev process. Tauri and Vite must agree on this port; strict-port mode intentionally fails instead of choosing another one.
- If Rust or the linker is missing, check PATH and the matching native compiler/SDK installation. On Linux, missing GTK/WebKit packages are native dependency errors, not npm dependency errors.
- Workspace format errors require a format-3 workspace. Do not modify a real workspace marker to bypass the check. Back up user data before testing compatibility changes.
- Never commit workspace folders, `.env` files, credentials, real logs, build output, or generated PDF assets. Inspect `git diff` and `git status` before opening a PR.

Dependency changes also require regenerating and reviewing [third-party materials](third-party.md). Run `npm audit --audit-level=high`, `cargo audit --file src-tauri/Cargo.lock` (cargo-audit 0.22.2), and Gitleaks 8.30.1 before release. Weekly/PR security checks retain advisory warnings; investigate findings rather than adding blanket suppressions. See [repository security](repository-security.md).
