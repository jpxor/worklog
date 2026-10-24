//! Read-only retrieval. Source text is evidence, never executable instructions.
use chrono::{DateTime, Local, NaiveDate, Utc};
use regex::RegexBuilder;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::{Component, Path},
    process::Stdio,
    time::{Duration, Instant},
};

type Result<T> = std::result::Result<T, String>;
const MAX_GIT_BYTES: u64 = 16 * 1024 * 1024;

pub fn fingerprint(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn definitions() -> Vec<Value> {
    let string = json!({"type":"string"});
    let date = json!({"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}$"});
    let page = json!({"type":"integer","minimum":0});
    let limit = json!({"type":"integer","minimum":1,"maximum":100,"default":50});
    let common = json!({"taskId":string,"projectCodeId":string,"scope":{"type":"string","enum":["all","task","global"]},"from":date,"through":date,"offset":page,"limit":limit,"expectedRevision":string});
    let specs = [
        ("list_project_codes", "Discover reporting codes, including archived codes.", vec!["offset","limit","expectedRevision"], vec![]),
        ("list_tasks", "List all projects, including closed projects, with time totals and file-date activity evidence. Dates are inclusive local work dates. Projects without matching timestamps remain discoverable: timestamps do not establish when every fact happened. includeGit adds commit-date evidence. No summaries are generated.", vec!["from","through","offset","limit","expectedRevision","includeGit"], vec![]),
        ("list_time_entries", "Read dated time allocations and descriptions, optionally by project and date range. Totals cover all matches, not just the returned page.", vec!["taskId","projectCodeId","from","through","offset","limit","expectedRevision"], vec![]),
        ("list_notes", "List note paths, file creation/modification timestamps, revisions, and attachment metadata. File dates are discovery hints; use read_note for content. Includes closed projects; saved files only.", vec!["taskId","scope","offset","limit","expectedRevision"], vec![]),
        ("search_notes", "Literal case-insensitive search of saved Markdown/text notes across all projects or one project. Returns matching lines, snippets, and note revisions. No date filter: old notes may contain relevant work. Page through all matches; external links remain in source text.", vec!["taskId","scope","query","offset","limit","expectedRevision"], vec!["query"]),
        ("read_note", "Read an exact, character-paginated Markdown/text note with line references and SHA-256 revision. Supply expectedRevision to detect changes. Optional revision is a full Git commit SHA for historical/deleted notes. Does not fetch external URLs or read binary attachments.", vec!["taskId","scope","path","revision","offset","limit","expectedRevision"], vec!["path"]),
        ("list_history", "List Git commits and changed note paths for a project, note, or all projects, with author and commit dates. Date filtering uses local commit dates; recorded dates are not proof of work dates. Use read_note with commit SHA and path to read historical notes. Deleted/renamed paths remain evidence. Git may be unavailable; failure is explicit.", vec!["taskId","scope","path","from","through","offset","limit","expectedRevision"], vec![]),
    ];
    specs.into_iter().map(|(name, description, fields, required)| {
        let mut properties = serde_json::Map::new();
        for field in fields {
            properties.insert(field.into(), match field {
                "path"|"query"|"revision" => string.clone(),
                "includeGit" => json!({"type":"boolean","default":false}),
                "limit" if name == "read_note" => json!({"type":"integer","minimum":1,"maximum":24000,"default":8000}),
                _ => common[field].clone(),
            });
        }
        json!({"name":name,"description":description,"inputSchema":{"type":"object","properties":properties,"required":required,"additionalProperties":false},"annotations":{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false}})
    }).collect()
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Query {
    task_id: Option<String>,
    project_code_id: Option<String>,
    scope: Option<String>,
    from: Option<String>,
    through: Option<String>,
    query: Option<String>,
    path: Option<String>,
    revision: Option<String>,
    expected_revision: Option<String>,
    #[serde(default)]
    offset: usize,
    limit: Option<usize>,
    #[serde(default)]
    include_git: bool,
}
impl Query {
    fn range(&self) -> Result<()> {
        match (&self.from, &self.through) {
            (Some(from), Some(through)) => {
                for date in [from, through] {
                    let parsed = NaiveDate::parse_from_str(date, "%Y-%m-%d")
                        .map_err(|_| "Use YYYY-MM-DD dates")?;
                    if parsed.format("%Y-%m-%d").to_string() != *date {
                        return Err("Use YYYY-MM-DD dates".into());
                    }
                }
                if from > through {
                    return Err("From must not follow through".into());
                }
            }
            (None, None) => {}
            _ => return Err("Supply both from and through, or neither".into()),
        }
        Ok(())
    }
    fn contains(&self, date: &str) -> bool {
        self.from.as_ref().is_none_or(|from| date >= from.as_str())
            && self.through.as_ref().is_none_or(|end| date <= end.as_str())
    }
    fn note(&self, path: &str) -> bool {
        let global = path.starts_with("global/notes/");
        match self.scope.as_deref().unwrap_or("all") {
            "global" if !global => return false,
            "task" if global => return false,
            _ => {}
        }
        self.task_id
            .as_ref()
            .is_none_or(|id| !global && path.split('/').nth(1) == Some(id.as_str()))
    }
    fn project(&self, id: &str) -> bool {
        self.task_id.as_ref().is_none_or(|project| project == id)
    }
}
fn array<'a>(snapshot: &'a Value, name: &str) -> Result<&'a Vec<Value>> {
    snapshot[name]
        .as_array()
        .ok_or_else(|| "Workspace data is unavailable".into())
}
fn text<'a>(value: &'a Value, field: &str) -> &'a str {
    value[field].as_str().unwrap_or("")
}
fn check_revision(expected: &Option<String>, actual: &str) -> Result<()> {
    if expected.as_ref().is_some_and(|expected| expected != actual) {
        return Err("Source changed. Restart pagination without expectedRevision, then use the returned revision.".into());
    }
    Ok(())
}
fn paged(items: Vec<Value>, q: &Query, revision: &str) -> Result<Value> {
    check_revision(&q.expected_revision, revision)?;
    let total = items.len();
    let limit = q.limit.unwrap_or(50);
    let end = q.offset.saturating_add(limit).min(total);
    Ok(
        json!({"items":items.into_iter().skip(q.offset).take(limit).collect::<Vec<_>>(),"total":total,"offset":q.offset,"nextOffset":if end < total {Some(end)} else {None},"revision":revision}),
    )
}

