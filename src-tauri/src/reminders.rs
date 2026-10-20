use chrono::{Datelike, Local, Timelike};
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};
use tauri::Manager;
use tauri_plugin_notification::NotificationExt;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    enabled: bool,
    time: String,
    days: Vec<u32>, // Monday = 0
    #[serde(default)]
    last_sent: Option<String>,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            enabled: false,
            time: "16:00".into(),
            days: vec![0, 1, 2, 3, 4],
            last_sent: None,
        }
    }
}
impl Settings {
    fn validate(&self) -> Result<(), String> {
        let bytes = self.time.as_bytes();
        if bytes.len() != 5
            || bytes[2] != b':'
            || !bytes
                .iter()
                .enumerate()
                .all(|(i, b)| i == 2 || b.is_ascii_digit())
            || self.time[..2].parse::<u32>().unwrap_or(99) > 23
            || self.time[3..].parse::<u32>().unwrap_or(99) > 59
        {
            return Err("Choose a valid reminder time.".into());
        }
        if self.days.iter().any(|d| *d > 6) || (self.enabled && self.days.is_empty()) {
            return Err("Choose at least one day of the week.".into());
        }
        Ok(())
    }
    fn due(&self, now: chrono::DateTime<Local>) -> bool {
        self.enabled
            && self.days.contains(&now.weekday().num_days_from_monday())
            && format!("{:02}:{:02}", now.hour(), now.minute()) >= self.time
            && self.last_sent.as_deref() != Some(&now.format("%Y-%m-%d").to_string())
    }
}
pub struct Reminders {
    settings: Settings,
    path: PathBuf,
}
impl Reminders {
    fn persist(&self) -> Result<(), String> {
        crate::storage::write_export(
            self.path.to_str().ok_or("Invalid reminder settings path")?,
            &serde_json::to_string_pretty(&self.settings).map_err(|e| e.to_string())?,
        )
    }
}
#[tauri::command]
pub fn reminder_settings(
    settings: Option<Settings>,
    state: tauri::State<'_, Mutex<Reminders>>,
) -> Result<Settings, String> {
    let mut state = state.lock().map_err(|_| "Reminder settings lock failed")?;
    if let Some(mut settings) = settings {
        settings.validate()?;
        // Preserve delivery history when editing the schedule.
        settings.last_sent = state.settings.last_sent.clone();
        let previous = state.settings.clone();
        state.settings = settings;
        if let Err(error) = state.persist() {
            state.settings = previous;
            return Err(error);
        }
    }
    Ok(state.settings.clone())
}
pub fn start(app: &tauri::AppHandle, dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    std::fs::create_dir_all(dir)?;
    let path = dir.join("timesheet-reminder.json");
    let settings = match std::fs::read(&path) {
        Ok(bytes) => {
            let s: Settings = serde_json::from_slice(&bytes)?;
            s.validate()?;
            s
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Settings::default(),
        Err(e) => return Err(e.into()),
    };
    app.manage(Mutex::new(Reminders { settings, path }));
    let app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(15));
        let state = app.state::<Mutex<Reminders>>();
        let Ok(mut state) = state.lock() else {
            continue;
        };
        let now = Local::now();
        if state.settings.due(now) {
            match app
                .notification()
                .builder()
                .title("Time to fill out your timesheet")
                .body("Open WorkLog to review your time and complete your timesheet.")
                .show()
            {
                Ok(()) => {
                    state.settings.last_sent = Some(now.format("%Y-%m-%d").to_string());
                    if let Err(error) = state.persist() {
                        eprintln!("Could not save reminder delivery: {error}");
                    }
                }
                Err(error) => eprintln!("Could not send timesheet reminder: {error}"),
            }
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    #[test]
    fn validates_schedule() {
        let mut s = Settings::default();
        for time in ["24:00", "12:60", "4:00", "xx:00", "💡:"] {
            s.time = time.into();
            assert!(s.validate().is_err());
        }
        s.time = "16:00".into();
        s.enabled = true;
        s.days.clear();
        assert!(s.validate().is_err());
    }
    #[test]
    fn reminds_once_on_selected_local_day_after_time() {
        let mut s = Settings::default();
        s.enabled = true;
        let monday = Local.with_ymd_and_hms(2026, 10, 19, 16, 0, 0).unwrap();
        assert!(s.due(monday));
        assert!(!s.due(monday - chrono::Duration::minutes(1)));
        assert!(!s.due(monday + chrono::Duration::days(5)));
        s.last_sent = Some("2026-10-19".into());
        assert!(!s.due(monday));
        assert!(s.due(monday + chrono::Duration::days(1)));
    }
    #[test]
    fn saves_schedule_and_delivery_history_across_restarts() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("reminder.json");
        let mut settings = Settings::default();
        settings.enabled = true;
        settings.last_sent = Some("2026-10-19".into());
        Reminders {
            settings,
            path: path.clone(),
        }
        .persist()
        .unwrap();
        let restored: Settings = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
        restored.validate().unwrap();
        assert!(restored.enabled);
        assert_eq!(restored.last_sent.as_deref(), Some("2026-10-19"));
        assert_eq!(restored.days, vec![0, 1, 2, 3, 4]);
    }
}
