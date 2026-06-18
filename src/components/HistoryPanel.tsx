import { useState, useRef } from 'react';
import { Trash2, RotateCcw, ChevronDown, ChevronUp, Clock, History, Download, Upload, Pencil, Check, X } from 'lucide-react';
import type { SavedUpdate, StoryEntry, StoryStatus, TaskType } from '../types';
import { statusDotClass } from './StoryCard';
import { TASK_TYPE_LABELS } from '../utils';

interface HistoryPanelProps {
  history: SavedUpdate[];
  onLoad: (update: SavedUpdate) => void;
  onLoadSnapshot: (parentUpdate: SavedUpdate, snapshotStories: StoryEntry[]) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onExport: () => void;
  onImport: () => void;
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

function StorySnapshotSummary({ stories }: { stories: StoryEntry[] }) {
  return (
    <div className="flex flex-col gap-3">
      {stories.map((s, idx) => {
        const status: StoryStatus = s.status ?? 'not-started';
        const taskType: TaskType = s.taskType ?? 'task';
        return (
          <div key={s.id ?? idx} className="text-xs text-gray-600 leading-relaxed">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(status)}`} />
              <p className="font-semibold text-gray-700">
                <span className="text-indigo-500 mr-1">{TASK_TYPE_LABELS[taskType]}:</span>
                {s.title || '(untitled)'}
                {s.ticketNumber && <span className="text-gray-400 font-normal ml-1.5">({s.ticketNumber})</span>}
                <span className="text-gray-400 font-normal ml-1.5">[{STATUS_LABELS[status]}]</span>
              </p>
            </div>
            <p className="ml-3.5"><span className="font-medium text-gray-500">Yesterday:</span> {s.yesterday.trim() || 'None'}</p>
            <p className="ml-3.5"><span className="font-medium text-gray-500">Today:</span> {s.today.trim() || '—'}</p>
            <p className="ml-3.5"><span className="font-medium text-gray-500">Blockers:</span> {s.blockers.trim() || 'None'}</p>
          </div>
        );
      })}
    </div>
  );
}

function HistoryEntry({
  update, onLoad, onLoadSnapshot, onDelete, onRename,
}: {
  update: SavedUpdate;
  onLoad: (u: SavedUpdate) => void;
  onLoadSnapshot: (parent: SavedUpdate, stories: StoryEntry[]) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const hasChangelog = update.changelog && update.changelog.length > 0;

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

  return (
    <li className="border-b border-gray-100 last:border-b-0">
      {/* Main row */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors">
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
              <span className="text-sm font-medium text-gray-800 truncate">{update.name}</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">
                  {formatDate(update.createdAt)} · {update.stories.length} {update.stories.length === 1 ? 'item' : 'items'}
                </span>
                {hasChangelog && (
                  <span className="text-xs text-indigo-400 font-medium">
                    {update.changelog.length} checkpoint{update.changelog.length !== 1 ? 's' : ''}
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
            <StorySnapshotSummary stories={update.stories} />
          </div>

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
                    {[...update.changelog].map((snap, idx) => (
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
                    {/* Current version cap */}
                    <div className="flex gap-3 items-center">
                      <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-indigo-500 shrink-0 z-10" />
                      <span className="text-xs font-semibold text-indigo-600">Current version</span>
                    </div>
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

export default function HistoryPanel({ history, onLoad, onLoadSnapshot, onDelete, onRename, onExport, onImport }: HistoryPanelProps) {
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
            />
          ))}
        </ul>
      )}
    </div>
  );
}
