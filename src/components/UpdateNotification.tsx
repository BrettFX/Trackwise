import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X, Download, AlertCircle, Check } from 'lucide-react';
import type { UpdateState } from '../hooks/useUpdater';

interface Props {
  state: UpdateState;
  onCheck: () => void;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function UpdateNotification({ state, onCheck, onInstall, onDismiss }: Props) {
  const isChecking = state.status === 'checking';
  const isDownloading = state.status === 'downloading';
  const busy = isChecking || isDownloading;

  useEffect(() => {
    if (state.status !== 'up-to-date') return;
    const id = setTimeout(() => onDismiss(), 4000);
    return () => clearTimeout(id);
  }, [state.status, onDismiss]);

  return (
    <>
      {/* Check for updates button — always visible in header */}
      <button
        onClick={onCheck}
        disabled={busy}
        title="Check for updates"
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
        {isChecking ? 'Checking…' : 'Check for updates'}
      </button>

      {/* Portaled overlays — rendered on document.body to escape backdrop-filter stacking contexts */}
      {state.status === 'available' && createPortal(
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-600 shrink-0" />
                <h2 className="text-lg font-bold text-gray-900">Update Available</h2>
              </div>
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-1">
              Version <span className="font-semibold text-gray-900">{state.info.version}</span> is available.
            </p>

            {state.info.body && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-4 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {state.info.body}
              </p>
            )}

            <p className="text-xs text-gray-400 mb-5">
              Trackwise will download and install the update, then restart automatically.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={onDismiss}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={onInstall}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Install &amp; Restart
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {state.status === 'downloading' && createPortal(
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-900">Downloading update…</p>
            <p className="text-xs text-gray-400 mt-1">Trackwise will restart when ready.</p>
          </div>
        </div>,
        document.body
      )}

      {state.status === 'up-to-date' && createPortal(
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg whitespace-nowrap">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>You&apos;re on the latest version.</span>
          <button onClick={onDismiss} className="ml-2 text-emerald-400 hover:text-emerald-600 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>,
        document.body
      )}

      {state.status === 'error' && createPortal(
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Update check failed: {state.message}</span>
          <button onClick={onDismiss} className="ml-2 text-red-400 hover:text-red-600 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