// Validate paths independently of shell parsing, including historical/deleted paths.
fn note_path(root: &Path, path: &str) -> Result<std::path::PathBuf> {
    let parts: Vec<_> = path.split('/').collect();
    if !(parts.len() >= 4 && parts[0] == "projects" && parts[2] == "notes"
        || parts.len() >= 3 && parts[0] == "global" && parts[1] == "notes")
        || path.contains(['\\', ':'])
        || parts.iter().any(|p| p.is_empty())
        || Path::new(path)
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err("Use a relative projects/<id>/notes/<file> path without traversal".into());
    }
    let mut current = root.to_path_buf();
    for part in parts {
        current.push(part);
        if fs::symlink_metadata(&current).is_ok_and(|m| m.file_type().is_symlink()) {
            return Err("Symbolic links are not supported".into());
        }
    }
    Ok(current)
}
fn is_text(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("md") || e.eq_ignore_ascii_case("txt"))
}
fn metadata(root: &Path, note: &Value) -> Result<Value> {
    let path = text(note, "path");
    let file = note_path(root, path)?;
    let metadata =
        fs::metadata(file).map_err(|_| "Note metadata is unavailable; refresh the workspace")?;
    let timestamp = |time: std::io::Result<std::time::SystemTime>| {
        time.ok().map(|t| DateTime::<Utc>::from(t).to_rfc3339())
    };
    Ok(
        json!({"path":path,"scope":if path.starts_with("global/"){ "global" }else{"task"},"taskId":if path.starts_with("global/"){None}else{path.split('/').nth(1)},"kind":note["kind"].as_str().unwrap_or("text"),"bytes":metadata.len(),"createdAt":timestamp(metadata.created()),"modifiedAt":timestamp(metadata.modified()),"revision":if note["kind"].is_string(){note["revision"].clone()}else{json!(fingerprint(text(note,"content").as_bytes()))}}),
    )
}

