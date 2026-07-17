import { useState, useEffect, useCallback, useRef } from 'react';

export interface UpdateInfo {
  version: string;
  body: string | null;
}

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; info: UpdateInfo; install: () => Promise<void> }
  | { status: 'downloading' }
  | { status: 'error'; message: string };

const POLL_INTERVAL_MS = 5 * 60 * 1000;

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const checkInProgress = useRef(false);

  const check = useCallback(async () => {
    if (!isTauri() || checkInProgress.current) return;
    checkInProgress.current = true;
    setState({ status: 'checking' });

    try {
      const { check: checkUpdate } = await import('@tauri-apps/plugin-updater');
      const update = await checkUpdate();

      if (!update?.available) {
        setState({ status: 'idle' });
        checkInProgress.current = false;
        return;
      }

      const info: UpdateInfo = {
        version: update.version ?? 'unknown',
        body: update.body ?? null,
      };

      setState({
        status: 'available',
        info,
        install: async () => {
          setState({ status: 'downloading' });
          try {
            await update.downloadAndInstall();
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
          } catch (err) {
            setState({ status: 'error', message: String(err) });
          }
        },
      });
    } catch (err) {
      setState({ status: 'error', message: String(err) });
    } finally {
      checkInProgress.current = false;
    }
  }, []);

  const dismiss = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  // Check on open
  useEffect(() => {
    if (!isTauri()) return;
    void check();
  }, [check]);

  // Poll every 5 minutes
  useEffect(() => {
    if (!isTauri()) return;
    const id = setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [check]);

  return { state, check, dismiss };
}
