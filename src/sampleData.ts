// Dev-only sample data generator — lets you quickly test lineage-heavy features
// (copy summary, fuzzy duplicate detection, AI rewrite) without days of real data entry.
import type { SavedUpdate, StoryEntry, StoryStatus, TaskType, StoryPriority, UpdateSnapshot } from './types';

export const SAMPLE_UPDATE_ID = 'trackwise-sample-demo';
const STORY_A_ID = 'trackwise-sample-story-azure-etl';
const STORY_B_ID = 'trackwise-sample-story-login-bug';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

interface StoryState {
  offset: number; // days ago this state took effect
  yesterday?: string;
  today: string;
  blockers?: string;
  status: StoryStatus;
}

interface StoryBase {
  id: string;
  sequenceNumber: number;
  taskType: TaskType;
  title: string;
  ticketNumber: string;
  priority: StoryPriority;
}

// Among states that had already happened by `targetOffset` days ago, pick the most recent one.
// Returns null if the story didn't exist yet at that point (it's simply omitted from that snapshot).
function stateAtOffset(states: StoryState[], targetOffset: number): StoryState | null {
  const eligible = states.filter((s) => s.offset >= targetOffset);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, s) => (s.offset < best.offset ? s : best));
}

function buildStory(base: StoryBase, state: StoryState): StoryEntry {
  const timestamp = isoDaysAgo(state.offset);
  return {
    id: base.id,
    sequenceNumber: base.sequenceNumber,
    taskType: base.taskType,
    title: base.title,
    ticketNumber: base.ticketNumber,
    jiraUrl: `https://jira.faa.gov/browse/${base.ticketNumber}`,
    yesterday: state.yesterday ?? '',
    today: state.today,
    blockers: state.blockers ?? '',
    status: state.status,
    priority: base.priority,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const storyABase: StoryBase = { id: STORY_A_ID, sequenceNumber: 1, taskType: 'task', title: 'Azure Billing ETL Pipeline', ticketNumber: 'FCSCCE-1234', priority: 'high' };
const storyBBase: StoryBase = { id: STORY_B_ID, sequenceNumber: 2, taskType: 'bug', title: 'Fix Compass login session timeout bug', ticketNumber: 'FCSCCE-5555', priority: 'medium' };

// Deliberately includes: a prefix-restated opener (offsets 16/14/12), an exact-text
// duplicate with only the status changed (offsets 6/5, for fuzzy duplicate detection),
// a multi-sentence run-on entry with an "etc." abbreviation (offset 3), and a trailing
// "None (Done)" on a still in-progress task (live state) to exercise the next-step fix.
const storyAStates: StoryState[] = [
  { offset: 16, today: 'Identify billing data extract source in Azure portal that contains all necessary data for Compass insights ETL pipeline', status: 'in-progress' },
  { offset: 14, today: 'Identify billing data extract source in Azure portal that contains all necessary data for Compass insights ETL pipeline and begin pulling all data to transfer to relevant S3 location (e.g., MPA account)', status: 'in-progress' },
  { offset: 12, today: 'Identify billing data extract source in Azure portal that contains all necessary data for Compass insights ETL pipeline and put together scripts with Copilot to pull all data to transfer to local with the intent to upload to relevant S3 location (e.g., MPA account)', status: 'in-progress' },
  { offset: 10, today: 'Debug 429 errors for too many requests when running backfill process. Transform backfilled data and upload to s3 (one-off)', status: 'in-progress' },
  { offset: 8, yesterday: 'Debug 429 errors for too many requests when running backfill process', today: 'Resolve 429 errors (too many requests) for azure backfill job. Am able to run end-to-end without errors and stage transformed files locally', status: 'in-progress' },
  { offset: 6, today: 'Review staged azure billing data files (transformed) and upload to s3 path that Compass portal reads from (CUR ETL JSON outputs)', status: 'in-progress' },
  { offset: 5, today: 'Review staged azure billing data files (transformed) and upload to s3 path that Compass portal reads from (CUR ETL JSON outputs)', blockers: 'Waiting on Compass portal access confirmation', status: 'blocked' },
  { offset: 3, today: 'Review staged azure billing data files (transformed) and upload to s3 path that Compass portal reads from (CUR ETL JSON outputs, etc.). Resolve minor issues with on-demand insights for Azure outside of 12-month lookback window. Deploy to dev and review with Andrew and Nick.', status: 'in-progress' },
];
const storyALive: StoryState = { offset: 0, today: 'None (Done)', status: 'in-progress' };

const storyBStates: StoryState[] = [
  { offset: 14, today: 'Reproduce login timeout issue reported by Compass users after 15 minutes of inactivity', status: 'in-progress' },
  { offset: 10, today: 'Identify root cause as an expired refresh token not being renewed correctly in the AuthContext', status: 'in-progress' },
  { offset: 3, today: 'Deploy fix to dev and verify with QA team', status: 'in-progress' },
];
const storyBLive: StoryState = { offset: 0, today: 'None (Done)', status: 'done' };

export function createSampleUpdate(): SavedUpdate {
  const snapshotOffsets = Array.from(new Set([...storyAStates, ...storyBStates].map((s) => s.offset))).sort((a, b) => b - a);

  const changelog: UpdateSnapshot[] = snapshotOffsets.map((offset) => ({
    savedAt: isoDaysAgo(offset),
    stories: [
      stateAtOffset(storyAStates, offset) && buildStory(storyABase, stateAtOffset(storyAStates, offset)!),
      stateAtOffset(storyBStates, offset) && buildStory(storyBBase, stateAtOffset(storyBStates, offset)!),
    ].filter((s): s is StoryEntry => Boolean(s)),
  }));

  const stories = [buildStory(storyABase, storyALive), buildStory(storyBBase, storyBLive)];

  return {
    id: SAMPLE_UPDATE_ID,
    name: 'Sample Data (Demo)',
    createdAt: isoDaysAgo(16),
    updatedAt: isoDaysAgo(0),
    stories,
    changelog,
  };
}
