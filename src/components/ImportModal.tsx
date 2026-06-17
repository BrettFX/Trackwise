import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Upload, FileJson, AlertCircle, CheckCircle2,
  ClipboardPaste, TriangleAlert,
} from 'lucide-react';
import type { ImportMode, ImportPreview } from '../utils';
import { previewImport, importUpdates, loadSavedUpdates } from '../utils';
import type { SavedUpdate } from '../types';

interface ImportModalProps {
  onClose: () => void;
  onImported: (updates: SavedUpdate[]) => void;
}

type Step = 'input' | 'preview' | 'done';

function pluralise(n: number, word: string) {
  return `${n} ${word}${n !== 1 ? 's' : ''}`;
}

export default function ImportModal({ onClose, onImported }: ImportModalProps) {
  const [step, setStep] = useState<Step>('input');
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasExisting = loadSavedUpdates().length > 0;

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function loadJsonText(text: string) {
    setJson(text);
    setParseError(null);
    const p = previewImport(text);
    if (p.error) {
      setParseError(p.error);
      setPreview(null);
    } else {
      setPreview(p);
    }
  }

  function handleFileSelect(file: File) {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setParseError('Please select a .json file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => loadJsonText(e.target?.result as string);
    reader.readAsText(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  function handleProceed() {
    if (!json.trim() || !preview) return;
    // If no duplicates or no existing entries, skip mode choice and import directly
    if (!hasExisting || preview.duplicates === 0) {
      doImport('merge');
    } else {
      setStep('preview');
    }
  }

  function doImport(selectedMode: ImportMode) {
    const r = importUpdates(json, selectedMode);
    onImported(r.importedUpdates); // pass imported entries to parent
    setResult({ imported: r.imported, duplicates: r.duplicates });
    setStep('done');
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-bold text-gray-900">Import Updates</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {/* ── Step: input ── */}
          {step === 'input' && (
            <>
              {/* Drag-and-drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer px-6 py-8 transition-colors
                  ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
              >
                <div className={`p-3 rounded-full transition-colors ${dragging ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                  <FileJson className={`w-6 h-6 ${dragging ? 'text-indigo-600' : 'text-gray-400'}`} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-700">
                    {dragging ? 'Drop to load file' : 'Drag & drop a JSON file'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">or click to browse</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-400 font-medium">or paste JSON</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              {/* JSON textarea */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={json}
                  onChange={(e) => loadJsonText(e.target.value)}
                  placeholder={'Paste your Trackwise export JSON here…'}
                  rows={7}
                  spellCheck={false}
                  className={`w-full rounded-xl border px-4 py-3 text-xs font-mono resize-y focus:outline-none focus:ring-2 transition-colors
                    ${parseError ? 'border-red-300 bg-red-50 focus:ring-red-200' : 'border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-indigo-100 focus:bg-white'}`}
                />
                {json && (
                  <button
                    onClick={() => { setJson(''); setPreview(null); setParseError(null); }}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded-md p-1 transition-colors"
                    title="Clear"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Paste from clipboard button */}
              {!json && (
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) loadJsonText(text);
                    } catch { /* clipboard permission denied */ }
                  }}
                  className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-lg px-4 py-2 transition-colors"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" /> Paste from clipboard
                </button>
              )}

              {/* Parse error */}
              {parseError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700">{parseError}</p>
                </div>
              )}

              {/* Valid preview summary */}
              {preview && !parseError && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium">
                    {pluralise(preview.updates.length, 'update')} found
                    {preview.invalid > 0 && `, ${pluralise(preview.invalid, 'invalid entry')} will be skipped`}
                    {preview.duplicates > 0 && hasExisting && (
                      <span className="text-amber-600"> · {pluralise(preview.duplicates, 'duplicate')} detected</span>
                    )}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Step: preview (duplicates exist) ── */}
          {step === 'preview' && preview && (
            <>
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <TriangleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">{pluralise(preview.duplicates, 'duplicate')} detected</span> — {pluralise(preview.duplicates, 'entry')} in this file already exist in your saved updates.
                </p>
              </div>

              <fieldset>
                <legend className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2.5">How would you like to handle duplicates?</legend>
                <div className="flex flex-col gap-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="radio" name="mode" value="merge" checked={mode === 'merge'}
                      onChange={() => setMode('merge')} className="mt-0.5 accent-indigo-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">Skip duplicates</p>
                      <p className="text-xs text-gray-400 mt-0.5">Keep your existing entries. Only new ones will be added ({pluralise(preview.updates.length - preview.duplicates, 'new entry')}).</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="radio" name="mode" value="replace" checked={mode === 'replace'}
                      onChange={() => setMode('replace')} className="mt-0.5 accent-indigo-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">Replace all</p>
                      <p className="text-xs text-gray-400 mt-0.5">Remove all existing saved updates and load only the imported ones.</p>
                    </div>
                  </label>
                </div>
              </fieldset>
            </>
          )}

          {/* ── Step: done ── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gray-900">Import complete</p>
                <p className="text-sm text-gray-500 mt-1">
                  {pluralise(result.imported, 'update')} imported
                  {result.duplicates > 0 ? `, ${pluralise(result.duplicates, 'duplicate')} skipped` : ''}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          {step === 'input' && (
            <>
              <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleProceed}
                disabled={!preview || !!parseError || preview.updates.length === 0}
                className="flex items-center gap-2 text-sm px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" />
                Import {preview && preview.updates.length > 0 ? pluralise(preview.updates.length, 'update') : ''}
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('input')} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                Back
              </button>
              <button
                onClick={() => doImport(mode)}
                className="flex items-center gap-2 text-sm px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> Confirm Import
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose} className="text-sm px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
