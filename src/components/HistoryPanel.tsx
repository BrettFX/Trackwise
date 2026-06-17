import { useState } from 'react';
import { Trash2, RotateCcw, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import type { SavedUpdate } from '../types';

interface HistoryPanelProps {
  history: SavedUpdate[];
  onLoad: (update: SavedUpdate) => void;
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

export default function HistoryPanel({ history, onLoad, onDelete }: HistoryPanelProps) {
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
        <ul className="divide-y divide-gray-100">
          {history.map((update) => (
            <li key={update.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-gray-800 truncate">{update.name}</span>
                <span className="text-xs text-gray-400">{formatDate(update.createdAt)} · {update.stories.length} {update.stories.length === 1 ? 'story' : 'stories'}</span>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