pub fn query(root: &Path, snapshot: &Value, name: &str, arguments: Value) -> Result<Value> {
    let definition = definitions()
        .into_iter()
        .find(|d| d["name"] == name)
        .ok_or("Unknown retrieval tool")?;
    let object = arguments.as_object().ok_or("Arguments must be an object")?;
    if object
        .keys()
        .any(|key| definition["inputSchema"]["properties"].get(key).is_none())
    {
        return Err("Unexpected tool argument".into());
    }
    let q: Query =
        serde_json::from_value(arguments).map_err(|e| format!("Invalid arguments: {e}"))?;
    q.range()?;
    if q.scope
        .as_deref()
        .is_some_and(|scope| !["all", "task", "global"].contains(&scope))
        || q.scope.as_deref() == Some("global") && q.task_id.is_some()
    {
        return Err("Invalid scope/task combination".into());
    }
    if q.path.as_ref().is_some_and(|path| !q.note(path)) {
        return Err("Path does not match scope/task constraint".into());
    }
    if q.project_code_id.as_ref().is_some_and(|id| {
        !snapshot["projectCodes"]
            .as_array()
            .is_some_and(|codes| codes.iter().any(|c| c["id"] == *id))
    }) {
        return Err("Unknown projectCodeId".into());
    }
    if q.limit
        .is_some_and(|n| n == 0 || n > if name == "read_note" { 24000 } else { 100 })
    {
        return Err("Page limit is out of range".into());
    }
    let projects = array(snapshot, "projects")?;
    if name == "list_history" {
        if let Some(id) = &q.task_id {
            if id.is_empty()
                || id.contains(['/', '\\', ':'])
                || Path::new(id)
                    .components()
                    .any(|component| !matches!(component, Component::Normal(_)))
            {
                return Err("Use a single project ID without traversal".into());
            }
        }
    } else if q
        .task_id
        .as_ref()
        .is_some_and(|id| !projects.iter().any(|p| text(p, "id") == id))
    {
        return Err("Unknown taskId".into());
    }
    if name == "read_note" {
        return read_note(root, &q);
    }
    if name == "list_history" {
        return list_history(root, &q);
    }
    let git_head = if q.include_git {
        Some(git_read(root, &["rev-parse", "--verify", "HEAD"], 100))
    } else {
        None
    };
    let git_state = match &git_head {
        Some(Ok(head)) => json!(head.trim()),
        Some(Err(error)) => json!({"error":error}),
        None => Value::Null,
    };
    let revision = fingerprint(&serde_json::to_vec(&json!({"projects":snapshot["projects"],"projectCodes":snapshot["projectCodes"],"notes":snapshot["notes"],"records":snapshot["records"],"gitHead":git_state})).map_err(|e|e.to_string())?);
    let notes = array(snapshot, "notes")?;
    let entries: Vec<_> = array(snapshot, "records")?
        .iter()
        .filter(|e| {
            text(e, "type") == "entry"
                && q.contains(text(e, "date"))
                && q.project(text(e, "projectId"))
                && q.project_code_id
                    .as_ref()
                    .is_none_or(|id| e["projectCodeId"] == *id)
        })
        .collect();
    match name {
        "list_project_codes" => paged(array(snapshot, "projectCodes")?.clone(), &q, &revision),
        "list_time_entries" => {
            let mut rows: Vec<Value> = entries
                .iter()
                .map(|e| {
                    let mut row = (*e).clone();
                    row["taskId"] = e["projectId"].clone();
                    row.as_object_mut().unwrap().remove("projectId");
                    row["taskName"] = projects
                        .iter()
                        .find(|p| p["id"] == e["projectId"])
                        .map(|p| p["name"].clone())
                        .unwrap_or(Value::Null);
                    row["projectCodeLabel"] = snapshot["projectCodes"]
                        .as_array()
                        .and_then(|codes| codes.iter().find(|c| c["id"] == e["projectCodeId"]))
                        .map(|c| c["label"].clone())
                        .unwrap_or(Value::Null);
                    row
                })
                .collect();
            rows.sort_by(|a, b| {
                text(a, "date")
                    .cmp(text(b, "date"))
                    .then(text(a, "id").cmp(text(b, "id")))
            });
            let total_minutes: u64 = rows
                .iter()
                .map(|e| e["minutes"].as_u64().unwrap_or(0))
                .sum();
            let mut result = paged(rows, &q, &revision)?;
            result["totalMinutes"] = json!(total_minutes);
            result["projectCodeTotals"] = json!(array(snapshot,"projectCodes")?.iter().filter_map(|code| {
                let minutes:u64 = entries.iter().filter(|e|e["projectCodeId"]==code["id"]).map(|e|e["minutes"].as_u64().unwrap_or(0)).sum();
                (minutes>0).then(||json!({"projectCodeId":code["id"],"label":code["label"],"minutes":minutes}))
            }).collect::<Vec<_>>());
            result["taskTotals"] = json!(projects
                .iter()
                .filter_map(|p| {
                    let minutes: u64 = entries
                        .iter()
                        .filter(|e| text(e, "projectId") == text(p, "id"))
                        .map(|e| e["minutes"].as_u64().unwrap_or(0))
                        .sum();
                    (minutes > 0)
                        .then(|| json!({"taskId":p["id"],"name":p["name"],"minutes":minutes}))
                })
                .collect::<Vec<_>>());
            Ok(result)
        }
        "list_notes" => paged(
            notes
                .iter()
                .filter(|note| q.note(text(note, "path")))
                .map(|note| metadata(root, note))
                .collect::<Result<Vec<_>>>()?,
            &q,
            &revision,
        ),
        "search_notes" => {
            let query = q
                .query
                .as_deref()
                .filter(|s| !s.trim().is_empty())
                .ok_or("Supply nonempty query text")?;
            if query.len() > 2000 {
                return Err("Search query is too long".into());
            }
            let regex = RegexBuilder::new(&regex::escape(query))
                .case_insensitive(true)
                .build()
                .map_err(|e| e.to_string())?;
            let mut matches = Vec::new();
            for note in notes
                .iter()
                .filter(|n| !n["kind"].is_string() && q.note(text(n, "path")))
            {
                let content = text(note, "content");
                let note_revision = fingerprint(content.as_bytes());
                for (index, line) in content.lines().enumerate() {
                    if let Some(found) = regex.find(line) {
                        let match_start = line[..found.start()].chars().count();
                        let start = match_start.saturating_sub(60);
                        let snippet: String = line.chars().skip(start).take(240).collect();
                        matches.push(json!({"path":note["path"],"scope":if text(note,"path").starts_with("global/"){"global"}else{"task"},"taskId":if text(note,"path").starts_with("global/"){None}else{text(note,"path").split('/').nth(1)},"line":index+1,"column":match_start+1,"snippet":snippet,"snippetStartColumn":start+1,"snippetTruncated":start>0 || line.chars().count()>start+240,"noteRevision":note_revision}));
                    }
                }
            }
            paged(matches, &q, &revision)
        }
        "list_tasks" => {
            let mut git_warning = None;
            let commits = if q.include_git {
                match git_head
                    .as_ref()
                    .unwrap()
                    .as_ref()
                    .map_err(Clone::clone)
                    .and_then(|head| history_rows(root, &q, None, head.trim()))
                {
                    Ok(rows) => rows,
                    Err(e) => {
                        git_warning = Some(e);
                        Vec::new()
                    }
                }
            } else {
                Vec::new()
            };
            let mut rows = Vec::new();
            for project in projects {
                let id = text(project, "id");
                let time: Vec<_> = entries
                    .iter()
                    .filter(|e| text(e, "projectId") == id)
                    .collect();
                let project_notes: Vec<_> = notes
                    .iter()
                    .filter(|note| text(note, "path").starts_with(&format!("projects/{id}/notes/")))
                    .collect();
                let mut events = Vec::new();
                for note in &project_notes {
                    let meta = metadata(root, note)?;
                    for (key, kind) in
                        [("createdAt", "fileCreated"), ("modifiedAt", "fileModified")]
                    {
                        if let Some(stamp) = meta[key].as_str() {
                            if let Ok(time) = DateTime::parse_from_rfc3339(stamp) {
                                let date =
                                    time.with_timezone(&Local).format("%Y-%m-%d").to_string();
                                if q.contains(&date) {
                                    events.push(json!({"kind":kind,"path":note["path"],"timestamp":stamp,"localDate":date}));
                                }
                            }
                        }
                    }
                }
                let git_events: Vec<_> = commits
                    .iter()
                    .filter(|c| {
                        c["paths"].as_array().is_some_and(|paths| {
                            paths.iter().any(|p| {
                                p.as_str()
                                    .is_some_and(|p| p.starts_with(&format!("projects/{id}/")))
                            })
                        })
                    })
                    .cloned()
                    .collect();
                let has_activity = !time.is_empty() || !events.is_empty() || !git_events.is_empty();
                let file_event_count = events.len();
                let git_count = git_events.len();
                rows.push(json!({"id":id,"name":project["name"],"closed":project["closed"],"defaultProjectCodeId":project["defaultProjectCodeId"],"noteCount":project_notes.len(),"timeEntryCount":time.len(),"totalMinutes":time.iter().map(|e|e["minutes"].as_u64().unwrap_or(0)).sum::<u64>(),"firstWorkDate":time.iter().map(|e|text(e,"date")).min(),"lastWorkDate":time.iter().map(|e|text(e,"date")).max(),"fileEvents":events.into_iter().take(10).collect::<Vec<_>>(),"fileEventCount":file_event_count,"gitCommits":git_events.into_iter().take(10).collect::<Vec<_>>(),"gitCommitCountInDiscoveryWindow":git_count,"hasActivityEvidence":has_activity}));
            }
            let mut result = paged(rows, &q, &revision)?;
            result["gitConsulted"] = json!(q.include_git);
            result["gitWarning"] = json!(git_warning);
            result["dateCaveat"] = json!("Time entries are explicit work dates. File and Git dates show when evidence was recorded, not necessarily when work occurred. All projects remain discoverable; a missing timestamp match does not exclude a project. Git discovery is limited to the latest 200 matching commits; use list_history for complete pagination. Filesystem evidence includes only the current saved workspace.");
            Ok(result)
        }
        _ => Err("Unknown retrieval tool".into()),
    }
}

