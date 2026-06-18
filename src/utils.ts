import type { StoryEntry, SavedUpdate, UpdateSnapshot, StoryStatus, TaskType, OutputSettings } from './types';

const STORAGE_KEY = 'ytb-saved-updates';
const OUTPUT_SETTINGS_KEY = 'trackwise-output-settings';

export const DEFAULT_OUTPUT_SETTINGS: OutputSettings = {
  showStatus: true,
  excludeStatuses: [],
};

export function loadOutputSettings(): OutputSettings {
  try {
    const raw = localStorage.getItem(OUTPUT_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_OUTPUT_SETTINGS };
    return { ...DEFAULT_OUTPUT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_OUTPUT_SETTINGS };
  }
}

export function saveOutputSettings(settings: OutputSettings): void {
  localStorage.setItem(OUTPUT_SETTINGS_KEY, JSON.stringify(settings));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toHtmlLines(str: string): string {
  return escapeHtml(str).replace(/\n/g, '<br>');
}

export function loadSavedUpdates(): SavedUpdate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedUpdate[];
    // Migrate entries: add changelog if missing, add status/taskType to stories if missing
    return parsed.map((u) => ({
      ...u,
      changelog: u.changelog ?? [],
      stories: u.stories.map((s) => ({
        ...s,
        status: s.status ?? 'not-started',
        taskType: s.taskType ?? 'task',
      })),
    }));
  } catch {
    return [];
  }
}

