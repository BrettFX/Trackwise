import { useState, useRef } from 'react';
import { Trash2, RotateCcw, ChevronDown, ChevronUp, Clock, History, Download, Upload, Pencil, Check, X, Link2, CopyPlus } from 'lucide-react';
import type { SavedUpdate, StoryEntry, StoryStatus, TaskType } from '../types';
import { statusDotClass } from './StoryCard';
import { TASK_TYPE_LABELS } from '../utils';

interface HistoryPanelProps {
  history: SavedUpdate[];
  onLoad: (update: SavedUpdate) => void;
  onLoadSnapshot: (parentUpdate: SavedUpdate, snapshotStories: StoryEntry[]) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onExportEntry: (id: string) => void;
  onExport: () => void;
  onImport: () => void;
  onCarryOverStories: (update: SavedUpdate, stories: StoryEntry[]) => void;
  currentUpdateId?: string | null;
  linkedFileNames?: Record<string, string>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const STATUS_LABELS: Record<StoryStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'done': 'Done',
  'blocked': 'Blocked',
};

function StorySnapshotSummary({
  stories, selectedIds, onToggleStory,
}: {
  stories: StoryEntry[];
  selectedIds?: Set<string>;
  onToggleStory?: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {stories.map((s, idx) => {
        const status: StoryStatus = s.status ?? 'not-started';
        const taskType: TaskType = s.taskType ?? 'task';
        const selectable = selectedIds && onToggleStory;
        return (
          <div key={s.id ?? idx} className="text-xs text-gray-600 leading-relaxed">
            <div className="flex items-center gap-1.5 mb-0.5">
              {selectable && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(s.id)}
                  onChange={() => onToggleStory(s.id)}
                  className="rounded accent-indigo-600 w-3.5 h-3.5 shrink-0"
                  aria-label={`Select ${s.title || 'untitled task'} to carry over`}
                />
              )}
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(status)}`} />
              <p className="font-semibold text-gray-700">
                <span className="text-indigo-500 mr-1">{TASK_TYPE_LABELS[taskType]}:</span>
                {s.title || '(untitled)'}
                {s.ticketNumber && <span className="text-gray-400 font-normal ml-1.5">({s.ticketNumber})</span>}
                <span className="text-gray-400 font-normal ml-1.5">[{STATUS_LABELS[status]}]</span>
                {s.carryOver && <span className="text-amber-600 font-semibold ml-1.5">[Carry-over]</span>}
              </p>
            </div>
            <p className={selectable ? 'ml-8' : 'ml-3.5'}><span className="font-medium text-gray-500">Yesterday:</span> {s.yesterday.trim() || 'None'}</p>
            <p className={selectable ? 'ml-8' : 'ml-3.5'}><span className="font-medium text-gray-500">Today:</span> {s.today.trim() || '—'}</p>
            <p className={selectable ? 'ml-8' : 'ml-3.5'}><span className="font-medium text-gray-500">Blockers:</span> {s.blockers.trim() || 'None'}</p>
          </div>
        );
      })}
    </div>
  );
}

function HistoryEntry({
  update, onLoad, onLoadSnapshot, onDelete, onRename, onExportEntry, onCarryOverStories, isCurrent, linkedFileName,
}: {
  update: SavedUpdate;
  onLoad: (u: SavedUpdate) => void;
  onLoadSnapshot: (parent: SavedUpdate, stories: StoryEntry[]) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onExportEntry: (id: string) => void;
  onCarryOverStories: (update: SavedUpdate, stories: StoryEntry[]) => void;
  isCurrent: boolean;
  linkedFileName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());
  const renameInputRef = useRef<HTMLInputElement>(null);
  const hasChangelog = update.changelog && update.changelog.length > 0;
  const selectedStories = update.stories.filter((s) => selectedStoryIds.has(s.id));

  function startRename(e: React.MouseEvent) {
    e.stopPropagation();
    setRenameValue(update.name);
    setRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }

  function commitRename() {
    if (renameValue.trim() && renameValue.trim() !== update.name) {
      onRename(update.id, renameValue.trim());
    }
    setRenaming(false);
  }

  function cancelRename() {
    setRenaming(false);
  }

  function toggleSelectedStory(id: string) {
    setSelectedStoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function carryOverSelected() {
    if (selectedStories.length === 0) return;
    onCarryOverStories(update, selectedStories);
    setSelectedStoryIds(new Set());
  }

  return (
    <li className={`border-b last:border-b-0 ${isCurrent ? 'border-indigo-100 bg-indigo-50/70' : 'border-gray-100'}`}>
      {/* Main row */}
      <div className={`flex items-center justify-between px-4 sm:px-5 py-3 transition-colors ${isCurrent ? 'hover:bg-indigo-50' : 'hover:bg-gray-50'}`}>
        {renaming ? (
          /* Inline rename mode */
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-2" onClick={(e) => e.stopPropagation()}>
            <input
              ref={renameInputRef}
              autoFocus
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename(); }}
              className="flex-1 min-w-0 border border-indigo-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <button onClick={commitRename} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" title="Save">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={cancelRename} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" title="Cancel">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
            onClick={() => setExpanded((o) => !o)}
          >
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className={`text-sm font-medium truncate ${isCurrent ? 'text-indigo-900' : 'text-gray-800'}`}>{update.name}</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">
                  Created {formatDate(update.createdAt)} · Last saved {formatDate(update.updatedAt ?? update.createdAt)} · {update.stories.length} {update.stories.length === 1 ? 'item' : 'items'}
                </span>
                {isCurrent && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    <Check className="w-3 h-3" />
                    Editing
                  </span>
                )}
                {hasChangelog && (
                  <span className="text-xs text-indigo-400 font-medium">
                    {update.changelog.length} checkpoint{update.changelog.length !== 1 ? 's' : ''}
                  </span>
                )}
                {linkedFileName && (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"
                    title={`Changes save back to: ${linkedFileName}`}
                  >
                    <Link2 className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[110px]">{linkedFileName}</span>
                  </span>
                )}
              </div>
            </div>
          </button>
        )}

        {!renaming && (
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <button
              onClick={startRename}
              title="Rename"
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onExportEntry(update.id)}
              title="Download this entry as JSON"
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onLoad(update)}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Load</span>
            </button>
            <button
              onClick={() => onDelete(update.id)}
              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded panel: current stories preview + optional changelog */}
      {expanded && (
        <div className="bg-slate-50 border-t border-gray-100 px-4 sm:px-5 py-4">

          {/* Current stories preview */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3">
            <StorySnapshotSummary
              stories={update.stories}
              selectedIds={selectedStoryIds}
              onToggleStory={toggleSelectedStory}
            />
          </div>
          <button
            onClick={carryOverSelected}
            disabled={selectedStories.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-3"
          >
            <CopyPlus className="w-3.5 h-3.5" />
            Carry over {selectedStories.length > 0 ? selectedStories.length : ''} selected
          </button>

          {/* Changelog toggle — only if checkpoints exist */}
          {hasChangelog && (
            <>
              <button
                onClick={() => setChangelogOpen((o) => !o)}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 mb-3 transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                {changelogOpen ? 'Hide' : 'View'} revision history ({update.changelog.length} checkpoint{update.changelog.length !== 1 ? 's' : ''})
                {changelogOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {changelogOpen && (
                <div className="relative">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-indigo-100" />
                  <div className="flex flex-col gap-4">
                    {/* Current version cap — shown first since list is newest → oldest */}
                    <div className="flex gap-3 items-center">
                      <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-indigo-500 shrink-0 z-10" />
                      <span className="text-xs font-semibold text-indigo-600">Current version</span>
                    </div>
                    {[...update.changelog].reverse().map((snap, idx) => (
                      <div key={idx} className="flex gap-3 items-start">
                        <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-300 mt-0.5 shrink-0 z-10" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-semibold text-gray-500">{formatDate(snap.savedAt)}</span>
                              {snap.note && (
                                <span className="text-xs text-indigo-600 font-medium italic">"{snap.note}"</span>
                              )}
                            </div>
                            <button
                              onClick={() => onLoadSnapshot(update, snap.stories)}
                              className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors shrink-0"
                            >
                              Load this
                            </button>
                          </div>
                          <div className="bg-white rounded-lg border border-gray-200 p-3">
                            <StorySnapshotSummary stories={snap.stories} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function HistoryPanel({ history, onLoad, onLoadSnapshot, onDelete, onRename, onExportEntry, onExport, onImport, onCarryOverStories, currentUpdateId, linkedFileNames }: HistoryPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <button
          className="flex items-center gap-2 hover:text-indigo-600 transition-colors"
          onClick={() => setOpen((o) => !o)}
        >
          <Clock className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Saved Updates ({history.length})
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {/* Export / Import */}
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button
              onClick={onExport}
              title="Export all saved updates to JSON"
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
            >
                        <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
          <button
            onClick={onImport}
            title="Import saved updates from JSON"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
          </button>
        </div>
      </div>

      {open && history.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          No saved updates yet. Save an update or import a file to get started.
        </div>
      )}

      {open && history.length > 0 && (
        <ul>
          {history.map((update) => (
            <HistoryEntry
              key={update.id}
              update={update}
              onLoad={onLoad}
              onLoadSnapshot={onLoadSnapshot}
              onDelete={onDelete}
              onRename={onRename}
              onExportEntry={onExportEntry}
              onCarryOverStories={onCarryOverStories}
              isCurrent={update.id === currentUpdateId}
              linkedFileName={linkedFileNames?.[update.id]}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
