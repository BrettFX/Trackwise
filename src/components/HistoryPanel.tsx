import { useState } from 'react';
import { Trash2, RotateCcw, ChevronDown, ChevronUp, Clock, History } from 'lucide-react';
import type { SavedUpdate, StoryEntry } from '../types';

interface HistoryPanelProps {
  history: SavedUpdate[];
  onLoad: (update: SavedUpdate) => void;
  onLoadSnapshot: (parentUpdate: SavedUpdate, snapshotStories: StoryEntry[]) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StorySnapshotSummary({ stories }: { stories: StoryEntry[] }) {
  return (
    <div className="flex flex-col gap-3">
      {stories.map((s, idx) => (
        <div key={s.id ?? idx} className="text-xs text-gray-600 leading-relaxed">
          <p className="font-semibold text-gray-700 mb-0.5">
            {s.title || '(untitled)'}
            {s.ticketNumber && <span className="text-gray-400 font-normal ml-1.5">({s.ticketNumber})</span>}
          </p>
          <p><span className="font-medium text-gray-500">Yesterday:</span> {s.yesterday.trim() || 'None'}</p>
          <p><span className="font-medium text-gray-500">Today:</span> {s.today.trim() || '—'}</p>
          <p><span className="font-medium text-gray-500">Blockers:</span> {s.blockers.trim() || 'None'}</p>
        </div>
      ))}
    </div>
  );
}

function HistoryEntry({
  update,
  onLoad,
  onLoadSnapshot,
  onDelete,
}: {
  update: SavedUpdate;
  onLoad: (u: SavedUpdate) => void;
  onLoadSnapshot: (parent: SavedUpdate, stories: StoryEntry[]) => void;
  onDelete: (id: string) => void;
}) {
  const [changelogOpen, setChangelogOpen] = useState(false);
  const hasChangelog = update.changelog && update.changelog.length > 0;

  return (
    <li className="border-b border-gray-100 last:border-b-0">
      {/* Main row */}
      <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-gray-800 truncate">{update.name}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">
              {formatDate(update.createdAt)} · {update.stories.length} {update.stories.length === 1 ? 'story' : 'stories'}
            </span>
            {hasChangelog && (
              <span className="text-xs text-indigo-400 font-medium">
                {update.changelog.length} revision{update.changelog.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-4 shrink-0">
          {hasChangelog && (
            <button
              onClick={() => setChangelogOpen((o) => !o)}
              title="View changelog"
              className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              {changelogOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={() => onLoad(update)}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Load
          </button>
          <button
            onClick={() => onDelete(update.id)}
            className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Changelog */}
      {changelogOpen && hasChangelog && (
        <div className="bg-slate-50 border-t border-gray-100 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Revision History</p>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-indigo-100" />
            <div className="flex flex-col gap-4">
              {/* Oldest to newest */}
              {[...update.changelog].map((snap, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-300 mt-0.5 shrink-0 z-10" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-xs font-semibold text-gray-500">{formatDate(snap.savedAt)}</span>
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
              {/* Current version marker */}
              <div className="flex gap-3 items-start">
                <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-indigo-500 mt-0.5 shrink-0 z-10" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-indigo-600">Current version</span>
                    <span className="text-xs text-gray-400">(loaded via Load button above)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export default function HistoryPanel({ history, onLoad, onLoadSnapshot, onDelete }: HistoryPanelProps) {
  const [open, setOpen] = useState(true);

  if (history.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <button
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Saved Updates ({history.length})
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <ul>
          {history.map((update) => (
            <HistoryEntry
              key={update.id}
              update={update}
              onLoad={onLoad}
              onLoadSnapshot={onLoadSnapshot}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