fn read_note(root: &Path, q: &Query) -> Result<Value> {
    let path = q.path.as_deref().ok_or("Supply path")?;
    let file = note_path(root, path)?;
    if !is_text(path) {
        return Err("Only Markdown and text note bodies can be read".into());
    }
    let content = if let Some(revision) = &q.revision {
        if ![40, 64].contains(&revision.len()) || !revision.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("revision must be a full Git commit SHA".into());
        }
        let kind = git_read(root, &["cat-file", "-t", revision], 100)?;
        if kind.trim() != "commit" {
            return Err("revision must identify a commit".into());
        }
        let tree = git_read(root, &["ls-tree", revision, "--", path], 4096)?;
        if !(tree.starts_with("100644 blob ") || tree.starts_with("100755 blob ")) {
            return Err("Historical path is missing or is not a regular file".into());
        }
        git_read(
            root,
            &["cat-file", "blob", &format!("{revision}:{path}")],
            MAX_GIT_BYTES,
        )?
    } else {
        let metadata = fs::metadata(&file).map_err(|_| "Note not found")?;
        if metadata.len() > MAX_GIT_BYTES {
            return Err("Note exceeds the 16 MiB retrieval limit".into());
        }
        fs::read_to_string(file).map_err(|_| "Note could not be read as UTF-8")?
    };
    let revision = fingerprint(content.as_bytes());
    check_revision(&q.expected_revision, &revision)?;
    let total = content.chars().count();
    if q.offset > total {
        return Err("offset is beyond the note".into());
    }
    let text: String = content
        .chars()
        .skip(q.offset)
        .take(q.limit.unwrap_or(8000))
        .collect();
    let prefix: String = content.chars().take(q.offset).collect();
    let start_line = prefix.chars().filter(|c| *c == '\n').count() + 1;
    let end = q.offset + text.chars().count();
    Ok(
        json!({"path":path,"scope":if path.starts_with("global/"){ "global" }else{"task"},"taskId":if path.starts_with("global/"){None}else{path.split('/').nth(1)},"gitCommit":q.revision,"revision":revision,"offset":q.offset,"nextOffset":if end<total {Some(end)}else{None},"totalCharacters":total,"startLine":start_line,"endLine":start_line+text.chars().filter(|c|*c=='\n').count(),"content":text,"source":"saved file or specified Git commit; unsaved editor drafts are not shared"}),
    )
}

