import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, RefreshCw, Clipboard, ClipboardCheck, TriangleAlert, Ban } from 'lucide-react';
import { generateAbstractiveSummary, saveSelectedModel } from '../ollama';

interface AiSummaryModalProps {
  extractiveSummary: string;
  model: string;
  availableModels: string[];
  onModelChange: (model: string) => void;
  onClose: () => void;
}

type GenerationState =
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'error'; message: string }
  | { status: 'cancelled' };

export default function AiSummaryModal({ extractiveSummary, model, availableModels, onModelChange, onClose }: AiSummaryModalProps) {
  const [state, setState] = useState<GenerationState>({ status: 'loading' });
  const [copied, setCopied] = useState(false);
  const [customModel, setCustomModel] = useState(model);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  function runGenerate() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'loading' });
    setElapsedMs(0);
    generateAbstractiveSummary(extractiveSummary, model, controller.signal)
      .then((text) => { if (!controller.signal.aborted) setState({ status: 'ready', text }); })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: String(err instanceof Error ? err.message : err) });
      });
  }

  useEffect(() => {
    runGenerate();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractiveSummary, model]);

  // Tick a "N.Ns" counter while waiting — makes long local-model generations feel less stuck.
  useEffect(() => {
    if (state.status !== 'loading') return;
    const start = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [state.status]);

  function cancelGeneration() {
    abortRef.current?.abort();
    setState({ status: 'cancelled' });
  }

  function handleCopy() {
    if (state.status !== 'ready') return;
    navigator.clipboard.writeText(state.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function applyModel(next: string) {
    const trimmed = next.trim();
    if (!trimmed) return;
    saveSelectedModel(trimmed);
    onModelChange(trimmed);
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
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-bold text-gray-900">AI-rewritten summary (Beta)</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <TriangleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Generated locally by {model} via Ollama — always review for accuracy before using it in a real report.
            </p>
          </div>

          {/* Model picker */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide shrink-0">Model</label>
            {availableModels.length > 0 ? (
              <select
                value={model}
                onChange={(e) => applyModel(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                onBlur={() => applyModel(customModel)}
                placeholder="e.g. qwen2.5:1.5b"
                className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              />
            )}
          </div>

          {/* Result */}
          {state.status === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <p className="text-sm">Rewriting with {model}… {(elapsedMs / 1000).toFixed(1)}s</p>
              {elapsedMs > 8000 && (
                <p className="text-xs text-gray-400 max-w-xs text-center">
                  Larger models can take a while on CPU — try a smaller model from the dropdown above if this is too slow.
                </p>
              )}
              <button
                onClick={cancelGeneration}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          )}
          {state.status === 'cancelled' && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <p className="text-sm text-gray-600">Generation cancelled.</p>
            </div>
          )}
          {state.status === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="text-sm text-red-700">{state.message}</p>
            </div>
          )}
          {state.status === 'ready' && (
            <p className="text-sm text-gray-700 leading-relaxed rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
              {state.text}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={runGenerate}
            disabled={state.status === 'loading'}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
          <button
            onClick={handleCopy}
            disabled={state.status !== 'ready'}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {copied ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
