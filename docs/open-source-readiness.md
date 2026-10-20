# Publication readiness

This checklist records work that must be verified before the first public source/binary release. Documentation and a license do not establish that historical material, third-party assets, or repository settings have been audited. Do not mark items complete without recording evidence in the release PR or maintainer records.

## Implemented in this preparation

- Apache-2.0 source license and npm/Cargo license metadata; npm remains private to prevent accidental registry publication. Installer resources and standalone release assets include the WorkLog license; third-party notices are a separate outstanding audit.
- Contributor practices, canonical development/architecture guides, issue and PR templates, security reporting guidance, and a release runbook.
- Checks for npm, Cargo, Tauri and lockfile version agreement, plus release-specific notes generation for tag publication.
- Release tags must point into main history. Full-commit Action pins, read-only default permissions, disabled checkout credential persistence, serialized release runs, and draft asset assembly protect the publishing path. Dependabot proposes monthly npm, Cargo, and Actions updates.

## Owner and repository tasks before publication

- [ ] Confirm rights to existing code, icons, screenshots, sample PDF/SVG, and imported material, including any employer rights. Record the intended copyright holder/year notice; none is inferred from the GitHub account.
- [ ] Review full Git history and every branch/tag intended for publication, plus release assets and workflow logs/artifacts, for secrets and private data. Rotate any exposed credentials and remove private material before publication. Review sample content and screenshots manually.
- [ ] Inventory exact locked npm and Cargo dependencies, including transitive/platform-specific components, and inspect their license texts and required notices. Review PDF.js fonts, CMaps, ICC and WASM components separately. Preserve upstream attribution; Apache-2.0 for original WorkLog material does not relicense dependencies.
- [ ] Produce the resolved third-party notice inventory and required full license texts, and include them with each binary distribution. Inspect installed packages and standalone downloads; source-only notices are insufficient. This inventory and binary notice packaging remain outstanding.
- [ ] Enable and verify GitHub private vulnerability reporting. Confirm the route in `SECURITY.md` works. Choose a monitored private conduct-reporting contact before adopting a fuller conduct policy.
- [ ] Configure protection for `main`, require review and successful Windows/Linux checks, and restrict who can push release tags. Verify Actions settings allow intended fork PR checks without secrets or privileged untrusted code execution.
- [ ] Enable dependency/security alerts and review available dependency scanning, secret scanning, and immutable-release settings. Dependabot configuration proposes updates but does not prove that repository security features are enabled.
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
| Supply chain | Actions are pinned and publishing has job-scoped write access. Complete transitive dependency/asset attribution and binary notices are still blockers for public distribution. Moving stable Rust and runner images mean builds are not bit-for-bit reproducible. |
| Publication decision | GitHub repository metadata confirms the repository is private during this assessment. Ownership, historical privacy, notices, settings, and installation audits are not established by this review. A private procedure test must not be described as public-launch clearance. |

GitHub settings inspected during this review: there are no classic branch protection rules or repository rulesets. GitHub reports that rulesets cannot be enforced on this private repository under the current account arrangement. Dependency graph, Dependabot alerts, and Dependabot security updates are off. These are concrete configuration gaps, not assumed protections; verify available enforcement and security features before public launch. No visibility or account-plan changes are part of this procedure test.

The locked npm audit initially reported three development-tool findings affecting Vitest, its mocker, and Tinypool. Updating Vitest to the patched 4.1 series cleared the npm findings. This registry audit is neither a Rust dependency audit nor a license/provenance review.

The release PR is the execution record for the procedure test: exact commit, commands/results, CI links, deferred checks, and tag/release verification. Keep the unchecked owner tasks open until evidence exists.
