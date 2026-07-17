import { RefreshCw, X, Download, AlertCircle } from 'lucide-react';
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

      {/* Update available dialog */}
      {state.status === 'available' && (
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
        </div>
      )}

      {/* Downloading progress overlay */}
      {state.status === 'downloading' && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-900">Downloading update…</p>
            <p className="text-xs text-gray-400 mt-1">Trackwise will restart when ready.</p>
          </div>
        </div>
      )}

      {/* Error toast */}
      {state.status === 'error' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Update check failed: {state.message}</span>
          <button onClick={onDismiss} className="ml-2 text-red-400 hover:text-red-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
