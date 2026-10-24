# Build history

## First prompt

```text
hey, I want to build a new app. for tracking time at work.  it should be local linux app, but miltiplatform would be best.  local, not a web app. simple to build and deploy.  what are the best technologies for this right now?
```

## From idea to implementation

The first stack comparison favored Python/PySide6 with SQLite, while considering Tauri, Flutter, and Electron. The owner clarified that “local” meant no hosted server and raised Qt licensing concerns. That shifted the recommendation to Tauri with React/TypeScript and a small Rust backend. Plaintext project folders and Git backups then replaced the database proposal. Concern about Electron memory use settled the choice: “lets keep tauri then?”

The interface grew from “simple plaintext note taking” with a quick time form “pulled up or set to the side.” The owner proposed an active-project selector, left-hand notes tree, and tabbed editing pane. Wrapped prose alongside unwrapped code/logs informed the CodeMirror editor choice. “Folders; docked panel by default” resolved the initial layout.

The time form followed the owner's manual model: date, project, free-form duration, and a short note. Recent-project buttons reduced switching effort; a small, hideable timer remained separate from saved entries. Familiar code-editor shortcuts supplied Ctrl+P navigation. “first write out a spec md document” captured these decisions before “go ahead and build this” authorized implementation.

Hands-on feedback refined the experience: guided popups replaced a Settings detour for first-project creation; neutral dark colors and shorter copy reduced distraction. Editable time records replaced append-only corrections. Clicking the project root became an overview of notes and unfinished checkboxes, ordered by edit date. Split view and Kanban stayed unbuilt alternatives. The logbook concept ultimately supplied the WorkLog name.

Windows/Linux requirements led to hosted builds. Later instructions established focused commits and documented contribution, frontend/Rust testing, and release practices. Version 0.1.27 reached public testers; Ubuntu installation validation remained pending.

## Evidence and access limits

The original chat was paginated fully and cross-checked with [SPEC.md](../SPEC.md), [development notes](development.md), and Git. Git begins with existing source; unavailable conversations cannot be ruled out.
