# Trackwise

A browser-based daily standup tool. Fill in your work items and generate a formatted, Teams-ready Yesterday/Today/Blockers status update. All data is stored locally in your browser — nothing is sent to a server.

## Features

### Task Management
- **Item types**: Task, Story, Spike, Bug
- **Statuses**: Not Started, In Progress, Done, Blocked
- **Priority**: High, Medium, Low (optional)
- **Jira integration**: Paste a Jira URL to auto-fill the ticket number, or type the ticket number to auto-fill the URL
- **Drag-and-drop reorder** with animated transitions
- **Sort** by Priority, Date Created, Date Modified, or Status
- **Filter** by status, priority, or date range
- **Collapse/expand** individual cards or all at once

### Output Generation
- Generates HTML with proper bold labels, line breaks, and Jira ticket hyperlinks
- Copy button puts both rich HTML and plain text on the clipboard — paste directly into Teams or any rich text editor
- **Output settings** (persisted): toggle Status and Priority display, exclude items by status
- Preview updates live when settings change

### Saving & History
- **Save**: silently syncs the current items to the loaded entry
- **Save as New**: creates a named entry; optionally links it to a JSON file on disk via the File System Access API
- **Checkpoint**: saves a timestamped snapshot of the current state with an optional note; skipped automatically if nothing has changed
- History panel shows all saved entries with load, rename, delete, and single-entry export
- Load any historical checkpoint to restore a past state

### Carry-Over
Carry tasks forward from one sprint/update to the next. Select individual tasks from any saved entry and copy them into the current list. Carried-over tasks track their lineage (source update, generation count) and are deduplicated automatically.

### Task Lineage
Each task accumulates a history across checkpoints and updates. A lineage panel inside the task card shows every recorded state, lets you copy a past-tense narrative summary to the clipboard, and allows deleting individual or all checkpoint entries.

### Import / Export
- **Export all** or a **single entry** as a JSON file
- **Import** via drag-and-drop, file picker, or pasted JSON — with a duplicate-handling step when conflicts exist
- Entries exported via the File System Access API are linked to the file; future saves write back to it automatically

## Getting Started

```bash
npm install
npm run dev
```

The app runs entirely in the browser. Saved updates are stored in `localStorage` under the key `ytb-saved-updates`. No account or backend required.

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS v4
- Vite 8
- Lucide React (icons)
- Web APIs: Clipboard API, File System Access API, IndexedDB, Drag-and-Drop, IntersectionObserver
