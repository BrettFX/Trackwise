export type TaskType = 'task' | 'story' | 'spike' | 'bug';
export type StoryStatus = 'not-started' | 'in-progress' | 'done' | 'blocked';
export type StoryPriority = 'low' | 'medium' | 'high';

export interface OutputSettings {
  showStatus: boolean;
  excludeStatuses: StoryStatus[];
}

export interface StoryEntry {
  id: string;
  sequenceNumber?: number;
  taskType: TaskType;
  title: string;
  ticketNumber: string;
  jiraUrl: string;
  yesterday: string;
  today: string;
  blockers: string;
  status: StoryStatus;
  priority?: StoryPriority;
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

export type TaskListSortKey = 'createdAt' | 'updatedAt' | 'status' | 'priority';
export type TaskListSortSelection = TaskListSortKey | 'custom';

export interface TaskListSettings {
  sortBy: TaskListSortSelection;
  filterStatus: StoryStatus | 'all';
  filterPriority: StoryPriority | 'none' | 'all';
  filterDate: 'all' | 'created-today' | 'updated-today' | 'created-week' | 'updated-week';
  showTaskDates: boolean;
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
