import { X, TriangleAlert, Sparkles, Trash2, Check } from 'lucide-react';
import type { TaskLineageEntry } from '../types';
import { statusDotClass } from '../utils';

interface DuplicateLineageModalProps {
  groups: TaskLineageEntry[][];
  onCleanup: () => void;
  onDismiss: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function sortBySavedAt(group: TaskLineageEntry[]): TaskLineageEntry[] {
  return [...group].sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
}

export default function DuplicateLineageModal({ groups, onCleanup, onDismiss }: DuplicateLineageModalProps) {
  const removableCount = groups.reduce((sum, group) => {
    const sorted = sortBySavedAt(group);
    return sum + sorted.slice(0, -1).filter((e) => e.checkpoint).length;
  }, 0);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-bold text-gray-900">Possible duplicate lineage entries</h2>
          </div>
          <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            {removableCount === 1
              ? 'A checkpoint looks like a near-identical copy of another entry (e.g. only the status changed).'
              : `${removableCount} checkpoints look like near-identical copies of other entries (e.g. only the status changed).`}
            {' '}Auto-cleanup keeps the most recent entry in each group and removes the rest.
          </p>

          {groups.map((group, i) => {
            const sorted = sortBySavedAt(group);
            const keepId = sorted[sorted.length - 1].id;
            return (
              <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex flex-col gap-2">
                {sorted.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-2 text-xs">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${statusDotClass(entry.status)}`} />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-700 truncate">{entry.updateName} · {formatDate(entry.savedAt)}</p>
                        <p className="text-gray-500 truncate">{entry.today.trim() || 'None'}</p>
                      </div>
                    </div>
                    {entry.id === keepId ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium shrink-0">
                        <Check className="w-3 h-3" /> Keep
                      </span>
                    ) : entry.checkpoint ? (
                      <span className="flex items-center gap-1 text-red-500 font-medium shrink-0">
                        <Trash2 className="w-3 h-3" /> Remove
                      </span>
                    ) : (
                      <span className="text-gray-400 shrink-0">Live entry</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onDismiss}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={onCleanup}
            disabled={removableCount === 0}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Clean up automatically
          </button>
        </div>
      </div>
    </div>
  );
}
