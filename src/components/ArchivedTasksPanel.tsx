import { useState } from 'react';
import { X, Trash2, RotateCcw, Archive } from 'lucide-react';
import type { ArchivedTask, StoryStatus, TaskType } from '../types';
import { statusDotClass, TASK_TYPE_LABELS } from '../utils';

interface ArchivedTasksPanelProps {
  archivedTasks: ArchivedTask[];
  onClose: () => void;
  onRestore: (storyId: string) => void;
  onDeletePermanently: (storyId: string) => void;
  onEmptyTrash: () => void;
}

const STATUS_LABELS: Record<StoryStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'done': 'Done',
  'blocked': 'Blocked',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function ArchivedTasksPanel({
  archivedTasks, onClose, onRestore, onDeletePermanently, onEmptyTrash,
}: ArchivedTasksPanelProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-bold text-gray-900">Archived Tasks</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {archivedTasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Deleted tasks show up here and can be restored or removed for good.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {archivedTasks.map((archived) => {
                const { story } = archived;
                const status: StoryStatus = story.status ?? 'not-started';
                const taskType: TaskType = story.taskType ?? 'task';
                return (
                  <li key={story.id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(status)}`} />
                      <p className="text-sm font-semibold text-gray-700 truncate">
                        <span className="text-indigo-500 mr-1">{TASK_TYPE_LABELS[taskType]}:</span>
                        {story.title.trim() || '(untitled)'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      Deleted {formatDate(archived.deletedAt)} · {STATUS_LABELS[status]}
                      {archived.sourceUpdateName ? ` · from "${archived.sourceUpdateName}"` : ''}
                    </p>
                    {confirmDeleteId === story.id ? (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <p className="text-xs text-red-700 flex-1">Delete permanently? This cannot be undone.</p>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => { onDeletePermanently(story.id); setConfirmDeleteId(null); }}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onRestore(story.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(story.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {archivedTasks.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-4">
            {confirmEmpty ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs text-red-700 flex-1">Permanently delete all {archivedTasks.length} archived tasks?</p>
                <button
                  onClick={() => setConfirmEmpty(false)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { onEmptyTrash(); setConfirmEmpty(false); }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
                >
                  Empty Trash
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmEmpty(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" /> Empty Trash
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
