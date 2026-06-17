import type { StoryEntry, SavedUpdate } from './types';

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
    return raw ? (JSON.parse(raw) as SavedUpdate[]) : [];
  } catch {
    return [];
  }
}

export function saveUpdate(update: SavedUpdate): void {
  const all = loadSavedUpdates();
  const existing = all.findIndex((u) => u.id === update.id);
  if (existing >= 0) {
    all[existing] = update;
  } else {
    all.unshift(update);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
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