// Git is invoked directly, with literal paths, bounded output and a deadline.
fn git_read(root: &Path, args: &[&str], max: u64) -> Result<String> {
    if !root.join(".git").exists() {
        return Err("This workspace has no Git history".into());
    }
    let mut command = crate::storage::git_command();
    command
        .args([
            "--no-pager",
            "--no-optional-locks",
            "--literal-pathspecs",
            "-C",
        ])
        .arg(root)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|_| "Git is unavailable")?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let read = move |mut pipe: Box<dyn Read + Send>, limit: u64| {
        let mut bytes = Vec::new();
        let result = pipe.by_ref().take(limit + 1).read_to_end(&mut bytes);
        let _ = std::io::copy(&mut pipe, &mut std::io::sink());
        result.map(|_| bytes)
    };
    let out = std::thread::spawn(move || read(Box::new(stdout), max));
    let errors = std::thread::spawn(move || {
        let mut pipe = stderr;
        let mut bytes = Vec::new();
        let _ = pipe.by_ref().take(4096).read_to_end(&mut bytes);
        let _ = std::io::copy(&mut pipe, &mut std::io::sink());
    });
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if started.elapsed() > Duration::from_secs(15) {
            let _ = child.kill();
            let _ = child.wait();
            let _ = out.join();
            let _ = errors.join();
            return Err("Git retrieval timed out".into());
        }
        std::thread::sleep(Duration::from_millis(15));
    };
    let bytes = out
        .join()
        .map_err(|_| "Git output reader failed")?
        .map_err(|_| "Git output could not be read")?;
    let _ = errors.join();
    if !status.success() {
        return Err("Git history or the requested revision is unavailable".into());
    }
    if bytes.len() as u64 > max {
        return Err("Git result exceeded its size limit; narrow the request".into());
    }
    String::from_utf8(bytes).map_err(|_| "Git content is not UTF-8".into())
}
fn history_rows(
    root: &Path,
    q: &Query,
    pagination: Option<(usize, usize)>,
    head: &str,
) -> Result<Vec<Value>> {
    let (offset, limit) = pagination.unwrap_or((0, 200));
    let mut args = vec![
        "log".into(),
        "--format=%x1e%H%x00%cI%x00%aI%x00%s%x00".into(),
        "--name-only".into(),
        "--no-renames".into(),
        "-z".into(),
        format!("--max-count={}", limit + 1),
        format!("--skip={offset}"),
    ];
    if let (Some(from), Some(through)) = (&q.from, &q.through) {
        args.push(format!("--since-as-filter={from}T00:00:00"));
        args.push(format!("--until={through}T23:59:59"));
    }
    args.push(head.trim().into());
    args.push("--".into());
    let prefix = if let Some(path) = &q.path {
        note_path(root, path)?;
        if q.task_id
            .as_ref()
            .is_some_and(|id| path.split('/').nth(1) != Some(id.as_str()))
        {
            return Err("path does not belong to taskId".into());
        }
        path.clone()
    } else if let Some(id) = &q.task_id {
        format!("projects/{id}/notes")
    } else {
        if q.scope.as_deref() == Some("global") {
            "global/notes"
        } else {
            "projects"
        }
        .into()
    };
    args.push(prefix);
    if q.path.is_none() && q.task_id.is_none() && q.scope.as_deref().unwrap_or("all") == "all" {
        args.push("global/notes".into());
    }
    let output = git_read(
        root,
        &args.iter().map(String::as_str).collect::<Vec<_>>(),
        MAX_GIT_BYTES,
    )?;
    let mut result = Vec::new();
    for record in output.split('\x1e').filter(|s| !s.is_empty()) {
        let mut parts = record.split('\0');
        let sha = parts.next().unwrap_or("").trim();
        if sha.len() != 40 && sha.len() != 64 {
            return Err("Git history could not be parsed".into());
        }
        let committed = parts.next().unwrap_or("");
        let authored = parts.next().unwrap_or("");
        let subject = parts.next().unwrap_or("");
        let paths: Vec<_> = parts
            .map(|p| p.trim_start_matches('\n'))
            .filter(|p| {
                ((p.starts_with("projects/") && p.split('/').nth(2) == Some("notes"))
                    || p.starts_with("global/notes/"))
                    && is_text(p)
                    && q.note(p)
            })
            .collect();
        let notes: Vec<_> = paths.iter().map(|path| json!({"path":path,"scope":if path.starts_with("global/"){"global"}else{"task"},"taskId":if path.starts_with("global/"){None}else{path.split('/').nth(1)}})).collect();
        result.push(json!({"commit":sha,"committedAt":committed,"authoredAt":authored,"subject":subject.chars().take(500).collect::<String>(),"paths":paths,"notes":notes}));
    }
    if pagination.is_none() {
        result.truncate(200);
    }
    Ok(result)
}
fn list_history(root: &Path, q: &Query) -> Result<Value> {
    let head = git_read(root, &["rev-parse", "--verify", "HEAD"], 100)?;
    let revision = fingerprint(head.trim().as_bytes());
    check_revision(&q.expected_revision, &revision)?;
    let limit = q.limit.unwrap_or(50);
    let mut rows = history_rows(root, q, Some((q.offset, limit)), head.trim())?;
    let more = rows.len() > limit;
    rows.truncate(limit);
    Ok(
        json!({"items":rows,"offset":q.offset,"nextOffset":if more {Some(q.offset.saturating_add(limit))}else{None},"revision":revision,"dateBasis":"local commit date; author dates are returned separately; commit dates are recording evidence rather than work dates"}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    fn fixture() -> (tempfile::TempDir, Value) {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("projects/p/notes/daily/log.md");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let content="  # Work\nİ learned 🦀 Rust\nMerged [MR](https://gitlab.corp/team/repo/-/merge_requests/7)\n\n";
        fs::write(path, content).unwrap();
        let snapshot = json!({"projectCodes":[{"id":"test","label":"TEST","archived":false}],"projects":[{"id":"p","name":"Project","closed":true},{"id":"q","name":"No time","closed":false}],"notes":[{"path":"projects/p/notes/daily/log.md","content":content}],"records":[{"type":"entry","projectCodeId":"test","id":"one","projectId":"p","date":"2026-10-18","minutes":45,"note":"Built feature"},{"type":"entry","projectCodeId":"test","id":"two","projectId":"p","date":"2026-10-19","minutes":30,"note":"Follow up"}]});
        (root, snapshot)
    }
    #[test]
    fn raw_pages_preserve_unicode_whitespace_and_detect_stale_content() {
        let (root, snapshot) = fixture();
        let path = "projects/p/notes/daily/log.md";
        let first = query(
            root.path(),
            &snapshot,
            "read_note",
            json!({"path":path,"limit":17}),
        )
        .unwrap();
        let second = query(
            root.path(),
            &snapshot,
            "read_note",
            json!({"path":path,"offset":first["nextOffset"],"expectedRevision":first["revision"]}),
        )
        .unwrap();
        assert_eq!(
            format!("{}{}", text(&first, "content"), text(&second, "content")),
            snapshot["notes"][0]["content"].as_str().unwrap()
        );
        fs::write(root.path().join(path), "changed").unwrap();
        assert!(query(
            root.path(),
            &snapshot,
            "read_note",
            json!({"path":path,"expectedRevision":first["revision"]})
        )
        .unwrap_err()
        .contains("Source changed"));
    }
    #[test]
    fn scopes_pages_counts_and_date_evidence() {
        let (root, snapshot) = fixture();
        let result = query(
            root.path(),
            &snapshot,
            "list_tasks",
            json!({"from":"2026-10-18","through":"2026-10-18","limit":1}),
        )
        .unwrap();
        assert_eq!(result["total"], 2);
        assert_eq!(result["items"][0]["totalMinutes"], 45);
        assert_eq!(result["items"][0]["closed"], true);
        assert_eq!(result["nextOffset"], 1);
        let page = query(
            root.path(),
            &snapshot,
            "list_time_entries",
            json!({"limit":1}),
        )
        .unwrap();
        assert_eq!(page["totalMinutes"], 75);
        assert_eq!(page["total"], 2);
        let result = query(
            root.path(),
            &snapshot,
            "search_notes",
            json!({"query":"RUST"}),
        )
        .unwrap();
        assert_eq!(result["items"][0]["line"], 2);
        assert_eq!(result["items"][0]["column"], 13);
        let notes = query(root.path(), &snapshot, "list_notes", json!({})).unwrap();
        assert!(notes["items"][0]["modifiedAt"].is_string());
        let mut changed = snapshot.clone();
        changed["notes"][0]["content"] = json!("updated");
        assert!(query(
            root.path(),
            &changed,
            "list_tasks",
            json!({"expectedRevision":result["revision"]})
        )
        .is_err());
    }
    #[test]
    fn rejects_traversal_binary_content_invalid_dates_and_unknown_arguments() {
        let (root, snapshot) = fixture();
        for path in [
            "../settings.json",
            "projects/p/notes/../../settings.json",
            "projects/p/notes/a\\b.md",
            "projects/p/notes/image.png",
            "projects/p/notes//x.md",
        ] {
            assert!(
                query(root.path(), &snapshot, "read_note", json!({"path":path})).is_err(),
                "{path}"
            );
        }
        for args in [
            json!({"from":"2026-02-30","through":"2026-03-01"}),
            json!({"from":"2026-01-01"}),
            json!({"limit":101}),
            json!({"command":"delete"}),
        ] {
            assert!(query(root.path(), &snapshot, "list_tasks", args).is_err());
        }
        assert!(query(root.path(), &snapshot, "save_note", json!({})).is_err());
        assert!(query(
            root.path(),
            &snapshot,
            "read_note",
            json!({"path":"projects/p/notes/daily/log.md","revision":"HEAD~1"})
        )
        .is_err());
    }
    #[test]
    fn plain_file_workspace_needs_no_git_history() {
        let (root, snapshot) = fixture();
        let projects = query(
            root.path(),
            &snapshot,
            "list_tasks",
            json!({"includeGit":true}),
        )
        .unwrap();
        assert_eq!(projects["items"][0]["totalMinutes"], 75);
        assert!(projects["gitWarning"].is_string());
        assert!(
            query(
                root.path(),
                &snapshot,
                "search_notes",
                json!({"query":"learned"})
            )
            .unwrap()["items"]
                .as_array()
                .unwrap()
                .len()
                > 0
        );
        assert!(query(root.path(), &snapshot, "list_history", json!({})).is_err());
        let note = query(
            root.path(),
            &snapshot,
            "read_note",
            json!({"path":"projects/p/notes/daily/log.md"}),
        )
        .unwrap();
        assert_eq!(note["content"], snapshot["notes"][0]["content"]);
    }
    #[test]
    fn global_scope_and_code_totals_are_independent_of_pagination() {
        let (root, mut snapshot) = fixture();
        fs::create_dir_all(root.path().join("global/notes")).unwrap();
        fs::write(root.path().join("global/notes/shared.md"), "shared Rust").unwrap();
        snapshot["notes"]
            .as_array_mut()
            .unwrap()
            .push(json!({"path":"global/notes/shared.md","content":"shared Rust"}));
        let all = query(root.path(), &snapshot, "list_notes", json!({})).unwrap();
        assert_eq!(all["total"], 2);
        let global = query(
            root.path(),
            &snapshot,
            "list_notes",
            json!({"scope":"global"}),
        )
        .unwrap();
        assert_eq!(global["total"], 1);
        assert_eq!(global["items"][0]["scope"], "global");
        assert!(global["items"][0]["taskId"].is_null());
        assert!(query(
            root.path(),
            &snapshot,
            "list_notes",
            json!({"scope":"global","taskId":"p"})
        )
        .is_err());
        assert!(query(
            root.path(),
            &snapshot,
            "read_note",
            json!({"path":"global/notes/shared.md","scope":"task"})
        )
        .is_err());
        let page = query(
            root.path(),
            &snapshot,
            "list_time_entries",
            json!({"projectCodeId":"test","limit":1}),
        )
        .unwrap();
        assert_eq!(page["totalMinutes"], 75);
        assert_eq!(page["projectCodeTotals"][0]["minutes"], 75);
        assert_eq!(page["taskTotals"][0]["minutes"], 75);
        assert_eq!(page["items"].as_array().unwrap().len(), 1);
        assert_eq!(page["items"][0]["taskId"], "p");
        assert_eq!(page["items"][0]["projectCodeLabel"], "TEST");
        let read = query(
            root.path(),
            &snapshot,
            "read_note",
            json!({"path":"global/notes/shared.md"}),
        )
        .unwrap();
        assert_eq!(read["scope"], "global");
        assert!(read["taskId"].is_null());
        let mut changed = snapshot.clone();
        changed["projectCodes"][0]["label"] = json!("RENAMED");
        assert!(query(
            root.path(),
            &changed,
            "list_time_entries",
            json!({"expectedRevision":page["revision"]})
        )
        .is_err());
        changed = snapshot.clone();
        changed["notes"][1]["content"] = json!("new global text");
        assert!(query(
            root.path(),
            &changed,
            "list_notes",
            json!({"expectedRevision":all["revision"]})
        )
        .is_err());
    }
    fn git(root: &Path, args: &[&str]) {
        assert!(Command::new("git")
            .arg("-C")
            .arg(root)
            .args(args)
            .env("GIT_AUTHOR_DATE", "2026-10-18T12:00:00-04:00")
            .env("GIT_COMMITTER_DATE", "2026-10-18T12:00:00-04:00")
            .output()
            .unwrap()
            .status
            .success());
    }
    #[test]
    fn git_history_reads_deleted_notes_and_keeps_full_content() {
        let (root, snapshot) = fixture();
        let path = "projects/p/notes/daily/log.md";
        git(root.path(), &["init"]);
        git(root.path(), &["add", "."]);
        git(
            root.path(),
            &[
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.invalid",
                "-c",
                "commit.gpgSign=false",
                "commit",
                "-m",
                "Record work",
            ],
        );
        let history = query(
            root.path(),
            &snapshot,
            "list_history",
            json!({"taskId":"p","from":"2026-01-01","through":"2026-12-31","limit":1}),
        )
        .unwrap();
        assert_eq!(history["items"].as_array().unwrap().len(), 1);
        assert_eq!(history["items"][0]["paths"][0], path);
        let commit = history["items"][0]["commit"].as_str().unwrap();
        fs::remove_file(root.path().join(path)).unwrap();
        let note = query(
            root.path(),
            &snapshot,
            "read_note",
            json!({"path":path,"revision":commit}),
        )
        .unwrap();
        assert_eq!(note["content"], snapshot["notes"][0]["content"]);
        git(root.path(), &["add", "."]);
        git(
            root.path(),
            &[
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.invalid",
                "-c",
                "commit.gpgSign=false",
                "commit",
                "-m",
                "Remove old note",
            ],
        );
        assert!(query(
            root.path(),
            &snapshot,
            "list_history",
            json!({"expectedRevision":history["revision"]})
        )
        .is_err());
        let discovery = query(
            root.path(),
            &json!({"projects":snapshot["projects"],"notes":[],"records":[]}),
            "list_tasks",
            json!({"includeGit":true}),
        )
        .unwrap();
        assert!(
            discovery["items"][0]["gitCommitCountInDiscoveryWindow"]
                .as_u64()
                .unwrap()
                > 0
        );
    }
}
