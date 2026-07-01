
import { useState } from 'react';
import { X, GripVertical, ChevronDown, ChevronUp, History, Trash2, CheckSquare, Clipboard, ClipboardCheck } from 'lucide-react';
import type { StoryEntry, StoryPriority, StoryStatus, TaskLineageEntry, TaskType } from '../types';
import { statusDotClass, TASK_PRIORITY_LABELS, TASK_TYPE_LABELS } from '../utils';
import { buildLineageSummary } from '../pastTense';

interface StoryCardProps {
  story: StoryEntry;
  index: number;
  total: number;
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
  errors: Partial<Record<keyof StoryEntry, string>>;
  onChange: (id: string, field: keyof StoryEntry, value: string) => void;
  onRemove: (id: string) => void;
  lineage?: TaskLineageEntry[];
  showDates?: boolean;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  onDragOverTarget?: () => void;
  onDrop?: () => void;
  onDeleteLineageEntry?: (updateId: string, savedAt: string) => void;
  onDeleteLineageEntries?: (entries: { updateId: string; savedAt: string }[]) => void;
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

const PRIORITY_OPTIONS: { value: StoryPriority; label: string }[] = [
  { value: 'low', label: TASK_PRIORITY_LABELS.low },
  { value: 'medium', label: TASK_PRIORITY_LABELS.medium },
  { value: 'high', label: TASK_PRIORITY_LABELS.high },
];

const PRIORITY_SELECT_CLASS: Record<StoryPriority, string> = {
  low: 'text-sky-600',
  medium: 'text-amber-600',
  high: 'text-red-600',
};

const selectBase = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-white transition-colors appearance-none cursor-pointer';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function formatHeaderDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function StoryCard({ story, index, total, collapsed, onToggleCollapse, errors, onChange, onRemove, lineage = [], showDates = true, draggable = false, dragging = false, onDragStart, onDragEnd, onDragOverTarget, onDrop, onDeleteLineageEntry, onDeleteLineageEntries }: StoryCardProps) {
  const [lineageOpen, setLineageOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<'single' | 'selected' | 'all' | null>(null);
  const [pendingSingle, setPendingSingle] = useState<{ updateId: string; savedAt: string } | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  function handleCopySummary() {
    const isComplete = story.status === 'done';
    const summary = buildLineageSummary(sortedLineage.map((e) => ({ savedAt: e.savedAt, yesterday: e.yesterday, today: e.today })), isComplete);
    if (!summary) return;
    navigator.clipboard.writeText(summary).then(() => {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    });
  }
  const status: StoryStatus = story.status ?? 'not-started';
  const taskType: TaskType = story.taskType ?? 'task';
  const priority = story.priority;
  const typeLabel = TASK_TYPE_LABELS[taskType];
  const labelNumber = story.sequenceNumber ?? index + 1;
  const summaryLabel = story.title.trim() || `${typeLabel} ${labelNumber}`;
  const fullTitle = story.title.trim() || summaryLabel;
  const hasErrors = Object.keys(errors).length > 0;
  const activeDot = statusDotClass(status);
  const hasLineage = story.carryOver || lineage.length > 1;

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

  const sortedLineage = [...lineage].sort((a, b) => {
    // Need to convert the savedAt date timestamp to an actual date for comparison purposes
    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
  });

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
    <div
      className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${dragging ? 'opacity-60 ring-2 ring-indigo-200' : ''} ${hasErrors ? 'border-red-300' : 'border-gray-200'}`}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDragOverTarget?.();
      }}
      onDrop={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDrop?.();
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer select-none hover:bg-gray-100 transition-colors"
        onClick={() => onToggleCollapse(story.id)}
        title={fullTitle}
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <button
            type="button"
            draggable={draggable}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', story.id);
              onDragStart?.(story.id);
            }}
            onDragEnd={(e) => {
              e.stopPropagation();
              onDragEnd?.();
            }}
            className={`rounded p-0.5 transition-colors ${draggable ? 'cursor-grab text-gray-400 hover:bg-indigo-50 hover:text-indigo-500 active:cursor-grabbing' : 'cursor-not-allowed text-gray-300'}`}
            title={draggable ? 'Drag to reorder' : 'Drag unavailable'}
            aria-label={draggable ? 'Drag to reorder task' : 'Task drag handle disabled'}
          >
            <GripVertical className="w-4 h-4 shrink-0" />
          </button>
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 shrink-0">
            {typeLabel} {labelNumber}
          </span>
          {/* Status dot — always visible */}
          <span className={`w-2 h-2 rounded-full shrink-0 ${activeDot}`} title={STATUS_OPTIONS.find(o => o.value === status)?.label} />
          {priority && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded shrink-0">
              {TASK_PRIORITY_LABELS[priority]}
            </span>
          )}
          {showDates && (
            <>
              <span
                className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded shrink-0"
                title={`Created ${formatDate(story.createdAt)}`}
              >
                Created {formatHeaderDate(story.createdAt)}
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded shrink-0"
                title={`Modified ${formatDate(story.updatedAt ?? story.createdAt)}`}
              >
                Modified {formatHeaderDate(story.updatedAt ?? story.createdAt)}
              </span>
            </>
          )}
          {collapsed && (
            <span className="text-xs text-gray-500 truncate ml-0.5"> {summaryLabel}</span>
          )}
          {hasErrors && collapsed && (
            <span className="text-xs text-red-400 font-semibold ml-1 shrink-0">⚠ incomplete</span>
          )}
          {story.carryOver && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
              Carry-over
            </span>
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
          {story.carryOver && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Carry-over:</span> from {story.carryOver.sourceUpdateName}
                {story.carryOver.generation > 1 ? ` · generation ${story.carryOver.generation}` : ''}
              </p>
            </div>
          )}

          {/* Type + Status + Priority row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            {/* Priority dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Priority
                <span className="text-gray-400 font-normal ml-1 normal-case">(optional)</span>
              </label>
              <div className="relative">
                <select
                  value={priority ?? ''}
                  onChange={(e) => onChange(story.id, 'priority', e.target.value)}
                  className={`${selectBase} pr-8 font-semibold ${priority ? PRIORITY_SELECT_CLASS[priority] : 'text-gray-500'}`}
                >
                  <option value="">No priority</option>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>
          </div>

          {field('title', 'Title', true, 'e.g. Implement Glue ETL for CUR 2.0 Cost Insights')}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('jiraUrl', 'Jira URL', false, 'https://jira.faa.gov/browse/…', false, 'Paste URL to auto-fill Ticket #  or enter Ticket # to auto-fill URL')}
            {field('ticketNumber', 'Jira Ticket #', false, 'e.g. FCSCCE-9124', false)}
          </div>

          {field('yesterday', 'Yesterday', false, 'What did you work on yesterday?', true)}
          {field('today', 'Today', true, 'What are you working on today?', true)}
          {field('blockers', 'Blockers', false, 'Any blockers? Leave blank for "None"', true)}

          {hasLineage && (
            <div className="border-t border-gray-100 pt-3">
              {/* Lineage header row */}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setLineageOpen((o) => !o);
                    if (lineageOpen) { setSelectMode(false); setSelectedIds(new Set()); }
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  <History className="w-3.5 h-3.5" />
                  {lineageOpen ? 'Hide' : 'View'} task lineage
                  {lineage.length > 0 ? ` (${lineage.length})` : ''}
                  {lineageOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {lineageOpen && (
                  <div className="flex items-center gap-2">
                    {/* Copy summary — visible whenever there is today content, regardless of checkpoints */}
                    {!selectMode && sortedLineage.some((e) => e.today.trim()) && (
                      <button
                        onClick={handleCopySummary}
                        className={`flex items-center gap-1 text-xs transition-colors ${copiedSummary ? 'text-emerald-500' : 'text-gray-400 hover:text-indigo-500'}`}
                        title="Copy past-tense summary to clipboard"
                      >
                        {copiedSummary ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
                        {copiedSummary ? 'Copied!' : 'Copy summary'}
                      </button>
                    )}
                    {/* Select / delete controls — only when checkpoint entries exist */}
                    {sortedLineage.some((e) => e.checkpoint) && (
                      !selectMode ? (
                        <>
                          <button
                            onClick={() => { setSelectMode(true); setSelectedIds(new Set()); }}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
                            title="Select items to delete"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            Select
                          </button>
                          <button
                            onClick={() => setConfirmDelete('all')}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                            title="Clear all checkpoint entries"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Clear all
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              const allIds = new Set(sortedLineage.filter((e) => e.checkpoint).map((e) => e.id));
                              setSelectedIds((prev) => prev.size === allIds.size ? new Set() : allIds);
                            }}
                            className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
                          >
                            {selectedIds.size === sortedLineage.filter((e) => e.checkpoint).length ? 'Deselect all' : 'Select all'}
                          </button>
                          {selectedIds.size > 0 && (
                            <button
                              onClick={() => setConfirmDelete('selected')}
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete ({selectedIds.size})
                            </button>
                          )}
                          <button
                            onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                          Cancel
                        </button>
                      </>
                      )
                    )}
                  </div>
                )}
              </div>

              {lineageOpen && (
                <div className="mt-3 flex flex-col gap-2">
                  {lineage.length === 0 && story.carryOver && (
                    <p className="text-xs text-gray-500">Carried over from {story.carryOver.sourceUpdateName}.</p>
                  )}
                  {sortedLineage.map((entry) => {
                    const isSelected = selectedIds.has(entry.id);
                    return (
                      <div
                        key={entry.id}
                        className={`rounded-lg border px-3 py-2 text-xs text-gray-600 transition-colors ${
                          selectMode && entry.checkpoint
                            ? isSelected
                              ? 'border-indigo-300 bg-indigo-50 cursor-pointer'
                              : 'border-gray-200 bg-gray-50 cursor-pointer hover:border-indigo-200'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                        onClick={() => {
                          if (!selectMode || !entry.checkpoint) return;
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id);
                            return next;
                          });
                        }}
                      >
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {selectMode && entry.checkpoint && (
                              <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 bg-white'}`}>
                                {isSelected && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                              </span>
                            )}
                            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(entry.status)}`} />
                            <span className="font-semibold text-gray-700">{entry.updateName}</span>
                            <span className="text-gray-400">{formatDate(entry.savedAt)}</span>
                            {entry.checkpoint && <span className="text-indigo-500 font-medium">checkpoint</span>}
                            {entry.note && <span className="text-indigo-600 italic">"{entry.note}"</span>}
                          </div>
                          {!selectMode && entry.checkpoint && onDeleteLineageEntry && (
                            <button
                              onClick={() => { setPendingSingle({ updateId: entry.updateId, savedAt: entry.savedAt }); setConfirmDelete('single'); }}
                              className="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                              title="Delete this checkpoint"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p><span className="font-medium text-gray-500">Yesterday:</span> {entry.yesterday.trim() || 'None'}</p>
                        <p><span className="font-medium text-gray-500">Today:</span> {entry.today.trim() || 'None'}</p>
                        <p><span className="font-medium text-gray-500">Blockers:</span> {entry.blockers.trim() || 'None'}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Lineage delete confirmation modal */}
          {confirmDelete !== null && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfirmDelete(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900">
                    {confirmDelete === 'all' ? 'Clear all lineage entries' : confirmDelete === 'selected' ? `Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'entry' : 'entries'}` : 'Delete checkpoint'}
                  </h2>
                </div>
                <p className="text-sm text-gray-600 mb-5">
                  {confirmDelete === 'all'
                    ? 'This will remove all checkpoint entries from the task lineage. This cannot be undone.'
                    : confirmDelete === 'selected'
                    ? `This will remove the ${selectedIds.size} selected checkpoint ${selectedIds.size === 1 ? 'entry' : 'entries'}. This cannot be undone.`
                    : 'Are you sure you want to delete this checkpoint entry? This cannot be undone.'}
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { setConfirmDelete(null); setPendingSingle(null); }}
                    className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDelete === 'single' && pendingSingle && onDeleteLineageEntry) {
                        onDeleteLineageEntry(pendingSingle.updateId, pendingSingle.savedAt);
                      } else if (confirmDelete === 'selected' && onDeleteLineageEntries) {
                        const toDelete = sortedLineage
                          .filter((e) => selectedIds.has(e.id))
                          .map((e) => ({ updateId: e.updateId, savedAt: e.savedAt }));
                        onDeleteLineageEntries(toDelete);
                        setSelectMode(false);
                        setSelectedIds(new Set());
                      } else if (confirmDelete === 'all' && onDeleteLineageEntries) {
                        const toDelete = sortedLineage
                          .filter((e) => e.checkpoint)
                          .map((e) => ({ updateId: e.updateId, savedAt: e.savedAt }));
                        onDeleteLineageEntries(toDelete);
                      }
                      setConfirmDelete(null);
                      setPendingSingle(null);
                    }}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmDelete === 'all' ? 'Clear all' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
