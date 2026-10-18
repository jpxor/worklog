use fs2::FileExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{hash_map::DefaultHasher, HashMap, HashSet},
    fs::{self, File, OpenOptions},
    hash::{Hash, Hasher},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn stamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Config {
    root: String,
    backup_path: String,
    last_backup: String,
    backup_time: String,
    backup_slot: String,
    backup_fingerprint: String,
    backup_error: String,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            root: String::new(),
            backup_path: String::new(),
            last_backup: String::new(),
            backup_time: "17:00".into(),
            backup_slot: String::new(),
            backup_fingerprint: String::new(),
            backup_error: String::new(),
        }
    }
}

fn hash_data(root: &Path, current: &Path, hash: &mut DefaultHasher) -> Result<()> {
    let mut entries = fs::read_dir(current)
        .map_err(err)?
        .collect::<std::io::Result<Vec<_>>>()
        .map_err(err)?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let path = entry.path();
        if current == root
            && (entry.file_name() == ".git" || entry.file_name() == ".worknotes.lock")
        {
            continue;
        }
        let kind = entry.file_type().map_err(err)?;
        if kind.is_symlink() {
            return Err("Backup does not support symbolic links".into());
        }
        path.strip_prefix(root).map_err(err)?.hash(hash);
        kind.is_dir().hash(hash);
        if kind.is_dir() {
            hash_data(root, &path, hash)?;
        } else {
            let mut file = File::open(&path).map_err(err)?;
            file.metadata().map_err(err)?.len().hash(hash);
            let mut buffer = [0; 65536];
            loop {
                let size = file.read(&mut buffer).map_err(err)?;
                if size == 0 {
                    break;
                }
                hash.write(&buffer[..size]);
            }
        }
    }
    Ok(())
}

pub struct Store {
    inner: Arc<Mutex<Workspace>>,
}
impl Store {
    pub fn new(config_dir: PathBuf) -> Self {
        Self {
            inner: Arc::new(Mutex::new(Workspace {
                config_dir,
                config: Config::default(),
                lock: None,
                git_status: String::new(),
                loaded: false,
            })),
        }
    }
    pub fn shared(&self) -> Arc<Mutex<Workspace>> {
        self.inner.clone()
    }
}
pub struct Workspace {
    config_dir: PathBuf,
    config: Config,
    lock: Option<File>,
    git_status: String,
    loaded: bool,
}

fn field<'a>(v: &'a Value, key: &str) -> Result<&'a str> {
    v.get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Missing {key}"))
}
pub(crate) fn atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().ok_or("Invalid destination")?;
    fs::create_dir_all(parent).map_err(err)?;
    let mut file = tempfile::NamedTempFile::new_in(parent).map_err(err)?;
    file.write_all(bytes).map_err(err)?;
    file.as_file().sync_all().map_err(err)?;
    file.persist(path).map_err(err)?;
    Ok(())
}
pub fn write_export(path: &str, content: &str) -> Result<()> {
    atomic(Path::new(path), content.as_bytes())
}
fn read_json(path: &Path) -> Result<Value> {
    serde_json::from_slice(&fs::read(path).map_err(err)?).map_err(err)
}

fn git(root: &Path, args: &[&str]) -> Result<String> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(root)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "Never")
        .env("GIT_SSH_COMMAND", "ssh -o BatchMode=yes")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command
        .spawn()
        .map_err(|e| format!("Git unavailable: {e}"))?;
    // Drain pipes concurrently so a larger Git response cannot deadlock the process.
    let mut stdout = child.stdout.take().unwrap();
    let mut stderr = child.stderr.take().unwrap();
    let out = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = stdout.read_to_string(&mut s);
        s
    });
    let errors = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = stderr.read_to_string(&mut s);
        s
    });
    let start = Instant::now();
    let status = loop {
        if let Some(s) = child.try_wait().map_err(err)? {
            break s;
        }
        if start.elapsed() > Duration::from_secs(40) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(
                "Git timed out. Local data is safe; check network and authentication.".into(),
            );
        }
        std::thread::sleep(Duration::from_millis(30));
    };
    let output = out.join().unwrap_or_default();
    let error = errors.join().unwrap_or_default();
    if !status.success() {
        return Err(format!("Git: {}", error.trim()));
    }
    Ok(output.trim().to_string())
}

fn validate_name(name: &str) -> Result<()> {
    if name.trim().is_empty() || name.chars().any(|c| c.is_control()) {
        return Err("Enter a nonempty project name without control characters".into());
    }
    Ok(())
}
fn text_note(path: &Path) -> bool {
    path.extension()
        .and_then(|s| s.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("txt")
        })
}
fn document_kind(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "pdf" => Some("pdf"),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "svg" | "ico" => Some("image"),
        _ => None,
    }
}
fn empty_folder(path: &Path) -> Result<()> {
    for item in fs::read_dir(path).map_err(err)? {
        let item = item.map_err(err)?;
        let kind = item.file_type().map_err(err)?;
        if kind.is_symlink() {
            return Err("Folder links are not supported".into());
        }
        if kind.is_dir() {
            empty_folder(&item.path())?;
        } else if item.file_name() != ".gitkeep" {
            return Err(
                "Only empty folders can be deleted. Move or delete their files first.".into(),
            );
        }
    }
    Ok(())
}
fn delete_item(path: &Path, folder: bool, permanent: bool) -> Result<()> {
    if permanent {
        if folder {
            fs::remove_dir_all(path).map_err(err)
        } else {
            fs::remove_file(path).map_err(err)
        }
    } else {
        crate::system_trash::move_to_bin(path)
            .map_err(|error| format!("TRASH_UNAVAILABLE: {error}"))
    }
}
fn walk(
    root: &Path,
    current: &Path,
    notes: &mut Vec<Value>,
    folders: &mut Vec<String>,
) -> Result<()> {
    for item in fs::read_dir(current).map_err(err)? {
        let item = item.map_err(err)?;
        let kind = item.file_type().map_err(err)?;
        if kind.is_symlink() {
            return Err("Symbolic links are not supported inside project notes".into());
        }
        let path = item.path();
        let relative = path
            .strip_prefix(root)
            .map_err(err)?
            .to_string_lossy()
            .replace('\\', "/");
        if kind.is_dir() {
            folders.push(relative);
            walk(root, &path, notes, folders)?;
        } else if text_note(&path) {
            let modified = fs::metadata(&path)
                .map_err(err)?
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|time| time.as_millis() as u64)
                .unwrap_or(0);
            notes.push(json!({"path":relative,"content":fs::read_to_string(path).map_err(err)?,"modified":modified}));
        } else if let Some(kind) = document_kind(&path) {
            let metadata = fs::metadata(&path).map_err(err)?;
            let modified = metadata
                .modified()
                .map_err(err)?
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos();
            notes.push(json!({"path":relative,"content":"","kind":kind,"revision":format!("{}-{modified}",metadata.len()),"modified":(modified / 1_000_000) as u64}));
        }
    }
    Ok(())
}
fn validate_ledger(records: &[Value], projects: &HashSet<String>) -> Result<()> {
    let mut ids = HashSet::new();
    let mut active = HashMap::new();
    for r in records {
        let id = field(r, "id")?;
        if id.is_empty() || !ids.insert(id.to_string()) {
            return Err("Duplicate or missing ledger ID".into());
        }
        match field(r, "type")? {
            "entry" => {
                if !projects.contains(field(r, "projectId")?) {
                    return Err("Unknown project in time ledger".into());
                }
                let date = field(r, "date")?;
                let parsed = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
                    .map_err(|_| "Invalid work date")?;
                if parsed.format("%Y-%m-%d").to_string() != date {
                    return Err("Invalid work date".into());
                }
                if !r
                    .get("minutes")
                    .and_then(Value::as_u64)
                    .is_some_and(|m| m > 0 && m <= 9_007_199_254_740_991)
                {
                    return Err("Duration must be positive whole minutes".into());
                }
                field(r, "note")?;
                if let Some(old) = r.get("replaces") {
                    if active
                        .remove(old.as_str().ok_or("Invalid replacement")?)
                        .is_none()
                    {
                        return Err("Correction references an inactive entry".into());
                    }
                }
                active.insert(id.to_string(), true);
            }
            "void" => {
                if active.remove(field(r, "target")?).is_none() {
                    return Err("Void references an inactive entry".into());
                }
            }
            _ => return Err("Unknown ledger record type".into()),
        }
    }
    Ok(())
}
fn validate_entries(records: &[Value], projects: &HashSet<String>) -> Result<()> {
    if records
        .iter()
        .any(|r| r["type"] != "entry" || r.get("replaces").is_some())
    {
        return Err("Time data must contain current entries, not correction events".into());
    }
    validate_ledger(records, projects)
}
fn current_legacy_entries(records: &[Value]) -> Vec<Value> {
    let mut active = HashSet::new();
    for r in records {
        if r["type"] == "entry" {
            if let Some(id) = r["replaces"].as_str() {
                active.remove(id);
            }
            active.insert(r["id"].as_str().unwrap().to_string());
        } else {
            active.remove(r["target"].as_str().unwrap());
        }
    }
    records
        .iter()
        .filter(|r| r["type"] == "entry" && active.contains(r["id"].as_str().unwrap()))
        .map(|r| {
            let mut entry = r.clone();
            entry.as_object_mut().unwrap().remove("replaces");
            entry
        })
        .collect()
}
fn entries_bytes(entries: &[Value]) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    for entry in entries {
        bytes.extend(serde_json::to_vec(entry).map_err(err)?);
        bytes.push(b'\n');
    }
    Ok(bytes)
}
fn copy_tree(source: &Path, dest: &Path) -> Result<()> {
    fs::create_dir_all(dest).map_err(err)?;
    for item in fs::read_dir(source).map_err(err)? {
        let item = item.map_err(err)?;
        let name = item.file_name();
        if name == ".worknotes.lock" {
            continue;
        }
        let kind = item.file_type().map_err(err)?;
        if kind.is_symlink() {
            return Err("Backup refused a symbolic link".into());
        }
        if kind.is_dir() {
            copy_tree(&item.path(), &dest.join(name))?;
        } else {
            fs::copy(item.path(), dest.join(name)).map_err(err)?;
        }
    }
    Ok(())
}

