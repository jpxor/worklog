# Publication readiness

This checklist records work that must be verified before the first public source/binary release. Documentation and a license do not establish that historical material, third-party assets, or repository settings have been audited. Do not mark items complete without recording evidence in the release PR or maintainer records.

## Implemented in this preparation

- Apache-2.0 source license and npm/Cargo license metadata; npm remains private to prevent accidental registry publication. Installer resources and standalone release assets include the WorkLog license; resolved third-party notices and corresponding font/MPL sources now have distribution packaging. Native AppImage library attribution and installed-package inspection remain open.
- Contributor practices, canonical development/architecture guides, issue and PR templates, security reporting guidance, and a release runbook.
- Checks for npm, Cargo, Tauri and lockfile version agreement, plus release-specific notes generation for tag publication.
- Release tags must point into main history. Full-commit Action pins, read-only default permissions, disabled checkout credential persistence, serialized release runs, and draft asset assembly protect the publishing path. Dependabot proposes monthly npm, Cargo, and Actions updates.

## Owner and repository tasks before publication

- [x] Owner confirmation for original project material: on 2026-10-19 the owner confirmed ownership is cleared and that the project was generated using LLMs. This records the owner's declaration; dependency licenses and third-party notices remain separate tasks below. No copyright holder/year notice is inferred from the GitHub account.
- [x] Review reachable Git history, fetched remote branches/tags, local retained history, screenshots, and sample PDF/SVG for secrets and private data. The [history review](history-review.md) records the exact scope and results: no detected credentials or confidential work content; existing author name/email remain visible in Git metadata.
- [ ] Separately review GitHub release binaries and workflow logs/artifacts for secrets and private data. The Git history review does not close this distribution-side audit. Rotate any exposed credentials and remove private material if found.
- [ ] Resolve legacy private-release distribution materials before changing visibility: existing releases (including the v0.1.26 procedure test) predate complete third-party notice/source packaging. Review each release's actual dependency versions and supply matching materials or withdraw the affected downloads. New main-branch materials do not retroactively fix old tagged archives or installers.
- [x] Inventory locked npm and Windows/Linux Cargo dependencies, full upstream licenses and separately licensed PDF.js assets. See [third-party materials](third-party.md), the generated inventory, full notices and checksum-pinned corresponding source. Original Apache-2.0 licensing does not relicense dependencies.
- [ ] Verify the configured notices/source packaging in actual installed Windows/Linux packages and portable downloads; review AppImage native-library licenses and source obligations. Generated materials and resource/archive wiring are implemented; actual package inspection remains required.
- [ ] Enable and verify GitHub private vulnerability reporting. Confirm the route in `SECURITY.md` works. Choose a monitored private conduct-reporting contact before adopting a fuller conduct policy.
- [ ] Configure protection for `main`, require review and successful Windows/Linux checks, and restrict who can push release tags. Verify Actions settings allow intended fork PR checks without secrets or privileged untrusted code execution.
- [x] Enable available dependency graph, Dependabot alerts/malware alerts and grouped security updates, immutable future releases and Action SHA pin enforcement. See the [security configuration record](repository-security.md) for verified settings and unavailable controls. Native secret/code scanning remains a public-launch task.
- [ ] Complete clean-machine Windows/Linux setup and installer smoke tests using the public instructions. Record tested OS versions, packages, and any exceptions.
- [ ] Change visibility only when ready, then verify anonymous access to source, issues, releases and docs. Review visibility and Actions/Pages settings rather than assuming this checkout reflects them.
- [ ] Enable Pages with GitHub Actions and manually run **Deploy project page** if publishing the project website; verify its downloads and documentation links.

Use [releasing.md](releasing.md) for each subsequent release. The pre-existing [open-source plan](open-source-plan.md) is a proposal and historical planning input; this checklist records the remaining publication work.

## Assessment against external guidance (2026-10-19)

The baseline was checked against GitHub's [open-source launch checklist](https://opensource.guide/starting-a-project/), [release management guidance](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository), and [Actions secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use), rather than treating previous project practice as the standard.

| Area | Evidence and assessment |
| --- | --- |
| Discoverability and contribution | README, license, contribution/development guides, issue/PR templates, support and privacy guidance are present. A standalone conduct policy with a monitored private enforcement contact remains a community-readiness gap; CONTRIBUTING currently states basic behavior expectations. |
| Security reporting | SECURITY.md describes a private route and supported-version policy. Repository enablement and monitoring still need verification. |
| Release integrity | The documented PR → passing main checks → annotated version tag → checks/builds → draft asset assembly → publish flow is enforced for main ancestry and metadata. Clean-machine validation and repository protections remain separate requirements. |
| Supply chain | Actions are pinned and publishing has job-scoped write access. Resolved transitive dependency/asset notices and corresponding sources are prepared. Actual package/native-library inspection remains a blocker for public distribution. Moving stable Rust and runner images mean builds are not bit-for-bit reproducible. |
| Publication decision | The repository remains private. Ownership of original material is owner-confirmed, and the reachable Git history/privacy review found no detected secrets or confidential work content; see the dated report below. Third-party notices, distribution-side privacy, settings, and installation audits remain open. A private procedure test must not be described as public-launch clearance. |

GitHub settings inspected during this review: there are no classic branch protection rules or repository rulesets. GitHub reports that rulesets cannot be enforced on this private repository under the current account arrangement. At the initial review, Dependency graph, Dependabot alerts, and Dependabot security updates were off. They were enabled on 2026-10-20 together with malware alerts, grouped security updates, future-release immutability and Action SHA enforcement; see [security configuration](repository-security.md). These are concrete configuration gaps, not assumed protections; verify available enforcement and security features before public launch. No visibility or account-plan changes are part of this procedure test.

The locked npm audit initially reported three development-tool findings affecting Vitest, its mocker, and Tinypool. Updating Vitest to the patched 4.1 series cleared the npm findings. This registry audit is neither a Rust dependency audit nor a license/provenance review.

The release PR is the execution record for the procedure test: exact commit, commands/results, CI links, deferred checks, and tag/release verification. Keep the unchecked owner tasks open until evidence exists.
