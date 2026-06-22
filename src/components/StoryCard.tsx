
import { X, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import type { StoryEntry, StoryStatus, TaskType } from '../types';
import { TASK_TYPE_LABELS } from '../utils';

interface StoryCardProps {
  story: StoryEntry;
  index: number;
  total: number;
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
  errors: Partial<Record<keyof StoryEntry, string>>;
  onChange: (id: string, field: keyof StoryEntry, value: string) => void;
  onRemove: (id: string) => void;
}

const STATUS_OPTIONS: { value: StoryStatus; label: string; dot: string }[] = [
  { value: 'not-started', label: 'Not Started', dot: 'bg-gray-400' },
  { value: 'in-progress', label: 'In Progress', dot: 'bg-indigo-500' },
  { value: 'done',        label: 'Done',        dot: 'bg-emerald-500' },
  { value: 'blocked',     label: 'Blocked',     dot: 'bg-red-500' },
];

const STATUS_SELECT_CLASS: Record<StoryStatus, string> = {
  'not-started': 'text-gray-600',
  'in-progress': 'text-indigo-600',
  'done':        'text-emerald-600',
  'blocked':     'text-red-600',
};

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'task',  label: 'Task' },
  { value: 'story', label: 'Story' },
  { value: 'spike', label: 'Spike' },
  { value: 'bug',   label: 'Bug' },
];

export function statusDotClass(status: StoryStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.dot ?? 'bg-gray-400';
}

const selectBase = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-white transition-colors appearance-none cursor-pointer';

export default function StoryCard({ story, index, total, collapsed, onToggleCollapse, errors, onChange, onRemove }: StoryCardProps) {
  const status: StoryStatus = story.status ?? 'not-started';
  const taskType: TaskType = story.taskType ?? 'task';
  const typeLabel = TASK_TYPE_LABELS[taskType];
  const summaryLabel = story.title.trim() || `${typeLabel} ${index + 1}`;
  const hasErrors = Object.keys(errors).length > 0;
  const activeDot = statusDotClass(status);

  function extractTicketFromUrl(url: string): string | null {
    const match = url.match(/\/([A-Z]+-\d+)\s*$/i);
    return match ? match[1].toUpperCase() : null;
  }

  function handleTicketChange(val: string) {
    const upper = val.toUpperCase();
    onChange(story.id, 'ticketNumber', upper);
    if (upper && (story.jiraUrl === '' || story.jiraUrl === `https://jira.faa.gov/browse/${story.ticketNumber}`)) {
      onChange(story.id, 'jiraUrl', `https://jira.faa.gov/browse/${upper}`);
    }
  }

  function handleUrlChange(val: string) {
    onChange(story.id, 'jiraUrl', val);
    const extracted = extractTicketFromUrl(val);
    if (extracted) onChange(story.id, 'ticketNumber', extracted);
  }

  const field = (
    id: keyof StoryEntry,
    label: string,
    required: boolean,
    placeholder: string,
    multiline?: boolean,
    hint?: string
  ) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${story.id}`} className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {!required && <span className="text-gray-400 font-normal ml-1 normal-case">(optional)</span>}
      </label>
      {multiline ? (
        <textarea
          id={`${id}-${story.id}`}
          value={story[id] as string}
          onChange={(e) => onChange(story.id, id, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`w-full rounded-lg border px-3 py-2 text-sm font-sans resize-y transition-colors
            ${errors[id] ? 'border-red-400 bg-red-50 focus:ring-red-300' : 'border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white'}
            focus:outline-none focus:ring-2 focus:ring-indigo-100`}
        />
      ) : (
        <input
          id={`${id}-${story.id}`}
          type="text"
          value={story[id] as string}
          onChange={(e) =>
            id === 'ticketNumber' ? handleTicketChange(e.target.value)
            : id === 'jiraUrl' ? handleUrlChange(e.target.value)
            : onChange(story.id, id, e.target.value)
          }
          placeholder={placeholder}
          className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors
            ${errors[id] ? 'border-red-400 bg-red-50 focus:ring-red-300' : 'border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white'}
            focus:outline-none focus:ring-2 focus:ring-indigo-100`}
        />
      )}
      {errors[id] && <p className="text-xs text-red-500">{errors[id]}</p>}
      {hint && !errors[id] && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${hasErrors ? 'border-red-300' : 'border-gray-200'}`}>
      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer select-none hover:bg-gray-100 transition-colors"
        onClick={() => onToggleCollapse(story.id)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 shrink-0">
            {typeLabel} {index + 1}
          </span>
          {/* Status dot — always visible */}
          <span className={`w-2 h-2 rounded-full shrink-0 ${activeDot}`} title={STATUS_OPTIONS.find(o => o.value === status)?.label} />
          {collapsed && (
            <span className="text-xs text-gray-500 truncate ml-0.5">— {summaryLabel}</span>
          )}
          {hasErrors && collapsed && (
            <span className="text-xs text-red-400 font-semibold ml-1 shrink-0">⚠ incomplete</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {total > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(story.id); }}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Remove</span>
            </button>
          )}
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Fields */}
      {!collapsed && (
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          {/* Type + Status row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Task type dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Type</label>
              <div className="relative">
                <select
                  value={taskType}
                  onChange={(e) => onChange(story.id, 'taskType', e.target.value)}
                  className={`${selectBase} pr-8 font-semibold text-indigo-600`}
                >
                  {TASK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>

            {/* Status dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => onChange(story.id, 'status', e.target.value)}
                  className={`${selectBase} pr-8 font-semibold ${STATUS_SELECT_CLASS[status]}`}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>
          </div>

          {field('title', 'Title', true, 'e.g. Implement Glue ETL for CUR 2.0 Cost Insights')}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('jiraUrl', 'Jira URL', false, 'https://jira.faa.gov/browse/…', false, 'Paste URL to auto-fill Ticket # — or enter Ticket # to auto-fill URL')}
            {field('ticketNumber', 'Jira Ticket #', false, 'e.g. FCSCCE-9124', false)}
          </div>

          {field('yesterday', 'Yesterday', false, 'What did you work on yesterday?', true)}
          {field('today', 'Today', true, 'What are you working on today?', true)}
          {field('blockers', 'Blockers', false, 'Any blockers? Leave blank for "None"', true)}
        </div>
      )}
    </div>
  );
}
