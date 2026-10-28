# Releasing WorkLog

Maintainers build Windows x64 and Linux x86-64 packages through [Build and test WorkLog](../.github/workflows/build.yml) on `main`. **Pushing a `vX.Y.Z` tag automatically publishes the verified packages for that exact commit through [Publish verified WorkLog release](../.github/workflows/release.yml).** Tag publication runs fresh security checks but does not rebuild installers. Automation assembles a draft with all assets, then publishes it; there is no manual approval gate. A manual run of the build workflow builds artifacts without publishing, even when run against a tag. A manual run of the publication workflow requires an existing release tag.

WorkLog uses a main-based release model: merge a release PR, wait for checks on the resulting `main` commit, then create an annotated tag at that exact commit. Tags identify commits, not moving branches. CI rejects release commits outside `main` history; it permits an older reviewed commit on `main` when newer unrelated work has landed. Release branches are an option for future parallel maintenance, not a current requirement.

PRs run frontend checks once on Linux and native Rust tests on both platforms, without packaging installers. Code changes on `main` build and verify packages; documentation-only changes skip expensive desktop steps while preserving required check names. Superseded PR runs are cancelled. Native jobs reuse the frontend artifact instead of rerunning frontend builds. Frontend artifacts expire after one day; package artifacts after seven days. Publication selects only successful builds in this repository for the exact commit, from `main` pushes or explicit manual rebuilds, and checks each package's commit/version/platform/run provenance. PR and fork artifacts are never published.

For the first public release, complete the [publication readiness checklist](open-source-readiness.md), including ownership, sensitive-data review, third-party notices, and repository settings. Do not treat an automated build as proof these tasks are done. A private validation release may exercise automation before this audit is complete, provided the repository remains private and the release PR records all deferred checks. It does not establish public-launch readiness.

## 1. Prepare a release PR

Start from current `main` with a clean working tree. Select an unused stable `X.Y.Z` version (prerelease tags are not supported by the current validator). Use patch releases for fixes, minor releases for features or notable pre-1.0 compatibility changes, and discuss breaking changes before implementation. Every release must explain data-format impact explicitly.

Update all version locations in the same PR:

| File | Field |
| --- | --- |
| `package.json` | `version` |
| `package-lock.json` | top-level `version` and `packages[""].version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `[package].version` |
| `src-tauri/Cargo.lock` | the `worklog` package's version |

`npm version X.Y.Z --no-git-tag-version` updates the npm files without creating a release tag. Edit the Tauri and Cargo manifests, then run `cargo check --manifest-path src-tauri/Cargo.toml` to refresh the Cargo lockfile's application version. Review lockfile diffs; avoid unrelated dependency upgrades. Do not rename internal `worklog` identifiers when bumping a version.

In [release-notes.md](release-notes.md), move completed Unreleased bullets into a new `## X.Y.Z` section immediately below `## Unreleased`; keep Unreleased for later work. Describe user-visible additions/fixes, data compatibility or migration requirements, known limitations, and tested platforms. Keep historical sections intact. The exact version heading and at least one `- ` bullet are required. Update shared download guidance below `<!-- release-downloads -->` when packaging or installation changes; keep that marker exactly once.

Compare against the last **published** tag, not just the previous manifest version. If intermediate version sections were never released, summarize their changes in the release being published so upgrading users see the complete compatibility impact.

There is one release history, `docs/release-notes.md`. The workflow extracts the matching version section plus shared download instructions. It excludes Unreleased and older sections. Do not add a competing changelog or paste the full history into a GitHub release.

## 2. Validate and review

