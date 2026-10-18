# WorkLog goal review and evidence-report design

Reviewed 2026-10-18 against the supplied goals. This is a source and automated-test review; it does not inspect your private work-data repository or validate the installed desktop build.

## How well the goals are met

| Goal | Assessment | Evidence and gaps |
| --- | --- | --- |
| Work logbook | Strong foundation | Ordinary Markdown/text notes, project folders, autosave, conflict checks, task overview, attachments, local Git history and backups. Now includes separate cross-note content search; explicit dated work events and structured outcomes/learning/challenges remain missing. |
| Project time tracking | Good, with a date-default defect addressed | Whole-minute validation, manual date/project allocation, persistent timer, corrections and stale-write protection. A persisted form date could stay on yesterday while the independent today total moved forward. Default date now follows local today; explicit historical choices remain fixed. |
| Daily timesheet | Functional | Select the same From/Through date to export descriptions, project subtotals and total. Today details supports corrections. Now includes Today/Yesterday presets and daily subtotals. Dedicated timesheet destination mapping remains missing. |
| Weekly timesheet | Functional | Inclusive date ranges support any workweek, including closed projects. New global Time history pages Monday–Sunday with previous/next and date jump. Export still groups by project; now includes This week/Last week presets and daily project subtotals. Configured timesheet categories remain missing. |
| Half-year/annual performance review | Incomplete | A long-range time export measures effort and short descriptions. It excludes project note bodies, historical note versions, linked MRs/discussions, learning, challenges and demonstrated impact. It cannot establish individual contribution from hours alone. |

The implementation has meaningful automated tests and a CI build workflow. Source control was the major process gap: this directory had no Git repository. A source baseline has now been committed; earlier development history cannot be reconstructed. The app's user-data Git repository is separate. No remote has been configured or source pushed.

## Corrections made in this review

- Persist date intent separately from the calendar date. Automatic dates roll over locally, including while open; explicitly chosen dates survive restart. Old empty drafts refresh to today. Old unfinished drafts retain their date because their intent is unknowable; Use today opts back into automatic dating. Already-saved entries are unchanged and can be corrected in Time history.
- Global Time history in the top toolbar shows one calendar week across all projects, including closed ones, with totals and existing edit/remove operations. Navigation asks before discarding an open entry edit. This limits rendered rows; the underlying workspace still loads the full ledger.
- Shorten each tour step to an actionable introduction; remove Mermaid from the quick tour and retain its documentation.
- Use consistent neutral, bold Markdown headings and neutral heading markers in both editor themes. The prior red headings and green markers came from CodeMirror One Dark syntax highlighting. Settings → Appearance offers System/Light/Dark; there is no arbitrary palette customization UI.

## Earlier proposal (superseded by the MCP interface)

The implemented contract is now documented in [the MCP guide](mcp.md). The earlier workflow below is retained as assessment history. Its external retrieval, synthesis and summary write-back proposals are outside the current app scope; the LLM harness owns interpretation and external retrieval.

