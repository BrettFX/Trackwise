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
  note?: string;        // optional label the user adds at checkpoint time
  stories: StoryEntry[];
}

export interface SavedUpdate {
  id: string;
  name: string;
  createdAt: string;
  stories: StoryEntry[];
  changelog: UpdateSnapshot[]; // ordered oldest → newest
}
