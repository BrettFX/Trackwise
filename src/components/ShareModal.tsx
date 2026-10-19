import { useState, useEffect, useMemo } from 'react';
import { X, Share2, CheckCircle2, Mail } from 'lucide-react';
import type { SavedUpdate } from '../types';
import {
  shareUpdates, defaultShareSubject, isValidEmail, loadRecentRecipients, rememberRecipients,
} from '../utils';

interface ShareModalProps {
  entries: SavedUpdate[];
  onClose: () => void;
}

const fieldLabel = 'text-xs font-semibold text-gray-600 uppercase tracking-wide';
const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400';

export default function ShareModal({ entries, onClose }: ShareModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<'opened' | 'downloaded' | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [subjectEdited, setSubjectEdited] = useState(false);
  const [message, setMessage] = useState('');
  const [recent] = useState(() => loadRecentRecipients());

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chosen = useMemo(() => entries.filter((e) => selected.has(e.id)), [entries, selected]);
  const autoSubject = chosen.length > 0 ? defaultShareSubject(chosen) : '';
  // Until the user edits the subject, it follows the selection.
  const shownSubject = subjectEdited ? subject : autoSubject;

  const allSelected = entries.length > 0 && selected.size === entries.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** Add one or more addresses from free text (split on comma, semicolon, whitespace). */
  function addRecipients(raw: string): boolean {
    const parts = raw.split(/[\s,;]+/).map((p) => p.replace(/^<|>$/g, '')).filter(Boolean);
    if (parts.length === 0) return true;
    const invalid = parts.filter((p) => !isValidEmail(p));
    const valid = parts.filter(isValidEmail);
    setRecipients((prev) => {
      const next = [...prev];
      for (const v of valid) {
        if (!next.some((x) => x.toLowerCase() === v.toLowerCase())) next.push(v);
      }
      return next;
    });
    if (invalid.length > 0) {
      setRecipientError(`Not a valid email address: ${invalid.join(', ')}`);
      setRecipientInput(invalid.join(' '));
      return false;
    }
    setRecipientError(null);
    setRecipientInput('');
    return true;
  }

  async function handleShare() {
    if (chosen.length === 0) return;
    // Commit any address still being typed; abort if it's invalid.
    const pending = recipientInput.split(/[\s,;]+/).map((p) => p.replace(/^<|>$/g, '')).filter(Boolean);
    if (!pending.every(isValidEmail)) { addRecipients(recipientInput); return; }
    const to = [...recipients, ...pending].filter(
      (e, i, all) => all.findIndex((x) => x.toLowerCase() === e.toLowerCase()) === i,
    );
    rememberRecipients(to);
    setDone(await shareUpdates(chosen, { to, subject: shownSubject, message }));
  }

  const suggestions = recent
    .filter((r) => !recipients.some((x) => x.toLowerCase() === r.toLowerCase()))
    .filter((r) => !recipientInput || r.toLowerCase().includes(recipientInput.toLowerCase()))
    .slice(0, 5);

  const hint = selected.size === 0
    ? 'Select at least one export to share.'
    : selected.size === 1
      ? 'The JSON file will be attached directly.'
      : `${selected.size} JSON files will be attached as a zip.`;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-bold text-gray-900">Share via Email</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {done ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gray-900">
                  {done === 'opened' ? 'Email draft opened' : 'Email draft downloaded'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {done === 'opened'
                    ? 'The draft with your attachment should now be open in your email app, ready to send.'
                    : 'Open the downloaded .eml file to get a draft with the attachment ready to send.'}
                </p>
              </div>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No saved updates to share yet.</p>
          ) : (
            <>
              {/* Entries */}
              <div className="flex flex-col gap-2">
                <label className={`flex items-center gap-3 cursor-pointer ${fieldLabel}`}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.id)))}
                    className="accent-indigo-600"
                  />
                  Select all
                </label>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {entries.map((e) => (
                    <label
                      key={e.id}
                      className="flex items-center gap-3 cursor-pointer rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggle(e.id)}
                        className="accent-indigo-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">{e.name}</p>
                        <p className="text-xs text-gray-400">
                          {e.stories.length} task{e.stories.length !== 1 ? 's' : ''} · updated {new Date(e.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Recipients */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="share-to" className={fieldLabel}>To <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <div
                  className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 focus-within:ring-2 ${
                    recipientError ? 'border-red-300 focus-within:ring-red-200' : 'border-gray-200 focus-within:ring-indigo-300 focus-within:border-indigo-400'
                  }`}
                >
                  {recipients.map((r) => (
                    <span key={r} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full pl-2.5 pr-1 py-0.5">
                      {r}
                      <button
                        type="button"
                        onClick={() => setRecipients((prev) => prev.filter((x) => x !== r))}
                        className="p-0.5 rounded-full hover:bg-indigo-100"
                        aria-label={`Remove ${r}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    id="share-to"
                    type="text"
                    value={recipientInput}
                    onChange={(e) => { setRecipientInput(e.target.value); setRecipientError(null); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === ' ') {
                        if (recipientInput.trim()) { e.preventDefault(); addRecipients(recipientInput); }
                        else if (e.key === 'Enter') e.preventDefault();
                      } else if (e.key === 'Backspace' && !recipientInput && recipients.length > 0) {
                        setRecipients((prev) => prev.slice(0, -1));
                      }
                    }}
                    onBlur={() => { if (recipientInput.trim()) addRecipients(recipientInput); }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text');
                      if (/[\s,;]/.test(text.trim())) { e.preventDefault(); addRecipients(text); }
                    }}
                    placeholder={recipients.length === 0 ? 'name@example.com' : ''}
                    className="flex-1 min-w-[10rem] text-sm px-1 py-1 focus:outline-none"
                  />
                </div>
                {recipientError && <p className="text-xs text-red-600">{recipientError}</p>}
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addRecipients(s)}
                        className="text-xs text-gray-500 border border-gray-200 rounded-full px-2.5 py-0.5 hover:bg-gray-50 hover:text-indigo-600"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="share-subject" className={fieldLabel}>Subject</label>
                <input
                  id="share-subject"
                  type="text"
                  value={shownSubject}
                  onChange={(e) => { setSubject(e.target.value); setSubjectEdited(true); }}
                  placeholder="Select an export to generate a subject"
                  className={inputClass}
                />
              </div>

              {/* Message */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="share-message" className={fieldLabel}>Message <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <textarea
                  id="share-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-y`}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          {done ? (
            <button onClick={onClose} className="ml-auto text-sm px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">
              Done
            </button>
          ) : (
            <>
              <p className="text-xs text-gray-400">{hint}</p>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleShare}
                  disabled={selected.size === 0}
                  className="flex items-center gap-2 text-sm px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Mail className="w-3.5 h-3.5" /> Create email draft
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
