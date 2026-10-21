# Repository security configuration

Verified on 2026-10-20 while the repository remained private:

| Control | State |
| --- | --- |
| Dependency graph | Enabled |
| Dependabot alerts and malware alerts | Enabled |
| Dependabot security-update PRs | Enabled, grouped by ecosystem |
| Version-update PRs | Monthly npm, Cargo and Actions configuration; compatible updates grouped, PR counts capped |
| Release immutability | Enabled for future published releases; existing releases are not retroactively secured |
| Actions full commit SHA enforcement | Enabled in repository settings; workflow actions are pinned |
| Default workflow token | Read repository contents/packages; Actions cannot create or approve PRs |
| Private fork PR execution | Disabled; retain this while private |
| Workflow components accessible to other repositories | Disabled |
| Branch/tag rulesets | Not enforced: GitHub reports this private repository needs an eligible paid plan/organization arrangement |
| GitHub private vulnerability reporting | Enable after public launch; unavailable for this private repository |
| GitHub native secret protection / code scanning | Not offered by the current private settings; revisit after visibility change |

`security.yml` adds full fetched-history Gitleaks scans, npm audit and RustSec
`cargo audit` on PRs, main pushes and a weekly schedule. It has read-only permissions,
uses no personal token and does not run `pull_request_target`. Findings must be
investigated and fixed; do not add blanket ignores to make checks pass. Neither
these checks nor Dependency alerts are a general application security audit.
Tag-triggered releases call the same security workflow and require its success
alongside both desktop builds before the release job can run.

The initial npm audit found zero vulnerabilities. RustSec 0.22.2 reported no
vulnerabilities and five informational warnings: `proc-macro-error` 1.0.4
(RUSTSEC-2024-0370), `zbus_names` 4.3.5 (RUSTSEC-2026-0371), `zvariant` 5.15.1
(RUSTSEC-2026-0370), `zvariant_derive` 5.15.1 (RUSTSEC-2026-0372) are unmaintained;
`glib` 0.18.5 has unsound VariantStrIter iterator implementations
(RUSTSEC-2024-0429). These transitive dependencies remain visible in audit output;
no advisory ignores are configured. Review upstream Tauri/GTK/zbus migrations and
whether the affected GLib iterator is used before treating this as resolved.

## Public launch settings

The 2026-10-21 launch audit identified RUSTSEC-2026-0382 and RUSTSEC-2026-0383.
Version 0.1.27 updates rustls-webpki from 0.103.15 to 0.103.16 and
webpki-root-certs from 1.0.9 to 1.0.10. A refreshed RustSec database (1,348
advisories) then reported no vulnerabilities; the five informational warnings
above remain. The local scanner could not refresh the crate index, but did
refresh the advisory database and scan the updated lockfile; CI remains the
release gate.

After an explicitly approved visibility change, enable and verify:

1. A `main` branch ruleset requiring PRs, resolved conversations, current successful
   `desktop (windows-latest)`, `desktop (ubuntu-22.04)`, `secrets`, and `dependencies`
   checks, with force pushes and deletions prohibited. Confirm check names from a
   successful PR before saving. Use zero mandatory approvals while there is only
   one maintainer (GitHub does not allow approving your own PR); require independent
   review when another reviewer is available. Avoid routine admin bypass.
2. A tag ruleset for `v*` prohibiting updates/deletions, and a separate creation
   rule restricted to release maintainers/admins. Keeping these separate permits
   authorized tag creation without granting a bypass for tag replacement. Verify
   enforcement with a disposable non-release ref; never overwrite a release tag.
3. Private vulnerability reporting; verify `SECURITY.md`'s private reporting link.
   Enable GitHub secret scanning and push protection where offered. Configure code
   scanning for the supported JavaScript/TypeScript and Rust code and review the
   first results before claiming launch clearance.
4. Fork PR workflow approval for **all outside collaborators**, no secrets and no
   write token. Never execute fork code in a privileged `pull_request_target` job.
5. Anonymous access to source, releases, issue templates and docs. Confirm the
   immutable release setting remains enabled and all assets are attached to drafts
   before publication.

The current account/visibility limit is an outstanding launch prerequisite, not
equivalent protection supplied by documentation or ancestry checks. Do not change
visibility or upgrade billing solely to work around it.
