export type TaskType = 'task' | 'story' | 'spike' | 'bug';
export type StoryStatus = 'not-started' | 'in-progress' | 'done' | 'blocked';

export interface OutputSettings {
  showStatus: boolean;
  excludeStatuses: StoryStatus[];
}

export interface StoryEntry {
  id: string;
  taskType: TaskType;
  title: string;
  ticketNumber: string;
  jiraUrl: string;
  yesterday: string;
  today: string;
  blockers: string;
  status: StoryStatus;
  createdAt: string;
  updatedAt: string;
  carryOver?: CarryOverInfo;
}

export interface CarryOverInfo {
  sourceUpdateId: string;
  sourceUpdateName: string;
  sourceStoryId: string;
  rootStoryId: string;
  carriedOverAt: string;
  generation: number;
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
  updatedAt: string;
  stories: StoryEntry[];
  changelog: UpdateSnapshot[]; // ordered oldest → newest
}

export type TaskListSortKey = 'createdAt' | 'updatedAt' | 'status';

export interface TaskListSettings {
  sortBy: TaskListSortKey;
  filterStatus: StoryStatus | 'all';
}

export interface TaskLineageEntry {
  id: string;
  updateId: string;
  updateName: string;
  savedAt: string;
  title: string;
  status: StoryStatus;
  today: string;
  blockers: string;
  note?: string;
  checkpoint: boolean;
}
