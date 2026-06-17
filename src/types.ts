export interface StoryEntry {
  id: string;
  title: string;
  ticketNumber: string;
  jiraUrl: string;
  yesterday: string;
  today: string;
  blockers: string;
}

export interface UpdateSnapshot {
  savedAt: string;
  stories: StoryEntry[];
}

export interface SavedUpdate {
  id: string;
  name: string;
  createdAt: string;
  stories: StoryEntry[];
  changelog: UpdateSnapshot[]; // ordered oldest → newest
}