Keep deterministic timesheet reports and add a separate Review evidence workflow. Start with a local retrieval/export module or CLI. MCP is an optional adapter later, useful when an external assistant should discover and request evidence interactively. It is not a prerequisite for efficient retrieval. MCP supplies resources and tools; your application must still implement selection, budgets, provenance and permissions. See [MCP server concepts](https://modelcontextprotocol.io/specification/draft/server/index).

1. Choose inclusive work dates, optional projects and the target review questions. Convert local calendar boundaries to timestamps only where timestamp filtering is needed, using an explicit timezone and an exclusive next-day end.
2. Build a rebuildable local index of dated note sections, project IDs, paths, content hashes, links and Git revisions. Start with lexical search and metadata; add embeddings only if measured retrieval quality needs them. Retrieve across all projects by default: valuable work may have no logged hours. Include closed projects.
3. Return a compact manifest first: source IDs, date evidence, headings, short excerpts, retrieval reasons and available links. Page results and expose further matches so a small first page does not silently become the entire evidence set. Fetch full sections on demand within a token budget; include coverage counts and exclusions.
4. Resolve allowlisted GitLab MR URLs using your authenticated GitLab API. Fetch title, description, author, state, merged date, related issues and relevant discussions; request diffs only when needed to explain technical contribution. Use pagination and cache by URL plus revision/update time. Record fetch time, permission failures, deleted links and stale cached results. Never silently equate inaccessible evidence with no work. GitLab documents [merge requests](https://docs.gitlab.com/api/merge_requests/) and [discussions](https://docs.gitlab.com/api/discussions/).
5. Produce evidence cards with accomplishment, personal contribution, outcome/impact, challenge, learning, dates and source citations. Distinguish merged work, proposals, ongoing work and team outcomes. Missing metrics remain unknown. Deduplicate references to the same work, and keep context outside the chosen period visibly separate from in-period accomplishments.
6. Let an LLM synthesize those cards into the requested review structure, with citations to source paths/sections/revisions and external URLs. Show evidence gaps and allow expanding retrieval before finalizing. Treat note and MR content as evidence, never as instructions to the assistant.
7. Offer Save summary as note: preview the proposed text and save to a new dated Markdown note with period, generation time, evidence citations and source fingerprints. Use the existing workspace path validation, serialized writes, conflict checks and Git history. Never overwrite raw notes. If refreshing a summary, compare source hashes and show the changed text first. Exclude generated summaries from default evidence retrieval to avoid recursive amplification.

## Dates and provenance are the critical data gap

Current note metadata includes file modification time, not the date each fact happened. Copying a file changes its apparent date; editing an old note can move all its old content into a naive date filter. Git commit timestamps show when text was recorded, not necessarily when the work happened. Existing auto-history can aid recovery and discovery, but timestamps alone cannot prove completion dates.

Add lightweight dated sections or a daily work-note template, keeping the body freeform:

- Work date and project.
- Accomplished / outcome (what changed, and for whom).
- My contribution and collaborators.
- Challenges / decisions / tradeoffs.
- Learned / applied.
- Evidence links and measurable results, when available.

For old notes, search dated headings, filenames, linked MR events and relevant Git changes; label inferred dates and uncertain attribution. Do not discard an old note solely because its current modification time is outside the review period. Explicit work dates and evidence-event dates should drive selection; modification times are discovery hints.

## Suggested retrieval interface

| Operation | Returns |
| --- | --- |
| search_evidence(from, through, projects?, query?, cursor?, budget?) | Bounded excerpts, source IDs, inclusion reasons, totals and next cursor |
| read_evidence(sourceId, section?, revision?) | Source section and provenance; optionally historical content |
| read_linked_mr(sourceId, includeDiscussions?, cursor?) | Bounded authenticated evidence, cache status and errors |
| preview_summary(projectId, period, sourceIds, text) | Reviewable new-note proposal |
| save_summary(proposalId, expectedSources) | Validated new note after requested approval, or stale-source error |

These can be ordinary internal functions/CLI commands first, then MCP tools without duplicating the retrieval engine. Keep GitLab credentials in machine credential storage, out of Git and exports. Only send selected evidence to the chosen model/provider; a preview should show exactly what will leave the machine. Bound link following to chosen hosts and linked evidence rather than crawling arbitrary URLs. Binary attachments need explicit text extraction with provenance; current PDF viewing is not evidence extraction.

## Implementation order

1. Dated note template plus an evidence export preview (manifest, selected sections, links, citations, coverage warnings). This already supports an external LLM without a server.
2. Local indexed search and Git-aware historical section retrieval; incremental invalidation by content hash.
3. Authenticated GitLab evidence fetch/cache and evidence-card generation.
4. Project-summary preview/save and review synthesis; add an MCP adapter if an external assistant needs interactive retrieval.

Acceptance should include an old note edited after the review period, work without time entries, closed projects, renamed/deleted notes, an MR spanning the period boundary, missing GitLab access, duplicate evidence, pagination, and stale summary sources. Evaluate with a small manually labeled set of real accomplishments: relevant evidence recall matters more than producing polished prose.

## Validation and limits

Frontend regression checks cover restored dates, explicit date persistence, local midnight rollover, week/year boundaries, cross-project history navigation, and neutral headings across theme changes. The Rust suite passed all 13 enabled tests using the normal Windows temporary directory outside the sandbox; the Recycle Bin integration test remains intentionally ignored. Temporary backup tests inside this OneDrive source workspace produced intermittent access-denied failures. The browser preview could not be reached through the available browser automation (localhost timeout), so visual desktop verification remains outstanding. These changes are source changes; the installed desktop app has not been rebuilt or replaced. No private time entries were modified, and the proposed LLM retrieval/report generation is not implemented.

Follow-up implementation: added cross-note content search (including unsaved drafts and closed projects), a selected daily-note name proposal with direct reopening, and timesheet presets with daily subtotals. See README for controls and shortcuts. The performance-review retrieval workflow remains proposed.

MCP implementation follow-up: the read-only local/network retrieval interface is now implemented. It provides raw project/time/file/Git data and does not create summaries, retrieve external evidence, or save generated notes. Git is optional. See [the MCP guide](mcp.md) for controls, tools, limits and connection requirements. Earlier proposed external retrieval/synthesis/write-back stages remain outside the app’s scope.