```sh
npm ci
npm run test:release
npm run release:check -- --tag vX.Y.Z
npm test
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Replace `vX.Y.Z` with the intended tag. To inspect the exact generated GitHub release body, write outside the tracked source tree:

```sh
npm run release:check -- --tag vX.Y.Z --output ../worklog-release-preview.md
```

Review the generated text, release PR diff, and Windows/Linux CI checks. Confirm there are no unintended generated files or private data. Verify required license/notice resources are present in every intended distribution; the first full dependency audit and binary notice packaging are still tracked in the publication checklist. Verify the version is unused in remote tags and GitHub Releases (including drafts); GitHub CLI users can run `gh release list --repo jpxor/worklog`.

Download package artifacts from the successful `main` build and smoke-test on clean Windows and Ubuntu 22.04 installations or VMs. PR runs have no installers. Record versions, package names, results, and exceptions in the release PR or release follow-up:

Also test Ubuntu 24.04 GNOME on Wayland: install the same DEB, launch from Applications, pin it to the dock, close and relaunch, then upgrade from the previous release. Confirm one visible WorkLog launcher and the correct icon. CI checks installation/reinstallation/removal and linked libraries in a 24.04 container; it does not test the graphical session. The DEB includes an application-ID launcher (`local.worklog.desktop.desktop`) for GTK association and a hidden legacy `WorkLog.desktop` entry to avoid duplicate menu items. Keep the application identifier, launcher filename and StartupWMClass aligned.

- Install, launch, close, and reopen; confirm version and upgrade behavior. Windows is unsigned; report signing limitations accurately.
- In a synthetic format-3 workspace, create a task/code/global note, save and reopen notes and time, correct an entry, and export a report.
- Open sample image/PDF/Mermaid content; check both appearances and keyboard navigation.
- Exercise local history, folder/Git backup, and restore to a disposable destination. Verify restored notes, attachments and time records.
- Start/stop authenticated MCP, check rejection without a token, and verify the chosen network/TLS configuration. Do not expose real work data.
- Test scheduled/test notifications from an installed build, including OS permissions and restart deduplication. WorkLog must stay open for reminders.

Do not claim clean-machine or platform testing that has not been performed. Merge the release PR only after review and successful checks. Prefer independent review. For a sole-maintainer private validation release, record maintainer self-review and its limitation in the PR; never bypass configured protections. Record deferred installation tests explicitly. These exceptions do not waive the public-launch checklist.

## 3. Tag and publish

Confirm the intended commit is on `main`, the version is unused on both the remote and GitHub Releases, and that the checkout has no local changes:

```sh
git switch main
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git ls-remote --tags origin vX.Y.Z
npm run release:check -- --tag vX.Y.Z
git tag -a vX.Y.Z <reviewed-main-commit-sha> -m "WorkLog vX.Y.Z"
git push origin vX.Y.Z
```

Replace `<reviewed-main-commit-sha>` with the exact commit whose successful `main` checks you inspected. Stop if the working tree is dirty or the remote tag exists. Only execute the last two commands when ready to publish. Tag protection and maintainer authorization must be configured in GitHub. Publication checks ancestry, versions, notes and security, selects successful same-commit package artifacts, validates their provenance and licensing materials, creates checksums, and publishes with the tag's extracted release notes. Only the publication job has `contents: write`; it also has `actions: read` for artifact retrieval. No personal release token is required. Actions are pinned to full commit hashes, with Dependabot proposing updates; review those updates before merging.

## 4. Verify the published release

Check the Actions run and [Releases](https://github.com/jpxor/worklog/releases). Verify the tag points to the reviewed commit and the body contains only that version's changes plus download guidance. Expected assets:

- Windows NSIS installer and `WorkLog-windows-x64.zip`.
- Linux `.deb` and `WorkLog-linux-x64.tar.gz` containing `worklog`. AppImage is withheld pending native-library licensing review.
- `SHA256SUMS.txt`, covering all other release files.
- `LICENSE.txt`, `THIRD-PARTY-NOTICES.txt`, and `WorkLog-third-party.tar.gz`. Portable archives include the license, notices, full inventory and corresponding source; installers include the same materials under `licenses/` relative to Tauri's resource directory. See [third-party materials](third-party.md).

Run `npm run notices:check` and `npm run test:notices` before tagging. Inspect the actual installed resources on Windows and Linux, and review native libraries bundled into AppImage before public distribution. A configured resource map alone does not establish package completeness. The Windows portable download is now a ZIP so attribution and source travel with its executable.

Download assets and verify checksums from the download directory on Linux with `sha256sum --check SHA256SUMS.txt`. On Windows use `Get-FileHash -Algorithm SHA256 <download>` and compare with the corresponding manifest entry. Checksums detect file changes; they are not a signing mechanism. Repeat an installed-app smoke test with the published assets. Verify any required license resources and anonymous download access for a public release.

The website is independent: if needed, run **Deploy project page** manually after enabling Pages with GitHub Actions. Confirm its links and screenshots match the release. Tags do not deploy Pages.

## Failures and withdrawal

If same-commit package artifacts are missing or expired, manually run **Build and test WorkLog** with the existing release tag as its ref. Wait for that rebuild to pass, then rerun the failed publication job, or manually run **Publish verified WorkLog release** with that tag. Do not substitute artifacts from another commit or from a PR. Publication fails closed when a matching trusted build or either package is unavailable.

If checks/builds fail before a release exists, inspect the failing job, fix via a PR, and normally issue a new version/tag. A transient failure can be rerun for the same immutable commit if no release was published. Publication is not idempotent: `gh release create` fails if the release already exists, including a draft. If upload or publication fails, inspect the draft, verify its assets and checksums, and finish only once it is complete; do not blindly rerun. GitHub immutable releases, when enabled, lock the tag and assets on publication, which is why all assets are attached to the draft first.

Never force-move a published tag or silently replace published binaries. For a bad published release, explain the problem in its release notes, warn users about affected data/security behavior, and publish a new patch version. If installers must be withdrawn, a maintainer should explicitly remove affected assets or the release through GitHub, retain the source tag where possible, and record what was withdrawn and why. Direct users to a safe version and require a workspace backup before a downgrade; older builds may not accept current workspace formats.

## Reference guidance

This process follows [GitHub release management](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository), [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use), and [Semantic Versioning](https://semver.org/). Main-based tagging is WorkLog's chosen policy; GitHub also supports releases from other branches. Version 0.x denotes initial development, not a promise of a stable public API.
