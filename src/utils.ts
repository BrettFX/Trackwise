import type { StoryEntry, SavedUpdate, UpdateSnapshot } from './types';

const STORAGE_KEY = 'ytb-saved-updates';

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
    // Migrate entries that predate the changelog field
    return parsed.map((u) => ({ ...u, changelog: u.changelog ?? [] }));
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
      title: s.title.trim(),
      ticketNumber: s.ticketNumber.trim(),
      yesterday: s.yesterday.trim(),
      today: s.today.trim(),
      blockers: s.blockers.trim(),
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

  // Diff guard: compare against last checkpoint, or current stored stories if none.
  const reference =
    existing.changelog.length > 0
      ? existing.changelog[existing.changelog.length - 1].stories
      : existing.stories;

  if (contentFingerprint(stories) === contentFingerprint(reference)) {
    return { saved: false, update: existing };
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

export function formatOutputHTML(stories: StoryEntry[]): string {
  const blocks = stories.map((story) => {
    let storyLine: string;
    if (story.title && story.jiraUrl && story.ticketNumber) {
      storyLine = `<b>Story:</b> <a href="${escapeHtml(story.jiraUrl)}">${escapeHtml(story.title)} (${escapeHtml(story.ticketNumber)})</a>`;
    } else if (story.title && story.jiraUrl) {
      storyLine = `<b>Story:</b> <a href="${escapeHtml(story.jiraUrl)}">${escapeHtml(story.title)}</a>`;
    } else if (story.title && story.ticketNumber) {
      storyLine = `<b>Story:</b> ${escapeHtml(story.title)} (${escapeHtml(story.ticketNumber)})`;
    } else {
      storyLine = `<b>Story:</b> ${escapeHtml(story.title)}`;
    }

    return [
      `<p>${storyLine}</p>`,
      `<p><b>Yesterday:</b> ${toHtmlLines(story.yesterday.trim() || 'None')}</p>`,
      `<p><b>Today:</b> ${toHtmlLines(story.today.trim())}</p>`,
      `<p><b>Blockers:</b> ${toHtmlLines(story.blockers.trim() || 'None')}</p>`,
    ].join('\n');
  });

  return blocks.join('\n<hr>\n');
}

export function makeEmptyStory(): StoryEntry {
  return { id: crypto.randomUUID(), title: '', ticketNumber: '', jiraUrl: '', yesterday: '', today: '', blockers: '' };
}
