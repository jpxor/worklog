# Git history privacy review

Reviewed on 2026-10-19, after fetching all advertised origin branches, tags, and pull-request source/merge refs. The reviewed release/main commit is `3076e992e9c9751a3f36858f3307cce89b14aa54` (`v0.1.26`).

## Result

No credentials, private keys, authenticated URLs, or confidential work records were detected in the reviewed Git material. No history rewrite or credential rotation is indicated by these findings. This is a scoped scan and manual inspection, not proof that arbitrary undiscovered secrets cannot exist.

The owner separately confirmed on this date that ownership of original project material is cleared and that it was generated using LLMs. This records that declaration; it does not replace the third-party dependency/license audit.

## Scope and evidence

| Material | Coverage |
| --- | --- |
| Remote branch/tag history | 13 fetched origin branch refs, excluding the duplicate origin/HEAD alias, and both advertised tags (`v0.1.21`, `v0.1.26`); 22 unique reachable commits. Includes the release-preparation branch and 11 Dependabot branches. |
| GitHub pull-request refs | All 23 advertised PR refs: 12 source heads and 11 synthetic merge refs, fetched into local `refs/history-review/pull/`. These add 11 merge commits and no new file blobs; total GitHub-reachable coverage is 33 commits. |
| Additional local history | 15 further commits retained locally, including `codex/local-history-before-sync`; 48 unique commits in the combined review. These extra commits are not reachable from the fetched GitHub branches/tags/PR refs. |
| Local checkpoint trees | 14 local Codex tree refs included in object enumeration. They are local tooling state, not advertised remote branches. |
| Historical files | 522 reachable Git objects, including 336 unique file blobs (282 UTF-8/text candidates and 54 binary blobs). Complete snapshots and printable binary strings were checked in addition to commit diffs. |
| Secret detection | Official [Gitleaks](https://github.com/gitleaks/gitleaks) 8.30.1 Windows binary, verified against its published SHA-256 checksum. Default rules, full redaction, no project baseline/ignore configuration, and inline allow comments ignored for source scans. Git scan: 36 non-merge/diff-bearing commits, approximately 2.75 MB, no findings. Independent snapshot/string scan: approximately 6.38 MB, no findings; covers file content at merge commits too. All 48 commits' metadata/messages and extracted PDF text also returned no findings. |
| Privacy checks | Reviewed URL hosts/user-info, email-like strings, private IP examples, user-directory paths, file names, and author metadata. No authenticated URLs or personal home-directory paths found in historical text. |
| Screenshots and samples | Visually inspected all nine unique screenshot images, both pages of the one historical sample PDF, and both SVG files. Screenshots show welcome/demo projects and sample notes, not identifiable customer/employer records. All 54 raster/icon image blobs were inspected for metadata: no EXIF or nonstandard metadata was found; screenshot JPEGs contain ordinary JFIF image settings. |
| PDF details | Two pages of generic WorkLog preview text; empty author/creator/producer/date metadata, no embedded files, links, or annotations. Extracted text was scanned separately. |

The scanner ran locally; repository content was not submitted to a remote secret-validation service. Candidate inventories and redacted scanner outputs are in ignored `.tools/history-review/`; they are not publication artifacts.

## Reviewed non-secret matches and publication details

- Private IPs and corporate-looking hostnames occur in synthetic MCP documentation and test fixtures. Their surrounding content identifies them as examples; no real credentials or authenticated endpoints were found.
- File-content email examples use reserved `.invalid` domains. A retina icon filename also resembled an email address to the inventory regex.
- Existing commit metadata includes the owner's name and personal email address, plus GitHub's Dependabot identity. That name/email will be visible with public history. It is a personal publication consideration, not a leaked access credential. It was not changed or redacted from history.
- The retained local pre-sync branch and Codex tree refs are distinct from origin's advertised history. They were reviewed as a precaution; publishing the current GitHub repository does not automatically publish those local-only refs. Avoid treating a mirror push as equivalent to pushing main and selected tags.

## Limits and remaining checks

This review covers the refs fetched/enumerated at review time, including all advertised GitHub PR source/merge refs. It does not claim to cover unreachable/dangling objects or reflog-only states, ignored/untracked local files, GitHub pull-request comments or attachments, issues, external backup/workspace repositories, GitHub release binaries, or CI logs/artifacts. Deleted/unadvertised server-side objects are outside this scope. New commits and newly added refs require another scan.

Release/distribution privacy inspection, dependency attribution and binary notices, repository security configuration, and clean-machine installation checks remain separate open items in [publication readiness](open-source-readiness.md). No published tag was moved and no release binary was changed as part of this review.
