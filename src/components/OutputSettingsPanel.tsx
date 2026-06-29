import { useState } from 'react';
import { Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import type { OutputSettings, StoryStatus } from '../types';

interface OutputSettingsPanelProps {
  settings: OutputSettings;
  onChange: (settings: OutputSettings) => void;
  filteredCount: number;   // items that will appear in output
  totalCount: number;      // total items
}

const STATUS_OPTIONS: { value: StoryStatus; label: string; dot: string }[] = [
  { value: 'not-started', label: 'Not Started', dot: 'bg-gray-400' },
  { value: 'in-progress', label: 'In Progress', dot: 'bg-indigo-500' },
  { value: 'done',        label: 'Done',        dot: 'bg-emerald-500' },
  { value: 'blocked',     label: 'Blocked',     dot: 'bg-red-500' },
];

export default function OutputSettingsPanel({ settings, onChange, filteredCount, totalCount }: OutputSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const hasFilters = settings.excludeStatuses.length > 0 || !settings.showStatus || !settings.showPriority;

  function toggleExclude(status: StoryStatus) {
    const excluded = settings.excludeStatuses;
    const next = excluded.includes(status)
      ? excluded.filter((s) => s !== status)
      : [...excluded, status];
    onChange({ ...settings, excludeStatuses: next });
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Output Settings</span>
          {hasFilters && (
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
              Custom
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {filteredCount < totalCount && (
            <span className="text-xs text-amber-600 font-medium">
              {filteredCount}/{totalCount} items shown
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Settings body */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 flex flex-col gap-5">

          {/* Show Status toggle */}
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">Include status in output</p>
              <p className="text-xs text-gray-400 mt-0.5">Show a "Status:" line for each item in the generated text</p>
            </div>
            <button
              role="switch"
              aria-checked={settings.showStatus}
              onClick={() => onChange({ ...settings, showStatus: !settings.showStatus })}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 cursor-pointer
                ${settings.showStatus ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                  ${settings.showStatus ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>

          {/* Show Priority toggle */}
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">Include priority in output</p>
              <p className="text-xs text-gray-400 mt-0.5">Show a "Priority:" line for each item that has a priority set</p>
            </div>
            <button
              role="switch"
              aria-checked={settings.showPriority}
              onClick={() => onChange({ ...settings, showPriority: !settings.showPriority })}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 cursor-pointer
                ${settings.showPriority ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                  ${settings.showPriority ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>

          {/* Exclude by status */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Exclude items from output by status</p>
            <p className="text-xs text-gray-400 mb-3">Items with these statuses will be omitted when generating output</p>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const excluded = settings.excludeStatuses.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors select-none
                      ${excluded
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                  >
                    <input
                      type="checkbox"
                      checked={excluded}
                      onChange={() => toggleExclude(opt.value)}
                      className="rounded accent-indigo-600 w-4 h-4 shrink-0"
                    />
                    <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                    <span className={`text-xs font-semibold ${excluded ? 'text-indigo-700' : 'text-gray-600'}`}>
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Reset */}
          {hasFilters && (
            <button
              onClick={() => onChange({ showStatus: true, showPriority: true, excludeStatuses: [] })}
              className="self-start text-xs font-semibold text-gray-400 hover:text-gray-600 underline transition-colors"
            >
              Reset to defaults
            </button>
          )}
        </div>
      )}
    </div>
  );
}