impl Workspace {
    pub(crate) fn evidence_root(&self) -> Result<PathBuf> {
        self.root()
    }
    pub(crate) fn evidence_snapshot(&self) -> Result<Value> {
        self.snapshot()
    }
    fn persist_config(&self) -> Result<()> {
        atomic(
            &self.config_dir.join("settings.json"),
            &serde_json::to_vec_pretty(&self.config).map_err(err)?,
        )
    }
    fn root(&self) -> Result<PathBuf> {
        if self.config.root.is_empty() {
            Err("Choose a local data folder first".into())
        } else {
            Ok(PathBuf::from(&self.config.root))
        }
    }
    fn safe(&self, relative: &str) -> Result<PathBuf> {
        let root = self.root()?;
        let path = Path::new(relative);
        if relative.contains('\\')
            || relative.contains(':')
            || path
                .components()
                .any(|c| !matches!(c, Component::Normal(_)))
        {
            return Err("Use a relative project path without traversal".into());
        }
        let mut result = root;
        for component in path.components() {
            result.push(component);
            if result.exists()
                && fs::symlink_metadata(&result)
                    .map_err(err)?
                    .file_type()
                    .is_symlink()
            {
                return Err("Symbolic link paths are not supported".into());
            }
        }
        Ok(result)
    }
    fn note_path(&self, relative: &str) -> Result<PathBuf> {
        let parts: Vec<_> = relative.split('/').collect();
        if parts.len() < 4
            || parts[0] != "projects"
            || parts[2] != "notes"
            || (!text_note(Path::new(relative)) && document_kind(Path::new(relative)).is_none())
        {
            return Err("Choose a supported file inside a project's notes folder".into());
        }
        let path = self.safe(relative)?;
        if !self
            .root()?
            .join("projects")
            .join(parts[1])
            .join("project.json")
            .is_file()
        {
            return Err("Unknown project".into());
        }
        Ok(path)
    }
    fn remote(&self) -> String {
        self.root()
            .ok()
            .and_then(|p| git(&p, &["remote", "get-url", "origin"]).ok())
            .unwrap_or_default()
    }
    fn commit(&mut self) {
        let result = (|| -> Result<()> {
            let root = self.root()?;
            if !root.join(".git").exists() {
                git(&root, &["init", "-b", "main"])?;
            }
            git(&root, &["add", "--", "."])?;
            if !git(&root, &["status", "--porcelain"])?.is_empty() {
                git(
                    &root,
                    &[
                        "-c",
                        "user.name=WorkLog",
                        "-c",
                        "user.email=worknotes@local.invalid",
                        "commit",
                        "-m",
                        "Save WorkLog changes",
                    ],
                )?;
            }
            self.git_status = "History up to date".into();
            Ok(())
        })();
        if let Err(e) = result {
            self.git_status = format!("Saved locally; {e}");
        }
    }
    fn open(&mut self, path: &str) -> Result<()> {
        let path = PathBuf::from(path);
        if !path.is_absolute() {
            return Err("Choose an absolute local folder path".into());
        }
        fs::create_dir_all(&path).map_err(err)?;
        let root = path.canonicalize().map_err(err)?;
        if self.config.root == root.to_string_lossy() && self.lock.is_some() {
            return Ok(());
        }
        let marker = root.join("worknotes.json");
        if !marker.exists() {
            if fs::read_dir(&root).map_err(err)?.next().is_some() {
                return Err("Folder is not empty and does not contain WorkLog data".into());
            }
            atomic(&marker, b"{\"format\":\"worknotes\",\"version\":2}\n")?;
            fs::create_dir(root.join("projects")).map_err(err)?;
            atomic(&root.join("projects/.gitkeep"), b"")?;
            atomic(&root.join("time.jsonl"), b"")?;
            atomic(
                &root.join(".gitignore"),
                b".worknotes.lock\n.worknotes-tmp*\n",
            )?;
        }
        let format = read_json(&marker)?;
        if format["format"] != "worknotes" || (format["version"] != 1 && format["version"] != 2) {
            return Err("Unsupported WorkLog data format".into());
        }
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(root.join(".worknotes.lock"))
            .map_err(err)?;
        lock.try_lock_exclusive()
            .map_err(|_| "This data folder is open in another WorkLog instance")?;
        // Validate before switching away from the current workspace.
        let previous = self.config.clone();
        let old_lock = self.lock.take();
        self.config.root = root.to_string_lossy().into();
        self.lock = Some(lock);
        if let Err(e) = self
            .snapshot()
            .and_then(|snapshot| self.migrate_time(&snapshot))
        {
            self.config = previous;
            self.lock = old_lock;
            return Err(e);
        }
        if self.config.root != previous.root {
            self.config.backup_slot.clear();
            self.config.backup_fingerprint.clear();
            self.config.backup_error.clear();
            self.config.last_backup.clear();
        }
        self.persist_config()?;
        self.commit();
        Ok(())
    }
    fn migrate_time(&self, snapshot: &Value) -> Result<()> {
        let root = self.root()?;
        let mut marker = read_json(&root.join("worknotes.json"))?;
        if marker["version"] != 1 {
            return Ok(());
        }
        let records = snapshot["records"]
            .as_array()
            .ok_or("Invalid legacy time data")?;
        let backup = self.safe(".migration/time-v1.jsonl")?;
        if !backup.exists() {
            atomic(&backup, &fs::read(root.join("time.jsonl")).map_err(err)?)?;
        }
        atomic(
            &root.join("time.jsonl"),
            &entries_bytes(&current_legacy_entries(records))?,
        )?;
        marker["version"] = json!(2);
        atomic(
            &root.join("worknotes.json"),
            &serde_json::to_vec_pretty(&marker).map_err(err)?,
        )?;
        Ok(())
    }
    fn snapshot(&self) -> Result<Value> {
        if self.config.root.is_empty() {
            return Ok(
                json!({"root":"","projects":[],"notes":[],"folders":[],"records":[],"git":self.git_status,"remote":"","backupPath":self.config.backup_path,"lastBackup":self.config.last_backup,"backupTime":self.config.backup_time,"backupSlot":self.config.backup_slot,"backupError":self.config.backup_error}),
            );
        }
        let root = self.root()?;
        let mut projects = Vec::new();
        let mut notes = Vec::new();
        let mut folders = Vec::new();
        let mut ids = HashSet::new();
        for item in fs::read_dir(root.join("projects")).map_err(err)? {
            let item = item.map_err(err)?;
            if item.file_type().map_err(err)?.is_symlink() {
                return Err("Project links are not supported".into());
            }
            if !item.path().is_dir() {
                continue;
            }
            let p = read_json(&item.path().join("project.json"))?;
            let id = field(&p, "id")?;
            validate_name(field(&p, "name")?)?;
            if id != item.file_name().to_string_lossy()
                || !ids.insert(id.to_string())
                || !p["closed"].is_boolean()
            {
                return Err("Invalid project metadata".into());
            }
            let path = item.path().join("notes");
            if path.exists() {
                if fs::symlink_metadata(&path)
                    .map_err(err)?
                    .file_type()
                    .is_symlink()
                {
                    return Err("Note folder links are not supported".into());
                }
                walk(&root, &path, &mut notes, &mut folders)?;
            }
            projects.push(p);
        }
        projects.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
        notes.sort_by(|a, b| a["path"].as_str().cmp(&b["path"].as_str()));
        let text = fs::read_to_string(root.join("time.jsonl")).map_err(err)?;
        let mut records = Vec::new();
        if !text.is_empty() && !text.ends_with('\n') {
            return Err("Time ledger has an incomplete final line. Data preserved; repair it before continuing.".into());
        }
        for (n, line) in text.lines().enumerate() {
            records.push(
                serde_json::from_str::<Value>(line)
                    .map_err(|e| format!("Ledger line {}: {e}. Data preserved.", n + 1))?,
            );
        }
        let format = read_json(&root.join("worknotes.json"))?;
        if format["format"] != "worknotes" {
            return Err("Invalid WorkLog format".into());
        }
        if format["version"] == 1 {
            validate_ledger(&records, &ids)?;
        } else if format["version"] == 2 {
            validate_entries(&records, &ids)?;
        } else {
            return Err("Unsupported WorkLog data format".into());
        }
        Ok(
            json!({"root":self.config.root,"projects":projects,"notes":notes,"folders":folders,"records":records,"git":self.git_status,"remote":self.remote(),"backupPath":self.config.backup_path,"lastBackup":self.config.last_backup,"backupTime":self.config.backup_time,"backupSlot":self.config.backup_slot,"backupError":self.config.backup_error}),
        )
    }
    pub fn read_document(&self, root: &str, relative: &str) -> Result<Vec<u8>> {
        if root != self.config.root {
            return Err("The workspace changed; reopen the file".into());
        }
        if document_kind(Path::new(relative)).is_none() {
            return Err("Unsupported document type".into());
        }
        let path = self.note_path(relative)?;
        fs::read(path).map_err(err)
    }
    pub fn dispatch(&mut self, action: &str, p: Value) -> Result<Value> {
        if !self.loaded {
            if self.config_dir.join("settings.json").exists() {
                self.config = serde_json::from_slice(
                    &fs::read(self.config_dir.join("settings.json")).map_err(err)?,
                )
                .map_err(err)?;
            }
            self.loaded = true;
            let root = self.config.root.clone();
            self.config.root.clear();
            if !root.is_empty() {
                self.open(&root)?;
            }
        }
        match action {
            "load" => {}
            "open_workspace" => self.open(field(&p, "path")?)?,
            "create_project" => {
                let name = field(&p, "name")?.trim();
                validate_name(name)?;
                let snap = self.snapshot()?;
                if snap["projects"].as_array().unwrap().iter().any(|v| {
                    v["name"]
                        .as_str()
                        .is_some_and(|s| s.to_lowercase() == name.to_lowercase())
                }) {
                    return Err(
                        "A project with that name already exists (check closed projects)".into(),
                    );
                }
                let id = uuid::Uuid::new_v4().to_string();
                let root = self.root()?.join("projects").join(&id);
                fs::create_dir_all(root.join("notes")).map_err(err)?;
                atomic(&root.join("notes/.gitkeep"), b"")?;
                atomic(
                    &root.join("project.json"),
                    &serde_json::to_vec_pretty(&json!({"id":id,"name":name,"closed":false}))
                        .map_err(err)?,
                )?;
                self.commit();
            }
            "update_project" => {
                let id = field(&p, "id")?;
                let name = field(&p, "name")?.trim();
                validate_name(name)?;
                let closed = p["closed"].as_bool().ok_or("Missing project status")?;
                let snap = self.snapshot()?;
                let projects = snap["projects"].as_array().unwrap();
                if !projects.iter().any(|v| v["id"] == id) {
                    return Err("Unknown project".into());
                }
                if projects.iter().any(|v| {
                    v["id"] != id
                        && v["name"]
                            .as_str()
                            .is_some_and(|s| s.to_lowercase() == name.to_lowercase())
                }) {
                    return Err("Project name already exists".into());
                }
                atomic(
                    &self.safe(&format!("projects/{id}/project.json"))?,
                    &serde_json::to_vec_pretty(&json!({"id":id,"name":name,"closed":closed}))
                        .map_err(err)?,
                )?;
                self.commit();
            }
            "create_note" => {
                if !text_note(Path::new(field(&p, "path")?)) {
                    return Err("Create a .md or .txt note; images and PDFs are read-only".into());
                }
                let path = self.note_path(field(&p, "path")?)?;
                if path.exists() {
                    return Err("A note already exists there".into());
                }
                atomic(&path, b"")?;
            }
            "create_folder" => {
                let relative = field(&p, "path")?;
                let probe = format!("{relative}/probe.md");
                self.note_path(&probe)?;
                let folder = self.safe(relative)?;
                fs::create_dir_all(&folder).map_err(err)?;
                atomic(&folder.join(".gitkeep"), b"")?;
            }
            "save_note" => {
                if !text_note(Path::new(field(&p, "path")?)) {
                    return Err("Images and PDFs are read-only".into());
                }
                let path = self.note_path(field(&p, "path")?)?;
                let actual = fs::read_to_string(&path).map_err(err)?;
                if actual != field(&p, "expected")? && actual != field(&p, "content")? {
                    return Err("This note changed outside WorkLog. Your draft is retained; copy it before reloading.".into());
                }
                atomic(&path, field(&p, "content")?.as_bytes())?;
            }
            "rename_note" => {
                let old_extension = Path::new(field(&p, "path")?)
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .unwrap_or("");
                let new_extension = Path::new(field(&p, "destination")?)
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .unwrap_or("");
                if (document_kind(Path::new(field(&p, "path")?)).is_some()
                    || document_kind(Path::new(field(&p, "destination")?)).is_some())
                    && !old_extension.eq_ignore_ascii_case(new_extension)
                {
                    return Err("Keep the file extension when renaming an image or PDF".into());
                }
                let old = self.note_path(field(&p, "path")?)?;
                let dest = self.note_path(field(&p, "destination")?)?;
                if dest.exists() {
                    return Err("Destination already exists".into());
                }
                fs::create_dir_all(dest.parent().unwrap()).map_err(err)?;
                fs::rename(old, dest).map_err(err)?;
                self.commit();
            }
            "move_folder" => {
                let source = field(&p, "path")?;
                let destination = field(&p, "destination")?;
                if source.split('/').count() < 4 || destination.split('/').count() < 4 {
                    return Err("The project root cannot be moved".into());
                }
                self.note_path(&format!("{source}/probe.md"))?;
                self.note_path(&format!("{destination}/probe.md"))?;
                let old = self.safe(source)?;
                let dest = self.safe(destination)?;
                if !old.is_dir() {
                    return Err("Folder no longer exists".into());
                }
                if dest.starts_with(&old) {
                    return Err("A folder cannot be moved inside itself".into());
                }
                if dest.exists() {
                    return Err("Destination already exists".into());
                }
                fs::create_dir_all(dest.parent().unwrap()).map_err(err)?;
                fs::rename(old, dest).map_err(err)?;
                self.commit();
            }
            "delete_folder" => {
                let relative = field(&p, "path")?;
                if relative.split('/').count() < 4 {
                    return Err("The project root cannot be deleted".into());
                }
                self.note_path(&format!("{relative}/probe.md"))?;
                let folder = self.safe(relative)?;
                empty_folder(&folder)?;
                delete_item(&folder, true, p["permanent"].as_bool().unwrap_or(false))?;
                self.commit();
            }
            "open_folder" => {
                let relative = field(&p, "path")?;
                let path = self.safe(relative)?;
                let folder = if path.is_dir() {
                    self.note_path(&format!("{relative}/probe.md"))?;
                    path
                } else {
                    self.note_path(relative)?;
                    path.parent().ok_or("Invalid file path")?.to_path_buf()
                };
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    Command::new("explorer.exe")
                        .arg(folder)
                        .creation_flags(0x08000000)
                        .spawn()
                        .map_err(err)?;
                }
                #[cfg(not(target_os = "windows"))]
                {
                    Command::new("xdg-open").arg(folder).spawn().map_err(err)?;
                }
            }
            "delete_note" => {
                let path = self.note_path(field(&p, "path")?)?;
                delete_item(&path, false, p["permanent"].as_bool().unwrap_or(false))?;
                self.commit();
            }
            "save_entry" | "delete_entry" => {
                let snap = self.snapshot()?;
                let mut records = snap["records"].as_array().unwrap().clone();
                let expected = p.get("expected").filter(|value| !value.is_null());
                let id = if action == "delete_entry" {
                    field(&p, "id")?
                } else {
                    field(p.get("entry").ok_or("Missing time entry")?, "id")?
                };
                let position = records.iter().position(|entry| entry["id"] == id);
                match (position, expected) {
                    (Some(index), Some(expected)) => {
                        if records[index] != *expected {
                            return Err("This entry changed since you opened it. Reopen its details before editing.".into());
                        }
                        if action == "delete_entry" {
                            records.remove(index);
                        } else {
                            records[index] = p["entry"].clone();
                        }
                    }
                    (None, None) if action == "save_entry" => records.push(p["entry"].clone()),
                    (Some(_), None) => {
                        return Err(
                            "Entry already exists; an edit requires its previous value".into()
                        )
                    }
                    _ => return Err("This entry no longer exists".into()),
                }
                let projects = snap["projects"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|v| v["id"].as_str().unwrap().to_string())
                    .collect();
                validate_entries(&records, &projects)?;
                atomic(&self.root()?.join("time.jsonl"), &entries_bytes(&records)?)?;
                self.commit();
            }
            "commit" => {
                self.commit();
            }
            "configure" => {
                let remote = field(&p, "remote")?.trim();
                let backup = field(&p, "backupPath")?.trim();
                let time = p
                    .get("backupTime")
                    .and_then(Value::as_str)
                    .unwrap_or(&self.config.backup_time)
                    .to_string();
                let valid_time = time.is_ascii()
                    && time.len() == 5
                    && time.as_bytes()[2] == b':'
                    && time[..2].parse::<u8>().is_ok_and(|hour| hour < 24)
                    && time[3..].parse::<u8>().is_ok_and(|minute| minute < 60);
                if !valid_time {
                    return Err("Choose a valid daily backup time".into());
                }
                let root = self.root()?;
                if remote.starts_with('-') || remote.contains('\n') {
                    return Err("Invalid remote URL".into());
                }
                if !backup.is_empty() {
                    self.check_backup(backup)?;
                }
                self.commit();
                let old = self.remote();
                if remote.is_empty() {
                    if !old.is_empty() {
                        git(&root, &["remote", "remove", "origin"])?;
                    }
                } else if remote != old {
                    let operation = if old.is_empty() { "add" } else { "set-url" };
                    git(&root, &["remote", operation, "origin", remote])?;
                }
                if remote != old
                    || backup != self.config.backup_path
                    || time != self.config.backup_time
                {
                    self.config.backup_slot.clear();
                    self.config.backup_error.clear();
                }
                self.config.backup_path = backup.into();
                self.config.backup_time = time;
                self.persist_config()?;
            }
            "clone" => {
                let remote = field(&p, "remote")?;
                if remote.is_empty() || remote.starts_with('-') {
                    return Err("Invalid remote URL".into());
                }
                let dest = PathBuf::from(field(&p, "path")?);
                if !dest.is_absolute() {
                    return Err("Choose an absolute clone path".into());
                }
                if dest.exists() && fs::read_dir(&dest).map_err(err)?.next().is_some() {
                    return Err("Clone folder must be empty".into());
                }
                let parent = dest.parent().ok_or("Invalid clone path")?;
                fs::create_dir_all(parent).map_err(err)?;
                let staging = tempfile::tempdir_in(parent).map_err(err)?;
                let folder = staging.path().join("data");
                git(
                    parent,
                    &[
                        "clone",
                        "--quiet",
                        "--",
                        remote,
                        folder.to_str().ok_or("Invalid path")?,
                    ],
                )?;
                if !folder.join("worknotes.json").exists() {
                    let entries = fs::read_dir(&folder)
                        .map_err(err)?
                        .filter_map(|e| e.ok())
                        .filter(|e| e.file_name() != ".git")
                        .count();
                    if entries != 0 || git(&folder, &["rev-list", "--all", "--count"])? != "0" {
                        return Err("Repository contains non-WorkLog data".into());
                    }
                    atomic(
                        &folder.join("worknotes.json"),
                        b"{\"format\":\"worknotes\",\"version\":2}\n",
                    )?;
                    fs::create_dir(folder.join("projects")).map_err(err)?;
                    atomic(&folder.join("projects/.gitkeep"), b"")?;
                    atomic(&folder.join("time.jsonl"), b"")?;
                    atomic(&folder.join(".gitignore"), b".worknotes.lock\n")?;
                }
                if dest.exists() {
                    fs::remove_dir(&dest).map_err(err)?;
                }
                fs::rename(&folder, &dest).map_err(err)?;
                self.open(dest.to_str().ok_or("Invalid path")?)?;
            }
            "backup" | "scheduled_backup" => {
                let automatic = action == "scheduled_backup";
                let slot = p.get("slot").and_then(Value::as_str).unwrap_or("");
                if let Err(error) = self.backup(automatic, slot) {
                    self.config.backup_error = error.clone();
                    self.persist_config()?;
                    return Err(error);
                }
            }
            _ => return Err("Unknown WorkLog operation".into()),
        }
        self.snapshot()
    }
    fn backup(&mut self, automatic: bool, slot: &str) -> Result<()> {
        let remote = self.remote();
        if remote.is_empty() && self.config.backup_path.is_empty() {
            return if automatic {
                Ok(())
            } else {
                Err("Choose a Git remote or file-copy backup location".into())
            };
        }
        if automatic && !slot.is_empty() && self.config.backup_slot.as_str() >= slot {
            return Ok(());
        }
        self.commit();
        let root = self.root()?;
        let mut hash = DefaultHasher::new();
        self.config.root.hash(&mut hash);
        remote.hash(&mut hash);
        self.config.backup_path.hash(&mut hash);
        hash_data(&root, &root, &mut hash)?;
        let fingerprint = format!("{:016x}", hash.finish());
        if fingerprint == self.config.backup_fingerprint {
            self.config.backup_slot = slot.into();
            self.config.backup_error.clear();
            self.persist_config()?;
            return Ok(());
        }
        let mut errors = Vec::new();
        if !remote.is_empty() {
            let push = (|| -> Result<()> {
                if !git(&root, &["status", "--porcelain"])?.is_empty() {
                    return Err(
                        "Git changes could not be committed; remote backup is incomplete".into(),
                    );
                }
                git(&root, &["push", "-u", "origin", "HEAD"])?;
                Ok(())
            })();
            if let Err(error) = push {
                errors.push(error);
            }
        }
        if !self.config.backup_path.is_empty() {
            if let Err(error) = self.copy_backup() {
                errors.push(error);
            }
        }
        if !errors.is_empty() {
            return Err(errors.join("; "));
        }
        self.config.last_backup = stamp();
        self.config.backup_fingerprint = fingerprint;
        self.config.backup_slot = slot.into();
        self.config.backup_error.clear();
        self.persist_config()?;
        self.git_status = "Backup complete".into();
        Ok(())
    }
    fn check_backup(&self, backup: &str) -> Result<PathBuf> {
        let p = PathBuf::from(backup);
        if !p.is_absolute() {
            return Err("Backup location must be absolute".into());
        }
        if !p.is_dir() {
            return Err("Backup parent folder must already exist".into());
        }
        let parent = p.canonicalize().map_err(err)?;
        let root = self.root()?.canonicalize().map_err(err)?;
        let dest = parent.join("WorkNotes-backup");
        if dest.starts_with(&root) || root.starts_with(&dest) {
            return Err("Backup must be outside the working data folder".into());
        }
        if dest.exists() && !dest.join("worknotes.json").is_file() {
            return Err("Existing backup destination is not WorkLog data".into());
        }
        if dest.exists()
            && fs::symlink_metadata(&dest)
                .map_err(err)?
                .file_type()
                .is_symlink()
        {
            return Err("Backup destination cannot be a link".into());
        }
        Ok(dest)
    }
    fn copy_backup(&self) -> Result<()> {
        let dest = self.check_backup(&self.config.backup_path)?;
        let parent = dest.parent().unwrap();
        let stage = tempfile::tempdir_in(parent).map_err(err)?;
        let next = stage.path().join("next");
        copy_tree(&self.root()?, &next)?;
        let old = parent.join("WorkNotes-backup.previous");
        if old.exists() {
            return Err("A previous interrupted backup exists. Check WorkNotes-backup.previous before retrying.".into());
        }
        let had = dest.exists();
        if had {
            fs::rename(&dest, &old).map_err(err)?;
        }
        if let Err(e) = fs::rename(&next, &dest) {
            if had {
                let _ = fs::rename(&old, &dest);
            }
            return Err(err(e));
        }
        if had {
            fs::remove_dir_all(&old).map_err(err)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn setup() -> (tempfile::TempDir, Workspace) {
        let d = tempfile::tempdir().unwrap();
        let mut w = Workspace {
            config_dir: d.path().join("config"),
            config: Config::default(),
            lock: None,
            git_status: String::new(),
            loaded: true,
        };
        w.open(d.path().join("data").to_str().unwrap()).unwrap();
        (d, w)
    }
    #[test]
    fn correction_and_void_validation() {
        let ids = HashSet::from(["p".into()]);
        let a = json!({"type":"entry","id":"a","projectId":"p","date":"2026-10-17","minutes":45,"note":""});
        let b = json!({"type":"entry","id":"b","projectId":"p","date":"2026-10-17","minutes":60,"note":"","replaces":"a"});
        let v = json!({"type":"void","id":"v","target":"b"});
        assert!(validate_ledger(&[a.clone(), b.clone(), v.clone()], &ids).is_ok());
        assert!(validate_ledger(&[a.clone(), b, a.clone()], &ids).is_err());
        assert!(validate_ledger(&[a, v], &ids).is_err());
    }
    #[test]
    fn overview_reports_file_dates_and_preserves_plaintext_checkboxes() {
        let (_d, mut w) = setup();
        let snapshot = w
            .dispatch("create_project", json!({"name":"Overview"}))
            .unwrap();
        let id = snapshot["projects"][0]["id"].as_str().unwrap();
        let path = format!("projects/{id}/notes/log.md");
        w.dispatch("create_note", json!({"path":path})).unwrap();
        let content = "# Log\r\n\r\n- [ ] Follow up\r\n";
        let snapshot = w
            .dispatch(
                "save_note",
                json!({"path":path,"expected":"","content":content}),
            )
            .unwrap();
        let note = snapshot["notes"]
            .as_array()
            .unwrap()
            .iter()
            .find(|note| note["path"] == path)
            .unwrap();
        let modified = fs::metadata(w.note_path(&path).unwrap())
            .unwrap()
            .modified()
            .unwrap()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        assert_eq!(note["modified"].as_u64(), Some(modified));
        assert_eq!(note["content"], content);
        let checked = content.replace("[ ]", "[x]");
        w.dispatch(
            "save_note",
            json!({"path":path,"expected":content,"content":checked}),
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(w.note_path(&path).unwrap()).unwrap(),
            checked
        );
        assert_eq!(
            read_json(&w.root().unwrap().join("worknotes.json")).unwrap()["version"],
            2
        );
    }
    #[test]
    fn note_conflict_and_traversal() {
        let (_d, mut w) = setup();
        let s = w
            .dispatch("create_project", json!({"name":"Test"}))
            .unwrap();
        let id = s["projects"][0]["id"].as_str().unwrap();
        let path = format!("projects/{id}/notes/test.md");
        w.dispatch("create_note", json!({"path":path})).unwrap();
        fs::write(w.note_path(&path).unwrap(), "external").unwrap();
        assert!(w
            .dispatch(
                "save_note",
                json!({"path":path,"expected":"","content":"mine"})
            )
            .is_err());
        assert_eq!(
            fs::read_to_string(w.note_path(&path).unwrap()).unwrap(),
            "external"
        );
        assert!(w.safe("projects/../../outside").is_err());
    }
    #[test]
    fn note_moves_preserve_content_and_reject_collisions() {
        let (_d, mut w) = setup();
        let s = w
            .dispatch("create_project", json!({"name":"Test"}))
            .unwrap();
        let id = s["projects"][0]["id"].as_str().unwrap();
        let root = format!("projects/{id}/notes");
        let source = format!("{root}/original.md");
        let destination = format!("{root}/nested/renamed.md");
        w.dispatch("create_note", json!({"path":source})).unwrap();
        w.dispatch(
            "save_note",
            json!({"path":source,"expected":"","content":"Keep my text"}),
        )
        .unwrap();
        w.dispatch(
            "rename_note",
            json!({"path":source,"destination":destination}),
        )
        .unwrap();
        assert!(!w.note_path(&source).unwrap().exists());
        assert_eq!(
            fs::read_to_string(w.note_path(&destination).unwrap()).unwrap(),
            "Keep my text"
        );
        w.dispatch("create_note", json!({"path":source})).unwrap();
        assert!(w
            .dispatch(
                "rename_note",
                json!({"path":destination,"destination":source})
            )
            .is_err());
        assert_eq!(
            fs::read_to_string(w.note_path(&destination).unwrap()).unwrap(),
            "Keep my text"
        );
        assert!(w
            .dispatch(
                "rename_note",
                json!({"path":destination,"destination":"projects/../../escape.md"})
            )
            .is_err());
        let moved = format!("{root}/back.md");
        w.dispatch(
            "rename_note",
            json!({"path":destination,"destination":moved}),
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(w.note_path(&moved).unwrap()).unwrap(),
            "Keep my text"
        );
    }
    #[test]
    fn daily_backups_skip_unchanged_data_and_persist_schedule() {
        let (d, mut w) = setup();
        w.dispatch("create_project", json!({"name":"Daily"}))
            .unwrap();
        let parent = d.path().join("daily-backup");
        fs::create_dir(&parent).unwrap();
        w.config.backup_path = parent.to_string_lossy().into();
        let first = w
            .dispatch("scheduled_backup", json!({"slot":"2026-10-17T17:00"}))
            .unwrap();
        assert_eq!(first["backupSlot"], "2026-10-17T17:00");
        assert!(!first["lastBackup"].as_str().unwrap().is_empty());
        let saved = w.config.last_backup.clone();
        fs::remove_dir_all(parent.join("WorkNotes-backup")).unwrap();
        w.dispatch("commit", json!({})).unwrap();
        assert!(!parent.join("WorkNotes-backup").exists());
        w.dispatch("scheduled_backup", json!({"slot":"2026-10-18T17:00"}))
            .unwrap();
        assert_eq!(w.config.last_backup, saved);
        assert!(!parent.join("WorkNotes-backup").exists());
        let persisted: Config =
            serde_json::from_value(read_json(&w.config_dir.join("settings.json")).unwrap())
                .unwrap();
        assert_eq!(persisted.backup_slot, "2026-10-18T17:00");
        w.dispatch("create_project", json!({"name":"Changed"}))
            .unwrap();
        w.dispatch("scheduled_backup", json!({"slot":"2026-10-18T17:00"}))
            .unwrap();
        assert!(!parent.join("WorkNotes-backup").exists());
        w.dispatch("backup", json!({"slot":"2026-10-18T17:00"}))
            .unwrap();
        assert!(parent.join("WorkNotes-backup").exists());
        let previous_fingerprint = w.config.backup_fingerprint.clone();
        w.dispatch("create_project", json!({"name":"Changed again"}))
            .unwrap();
        w.dispatch("scheduled_backup", json!({"slot":"2026-10-19T17:00"}))
            .unwrap();
        assert_ne!(w.config.backup_fingerprint, previous_fingerprint);
    }
    #[test]
    fn failed_backups_remain_due_and_retry_successfully() {
        let (d, mut w) = setup();
        w.dispatch("create_project", json!({"name":"Retry"}))
            .unwrap();
        let parent = d.path().join("unavailable");
        w.config.backup_path = parent.to_string_lossy().into();
        assert!(w
            .dispatch("scheduled_backup", json!({"slot":"2026-10-17T17:00"}))
            .is_err());
        assert_eq!(w.config.backup_slot, "");
        assert_eq!(w.config.last_backup, "");
        assert!(!w.snapshot().unwrap()["backupError"]
            .as_str()
            .unwrap()
            .is_empty());
        fs::create_dir(&parent).unwrap();
        let restored = w
            .dispatch("scheduled_backup", json!({"slot":"2026-10-17T17:00"}))
            .unwrap();
        assert_eq!(restored["backupError"], "");
        assert_eq!(restored["backupSlot"], "2026-10-17T17:00");
        assert!(parent.join("WorkNotes-backup").is_dir());
        assert!(w
            .dispatch(
                "configure",
                json!({"remote":"","backupPath":"","backupTime":"24:00"})
            )
            .is_err());
        w.dispatch(
            "configure",
            json!({"remote":"","backupPath":parent.to_string_lossy(),"backupTime":"18:30"}),
        )
        .unwrap();
        assert_eq!(w.config.backup_time, "18:30");
        assert_eq!(w.config.backup_slot, "");
        let legacy: Config = serde_json::from_value(json!({"root":"old"})).unwrap();
        assert_eq!(legacy.backup_time, "17:00");
    }
    #[test]
    fn text_files_folder_moves_and_empty_folder_deletion() {
        let (_d, mut w) = setup();
        let initial = w.dispatch("create_project", json!({"name":"One"})).unwrap();
        let first = initial["projects"][0]["id"].as_str().unwrap();
        let root = format!("projects/{first}/notes");
        let path = format!("{root}/docs/sub/plain.txt");
        w.dispatch("create_note", json!({"path":path})).unwrap();
        let snap = w
            .dispatch(
                "save_note",
                json!({"path":path,"expected":"","content":"# Plain text"}),
            )
            .unwrap();
        assert_eq!(snap["notes"][0]["path"], path);
        assert_eq!(snap["notes"][0]["content"], "# Plain text");
        let folder = format!("{root}/docs");
        assert!(w.dispatch("delete_folder", json!({"path":folder})).is_err());
        assert!(w
            .dispatch(
                "move_folder",
                json!({"path":folder,"destination":format!("{folder}/sub/inside")})
            )
            .is_err());
        let destination = format!("{root}/moved");
        let moved = w
            .dispatch(
                "move_folder",
                json!({"path":folder,"destination":destination}),
            )
            .unwrap();
        assert_eq!(
            moved["notes"][0]["path"],
            format!("{destination}/sub/plain.txt")
        );
        assert!(!w.safe(&folder).unwrap().exists());
        let snapshot = w.dispatch("create_project", json!({"name":"Two"})).unwrap();
        let second = snapshot["projects"]
            .as_array()
            .unwrap()
            .iter()
            .find(|project| project["name"] == "Two")
            .unwrap()["id"]
            .as_str()
            .unwrap();
        let cross = format!("projects/{second}/notes/plain.txt");
        w.dispatch(
            "rename_note",
            json!({"path":format!("{destination}/sub/plain.txt"),"destination":cross}),
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(w.note_path(&cross).unwrap()).unwrap(),
            "# Plain text"
        );
        w.dispatch("delete_note", json!({"path":cross,"permanent":true}))
            .unwrap();
        assert!(!w.root().unwrap().join(".trash").exists());
        w.dispatch(
            "delete_folder",
            json!({"path":destination,"permanent":true}),
        )
        .unwrap();
        assert!(!w.safe(&destination).unwrap().exists());
        let empty = format!("{root}/empty/child/grandchild");
        w.dispatch("create_folder", json!({"path":empty})).unwrap();
        let top = format!("{root}/empty");
        let hidden = w.safe(&format!("{empty}/unknown.bin")).unwrap();
        fs::write(&hidden, [0, 255]).unwrap();
        assert!(w.dispatch("delete_folder", json!({"path":top})).is_err());
        assert!(hidden.exists());
        fs::remove_file(hidden).unwrap();
        w.dispatch("delete_folder", json!({"path":top,"permanent":true}))
            .unwrap();
        assert!(!w.safe(&top).unwrap().exists());
        assert!(w.dispatch("delete_folder", json!({"path":root})).is_err());
    }
    #[test]
    fn binary_documents_are_discovered_read_only_and_workspace_scoped() {
        let (_d, mut w) = setup();
        let snapshot = w
            .dispatch("create_project", json!({"name":"Documents"}))
            .unwrap();
        let id = snapshot["projects"][0]["id"].as_str().unwrap();
        let path = format!("projects/{id}/notes/reference.PDF");
        let image = format!("projects/{id}/notes/image.png");
        let root = w.config.root.clone();
        let pdf = b"%PDF-1.7\n\0\xff binary bytes";
        fs::write(w.safe(&path).unwrap(), pdf).unwrap();
        fs::write(w.safe(&image).unwrap(), [137, 80, 78, 71, 0, 255]).unwrap();
        let found = w.snapshot().unwrap();
        let notes = found["notes"].as_array().unwrap();
        assert_eq!(notes.len(), 2);
        let document = notes.iter().find(|note| note["path"] == path).unwrap();
        assert_eq!(document["kind"], "pdf");
        assert_eq!(document["content"], "");
        assert!(!document["revision"].as_str().unwrap().is_empty());
        assert_eq!(w.read_document(&root, &path).unwrap(), pdf);
        assert!(w.read_document("wrong-workspace", &path).is_err());
        assert!(w
            .read_document(&root, "projects/../../outside.pdf")
            .is_err());
        assert!(w.read_document(&root, "time.jsonl").is_err());
        assert!(w
            .dispatch(
                "save_note",
                json!({"path":path,"expected":"","content":"overwrite"})
            )
            .is_err());
        assert!(w
            .dispatch(
                "create_note",
                json!({"path":format!("projects/{id}/notes/new.pdf")})
            )
            .is_err());
        assert_eq!(fs::read(w.safe(&path).unwrap()).unwrap(), pdf);
        assert!(w
            .dispatch(
                "rename_note",
                json!({"path":path,"destination":format!("projects/{id}/notes/changed.md")})
            )
            .is_err());
        let destination = format!("projects/{id}/notes/reference-renamed.pdf");
        w.dispatch(
            "rename_note",
            json!({"path":path,"destination":destination}),
        )
        .unwrap();
        assert_eq!(w.read_document(&root, &destination).unwrap(), pdf);
        w.dispatch("delete_note", json!({"path":destination,"permanent":true}))
            .unwrap();
        assert!(!w.safe(&destination).unwrap().exists());
        assert!(!w.root().unwrap().join(".trash").exists());
    }
    #[test]
    #[cfg(target_os = "windows")]
    #[ignore = "explicit integration check against the desktop Recycle Bin"]
    fn windows_recycle_roundtrip() {
        let (_d, mut w) = setup();
        let snapshot = w
            .dispatch("create_project", json!({"name":"Recycle test"}))
            .unwrap();
        let id = snapshot["projects"][0]["id"].as_str().unwrap();
        let root = format!("projects/{id}/notes");
        let name = format!("worknotes-recycle-test-{}.txt", uuid::Uuid::new_v4());
        let relative = format!("{root}/{name}");
        w.dispatch("create_note", json!({"path":relative})).unwrap();
        w.dispatch(
            "save_note",
            json!({"path":relative,"expected":"","content":"Recycle round-trip bytes"}),
        )
        .unwrap();
        w.dispatch("delete_note", json!({"path":relative})).unwrap();
        assert!(!w.safe(&relative).unwrap().exists());
        assert!(!w.root().unwrap().join(".trash").exists());
        let items: Vec<_> = trash::os_limited::list()
            .unwrap()
            .into_iter()
            .filter(|item| item.name == std::ffi::OsStr::new(&name))
            .collect();
        assert_eq!(items.len(), 1);
        trash::os_limited::restore_all(items).unwrap();
        assert_eq!(
            fs::read_to_string(w.safe(&relative).unwrap()).unwrap(),
            "Recycle round-trip bytes"
        );
        let folder_name = format!("worknotes-empty-recycle-test-{}", uuid::Uuid::new_v4());
        let folder = format!("{root}/{folder_name}");
        w.dispatch("create_folder", json!({"path":format!("{folder}/nested")}))
            .unwrap();
        w.dispatch("delete_folder", json!({"path":folder})).unwrap();
        assert!(!w.safe(&folder).unwrap().exists());
        let items: Vec<_> = trash::os_limited::list()
            .unwrap()
            .into_iter()
            .filter(|item| item.name == std::ffi::OsStr::new(&folder_name))
            .collect();
        assert_eq!(items.len(), 1);
        trash::os_limited::restore_all(items).unwrap();
        assert!(w.safe(&format!("{folder}/nested")).unwrap().is_dir());
    }
    #[test]
    fn backup_roundtrip() {
        let (d, mut w) = setup();
        w.dispatch("create_project", json!({"name":"Keep me"}))
            .unwrap();
        let backup = d.path().join("backups");
        fs::create_dir(&backup).unwrap();
        w.config.backup_path = backup.to_string_lossy().into();
        w.copy_backup().unwrap();
        let saved = backup.join("WorkNotes-backup");
        assert!(saved.join("worknotes.json").is_file());
        assert!(saved.join(".git").is_dir());
        w.copy_backup().unwrap();
        let mut restored = Workspace {
            config_dir: d.path().join("other-config"),
            config: Config::default(),
            lock: None,
            git_status: String::new(),
            loaded: true,
        };
        restored.open(saved.to_str().unwrap()).unwrap();
        assert_eq!(
            restored.snapshot().unwrap()["projects"][0]["name"],
            "Keep me"
        );
    }

    #[test]
    fn git_remote_restore_and_empty_clone() {
        let (d, mut w) = setup();
        let remote = d.path().join("remote.git");
        git(
            d.path(),
            &[
                "init",
                "--bare",
                "--initial-branch=main",
                remote.to_str().unwrap(),
            ],
        )
        .unwrap();
        w.dispatch(
            "configure",
            json!({"remote":remote.to_str().unwrap(),"backupPath":""}),
        )
        .unwrap();
        w.dispatch("backup", json!({})).unwrap();
        let dest = d.path().join("restored");
        w.dispatch(
            "clone",
            json!({"remote":remote.to_str().unwrap(),"path":dest.to_str().unwrap()}),
        )
        .unwrap();
        assert_eq!(w.snapshot().unwrap()["projects"], json!([]));
        let s = w
            .dispatch("create_project", json!({"name":"Restored workspace"}))
            .unwrap();
        let id = s["projects"][0]["id"].as_str().unwrap();
        let path = format!("projects/{id}/notes/meeting.md");
        w.dispatch("create_note", json!({"path":path})).unwrap();
        w.dispatch(
            "save_note",
            json!({"path":path,"expected":"","content":"# Keep this note"}),
        )
        .unwrap();
        w.dispatch("save_entry", json!({"entry":{"type":"entry","id":"e1","projectId":id,"date":"2026-10-17","minutes":90,"note":""}})).unwrap();
        let remote_before = git(&remote, &["rev-parse", "HEAD"]).unwrap();
        w.dispatch("commit", json!({})).unwrap();
        assert_eq!(git(&remote, &["rev-parse", "HEAD"]).unwrap(), remote_before);
        w.dispatch("scheduled_backup", json!({"slot":"2026-10-17T17:00"}))
            .unwrap();
        assert_ne!(git(&remote, &["rev-parse", "HEAD"]).unwrap(), remote_before);
        let dest2 = d.path().join("restored-again");
        w.dispatch(
            "clone",
            json!({"remote":remote.to_str().unwrap(),"path":dest2.to_str().unwrap()}),
        )
        .unwrap();
        let s = w.snapshot().unwrap();
        assert_eq!(s["notes"][0]["content"], "# Keep this note");
        assert_eq!(s["records"][0]["minutes"], 90);
        assert_eq!(s["projects"][0]["name"], "Restored workspace");
    }

    #[test]
    fn entries_can_be_edited_and_removed_with_stale_edit_protection() {
        let (_d, mut w) = setup();
        let snapshot = w
            .dispatch("create_project", json!({"name":"Editable"}))
            .unwrap();
        let project = snapshot["projects"][0]["id"].as_str().unwrap();
        let original = json!({"type":"entry","id":"one","projectId":project,"date":"2026-10-17","minutes":45,"note":"Before"});
        let other = json!({"type":"entry","id":"two","projectId":project,"date":"2026-10-16","minutes":30,"note":"Keep"});
        w.dispatch("save_entry", json!({"entry":original})).unwrap();
        w.dispatch("save_entry", json!({"entry":other})).unwrap();
        let updated = json!({"type":"entry","id":"one","projectId":project,"date":"2026-10-18","minutes":90,"note":"After"});
        let snapshot = w
            .dispatch("save_entry", json!({"entry":updated,"expected":original}))
            .unwrap();
        assert_eq!(snapshot["records"].as_array().unwrap().len(), 2);
        assert_eq!(snapshot["records"][0], updated);
        assert!(w
            .dispatch("save_entry", json!({"entry":original,"expected":original}))
            .is_err());
        assert!(w
            .dispatch("delete_entry", json!({"id":"one","expected":original}))
            .is_err());
        let snapshot = w
            .dispatch("delete_entry", json!({"id":"one","expected":updated}))
            .unwrap();
        assert_eq!(snapshot["records"], json!([other]));
        let text = fs::read_to_string(w.root().unwrap().join("time.jsonl")).unwrap();
        assert_eq!(text.lines().count(), 1);
        assert!(!text.contains("After"));
        assert!(w.dispatch("save_entry", json!({"entry":other})).is_err());
    }

    #[test]
    fn legacy_ledger_migration_preserves_current_entries_and_original_plaintext() {
        let (d, mut w) = setup();
        let snapshot = w
            .dispatch("create_project", json!({"name":"Legacy"}))
            .unwrap();
        let project = snapshot["projects"][0]["id"].as_str().unwrap();
        let a = json!({"type":"entry","id":"a","projectId":project,"date":"2026-10-17","minutes":45,"note":"Original"});
        let b = json!({"type":"entry","id":"b","projectId":project,"date":"2026-10-17","minutes":90,"note":"Updated","replaces":"a"});
        let c = json!({"type":"entry","id":"c","projectId":project,"date":"2026-10-17","minutes":20,"note":"Removed"});
        let v = json!({"type":"void","id":"v","target":"c"});
        let bytes = entries_bytes(&[a, b.clone(), c, v]).unwrap();
        let root = w.root().unwrap();
        atomic(&root.join("time.jsonl"), &bytes).unwrap();
        atomic(
            &root.join("worknotes.json"),
            b"{\"format\":\"worknotes\",\"version\":1}",
        )
        .unwrap();
        drop(w);
        let mut restored = Workspace {
            config_dir: d.path().join("migrated-config"),
            config: Config::default(),
            lock: None,
            git_status: String::new(),
            loaded: true,
        };
        restored.open(root.to_str().unwrap()).unwrap();
        let snapshot = restored.snapshot().unwrap();
        let mut expected = b;
        expected.as_object_mut().unwrap().remove("replaces");
        assert_eq!(snapshot["records"], json!([expected]));
        assert_eq!(
            read_json(&root.join("worknotes.json")).unwrap()["version"],
            2
        );
        assert_eq!(
            fs::read(root.join(".migration/time-v1.jsonl")).unwrap(),
            bytes
        );
        restored
            .dispatch("delete_entry", json!({"id":"b","expected":expected}))
            .unwrap();
        drop(restored);
        let mut reopened = Workspace {
            config_dir: d.path().join("reopened-config"),
            config: Config::default(),
            lock: None,
            git_status: String::new(),
            loaded: true,
        };
        reopened.open(root.to_str().unwrap()).unwrap();
        assert_eq!(reopened.snapshot().unwrap()["records"], json!([]));
    }

    #[test]
    fn corrupt_ledger_and_second_writer_are_rejected() {
        let (d, w) = setup();
        let mut other = Workspace {
            config_dir: d.path().join("other"),
            config: Config::default(),
            lock: None,
            git_status: String::new(),
            loaded: true,
        };
        assert!(other.open(&w.config.root).is_err());
        fs::write(w.root().unwrap().join("time.jsonl"), "{\"partial\":").unwrap();
        assert!(w.snapshot().unwrap_err().contains("incomplete final line"));
        assert!(w.check_backup(&w.config.root).is_err());
    }
}