/** Create a brand-new saved entry with an empty changelog. */
export function saveAsNew(name: string, stories: StoryEntry[]): SavedUpdate {
  const update: SavedUpdate = {
    id: crypto.randomUUID(),
    name: name.trim() || `Update – ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    stories,
    changelog: [],
  };
  const all = loadSavedUpdates();
  all.unshift(update);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return update;
}

/** Silently sync stories/name — no changelog entry created. */
export function silentSave(id: string, name: string, stories: StoryEntry[]): SavedUpdate | null {
  const all = loadSavedUpdates();
  const idx = all.findIndex((u) => u.id === id);
  if (idx < 0) return null;
  all[idx].name = name.trim() || all[idx].name;
  all[idx].stories = stories;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all[idx];
}

/** Content fingerprint for diff guard — compares meaningful text fields only. */
function contentFingerprint(stories: StoryEntry[]): string {
  return JSON.stringify(
    stories.map((s) => ({
      taskType: s.taskType,
      title: s.title.trim(),
      ticketNumber: s.ticketNumber.trim(),
      yesterday: s.yesterday.trim(),
      today: s.today.trim(),
      blockers: s.blockers.trim(),
      status: s.status,
    }))
  );
}

/**
 * Save a named checkpoint. Only creates a changelog entry if the stories differ
 * from the last checkpoint (diff guard). Returns whether a checkpoint was saved.
 */
export function saveCheckpoint(
  id: string,
  note: string,
  stories: StoryEntry[]
): { saved: boolean; update: SavedUpdate | null } {
  const all = loadSavedUpdates();
  const idx = all.findIndex((u) => u.id === id);
  if (idx < 0) return { saved: false, update: null };

  const existing = all[idx];

  // Diff guard: compare against the last checkpoint snapshot only.
  // When no checkpoints exist yet, always allow the first one — comparing
  // against existing.stories would always match because silentSave keeps it
  // in sync with the current editor state.
  if (existing.changelog.length > 0) {
    const lastSnapshot = existing.changelog[existing.changelog.length - 1];
    if (contentFingerprint(stories) === contentFingerprint(lastSnapshot.stories)) {
      return { saved: false, update: existing };
    }
  }

  const snapshot: UpdateSnapshot = {
    savedAt: new Date().toISOString(),
    note: note.trim() || undefined,
    stories,
  };
  existing.changelog = [...existing.changelog, snapshot];
  existing.stories = stories;
  all[idx] = existing;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return { saved: true, update: existing };
}

export function deleteUpdate(id: string): void {
  const all = loadSavedUpdates().filter((u) => u.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function renameUpdate(id: string, newName: string): void {
  const all = loadSavedUpdates();
  const idx = all.findIndex((u) => u.id === id);
  if (idx < 0) return;
  all[idx].name = newName.trim() || all[idx].name;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

// ── Export / Import ──────────────────────────────────────────────────────────

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  updates: SavedUpdate[];
}

/** Trigger a JSON file download containing all saved updates. */
export function exportUpdates(): void {
  const updates = loadSavedUpdates();
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    updates,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `trackwise-export-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Trigger a JSON file download containing a single saved update (always uses the
 *  latest version from storage so renames are reflected in the downloaded file). */
export function exportSingleUpdate(id: string): void {
  const update = loadSavedUpdates().find((u) => u.id === id);
  if (!update) return;
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    updates: [update],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  const slug = update.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  a.href = url;
  a.download = `trackwise-${slug}-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;   // entries that already exist by ID
  errors: string[];
  importedUpdates: SavedUpdate[]; // the entries that were actually written
}

function isValidStory(s: unknown): s is StoryEntry {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return typeof o.title === 'string' && typeof o.today === 'string';
}

function isValidUpdate(u: unknown): u is SavedUpdate {
  if (!u || typeof u !== 'object') return false;
  const o = u as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.createdAt === 'string' &&
    Array.isArray(o.stories) &&
    (o.stories as unknown[]).every(isValidStory)
  );
}

export function importUpdates(json: string, mode: ImportMode): ImportResult {
  const result: ImportResult = { imported: 0, skipped: 0, duplicates: 0, errors: [], importedUpdates: [] };

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    result.errors.push('File is not valid JSON.');
    return result;
  }

  // Accept either the versioned payload object or a bare array (for interop)
  let incoming: unknown[];
  if (Array.isArray(payload)) {
    incoming = payload;
  } else if (
    payload &&
    typeof payload === 'object' &&
    'updates' in payload &&
    Array.isArray((payload as Record<string, unknown>).updates)
  ) {
    incoming = (payload as ExportPayload).updates;
  } else {
    result.errors.push('Unrecognised file format. Expected a Trackwise export file.');
    return result;
  }

  const existing = mode === 'replace' ? [] : loadSavedUpdates();
  const existingIds = new Set(loadSavedUpdates().map((u) => u.id)); // always check original for dup count

  for (const raw of incoming) {
    if (!isValidUpdate(raw)) {
      result.skipped++;
      continue;
    }
    const entry: SavedUpdate = {
      ...raw,
      id: raw.id ?? crypto.randomUUID(),
      changelog: raw.changelog ?? [],
    };

    if (existingIds.has(entry.id)) {
      result.duplicates++;
      if (mode !== 'replace') continue; // skip duplicates in merge mode
    }

    existing.push(entry);
    result.importedUpdates.push(entry);
    result.imported++;
  }

  // Re-sort by createdAt descending
  existing.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return result;
}

/**
 * Dry-run: parse JSON and return the list of valid incoming updates + duplicate count
 * without writing anything to storage.
 */
export interface ImportPreview {
  updates: SavedUpdate[];
  duplicates: number;
  invalid: number;
  error?: string;
}

export function previewImport(json: string): ImportPreview {
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return { updates: [], duplicates: 0, invalid: 0, error: 'Not valid JSON.' };
  }

  let incoming: unknown[];
  if (Array.isArray(payload)) {
    incoming = payload;
  } else if (
    payload && typeof payload === 'object' &&
    'updates' in payload &&
    Array.isArray((payload as Record<string, unknown>).updates)
  ) {
    incoming = (payload as ExportPayload).updates;
  } else {
    return { updates: [], duplicates: 0, invalid: 0, error: 'Unrecognised format. Expected a Trackwise export file.' };
  }

  const existingIds = new Set(loadSavedUpdates().map((u) => u.id));
  const valid: SavedUpdate[] = [];
  let invalid = 0;
  let duplicates = 0;

  for (const raw of incoming) {
    if (!isValidUpdate(raw)) { invalid++; continue; }
    const entry: SavedUpdate = { ...raw, id: raw.id ?? crypto.randomUUID(), changelog: raw.changelog ?? [] };
    if (existingIds.has(entry.id)) duplicates++;
    valid.push(entry);
  }

  return { updates: valid, duplicates, invalid };
}

/**
 * Returns true if the current stories have meaningful content that hasn't been saved yet.
 * Used to prompt the user before destructive actions (import, clear, etc.).
 */
export function hasUnsavedChanges(currentUpdateId: string | null, stories: StoryEntry[]): boolean {
  const empty = contentFingerprint([makeEmptyStory()]);
  const current = contentFingerprint(stories);
  if (current === empty) return false; // nothing was typed

  if (!currentUpdateId) return true; // content exists but never saved

  const saved = loadSavedUpdates().find((u) => u.id === currentUpdateId);
  if (!saved) return true;
  return current !== contentFingerprint(saved.stories);
}

const STATUS_LABELS: Record<StoryStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'done': 'Done',
  'blocked': 'Blocked',
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  task: 'Task',
  story: 'Story',
  spike: 'Spike',
};

export function formatOutputHTML(stories: StoryEntry[], settings: OutputSettings = DEFAULT_OUTPUT_SETTINGS): string {
  const excluded = new Set(settings.excludeStatuses);
  const filtered = stories.filter((s) => !excluded.has(s.status ?? 'not-started'));

  if (filtered.length === 0) return '';

  const blocks = filtered.map((story) => {
    const typeLabel = TASK_TYPE_LABELS[story.taskType ?? 'task'];
    const href = escapeHtml(story.jiraUrl);
    const linkAttrs = `href="${href}" target="_blank" rel="noopener noreferrer"`;
    let storyLine: string;
    if (story.title && story.jiraUrl && story.ticketNumber) {
      storyLine = `<b>${typeLabel}:</b> <a ${linkAttrs}>${escapeHtml(story.title)} (${escapeHtml(story.ticketNumber)})</a>`;
    } else if (story.title && story.jiraUrl) {
      storyLine = `<b>${typeLabel}:</b> <a ${linkAttrs}>${escapeHtml(story.title)}</a>`;
    } else if (story.title && story.ticketNumber) {
      storyLine = `<b>${typeLabel}:</b> ${escapeHtml(story.title)} (${escapeHtml(story.ticketNumber)})`;
    } else {
      storyLine = `<b>${typeLabel}:</b> ${escapeHtml(story.title)}`;
    }

    const status = story.status ?? 'not-started';

    return [
      `<p>${storyLine}</p>`,
      ...(settings.showStatus ? [`<p><b>Status:</b> ${STATUS_LABELS[status]}</p>`] : []),
      `<p><b>Yesterday:</b> ${toHtmlLines(story.yesterday.trim() || 'None')}</p>`,
      `<p><b>Today:</b> ${toHtmlLines(story.today.trim())}</p>`,
      `<p><b>Blockers:</b> ${toHtmlLines(story.blockers.trim() || 'None')}</p>`,
    ].join('\n');
  });

  return blocks.join('\n<hr>\n');
}

export function makeEmptyStory(): StoryEntry {
  return { id: crypto.randomUUID(), taskType: 'task', title: '', ticketNumber: '', jiraUrl: '', yesterday: '', today: '', blockers: '', status: 'not-started' };
}
