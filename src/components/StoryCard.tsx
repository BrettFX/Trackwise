
import { useState } from 'react';
import { X, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import type { StoryEntry } from '../types';

interface StoryCardProps {
  story: StoryEntry;
  index: number;
  total: number;
  errors: Partial<Record<keyof StoryEntry, string>>;
  onChange: (id: string, field: keyof StoryEntry, value: string) => void;
  onRemove: (id: string) => void;
}

export default function StoryCard({ story, index, total, errors, onChange, onRemove }: StoryCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Show a summary line when collapsed
  const summaryLabel = story.title.trim() || `Story ${index + 1}`;
  const hasErrors = Object.keys(errors).length > 0;
  function extractTicketFromUrl(url: string): string | null {
    const match = url.match(/\/([A-Z]+-\d+)\s*$/i);
    return match ? match[1].toUpperCase() : null;
  }

  function handleTicketChange(val: string) {
    const upper = val.toUpperCase();
    onChange(story.id, 'ticketNumber', upper);
    // Auto-populate Jira URL if URL is empty or was previously auto-generated
    if (upper && (story.jiraUrl === '' || story.jiraUrl === `https://jira.faa.gov/browse/${story.ticketNumber}`)) {
      onChange(story.id, 'jiraUrl', `https://jira.faa.gov/browse/${upper}`);
    }
  }

  function handleUrlChange(val: string) {
    onChange(story.id, 'jiraUrl', val);
    // Always extract ticket number from URL — it takes precedence
    const extracted = extractTicketFromUrl(val);
    if (extracted) {
      onChange(story.id, 'ticketNumber', extracted);
    }
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
          value={story[id]}
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
          value={story[id]}
          onChange={(e) =>
            id === 'ticketNumber' ? handleTicketChange(e.target.value) : id === 'jiraUrl' ? handleUrlChange(e.target.value) : onChange(story.id, id, e.target.value)
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
      {/* Card header — click to collapse/expand */}
      <div
        className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer select-none hover:bg-gray-100 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 shrink-0">
            Story {index + 1}
          </span>
          {collapsed && (
            <span className="text-xs text-gray-500 truncate ml-1">— {summaryLabel}</span>
          )}
          {hasErrors && collapsed && (
            <span className="text-xs text-red-400 font-semibold ml-1 shrink-0">⚠ incomplete</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {total > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(story.id); }}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          )}
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Fields — hidden when collapsed */}
      {!collapsed && (
        <div className="p-5 flex flex-col gap-4">
          {field('title', 'Story Title', true, 'e.g. Implement Glue ETL for CUR 2.0 Cost Insights')}

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
