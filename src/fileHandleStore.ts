/**
 * Persists FileSystemFileHandle objects in IndexedDB so they survive page reloads.
 * Each record maps a single imported file's handle to the entry IDs it produced.
 * When any of those entries are saved, the updated entries are written back to the file.
 */

import type { SavedUpdate } from './types';

const DB_NAME = 'trackwise-fh';
const STORE_NAME = 'handles';
const DB_VERSION = 1;

export interface FileHandleRecord {
  id: string;
  handle: FileSystemFileHandle;
  entryIds: string[];
  fileName: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Store a new handle, replacing any existing records that overlap the same entry IDs. */
export async function storeFileHandle(
  handle: FileSystemFileHandle,
  entryIds: string[],
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getAllReq = store.getAll();
    getAllReq.onsuccess = () => {
      const existing: FileHandleRecord[] = getAllReq.result;
      // Remove stale records that referenced any of these entry IDs
      for (const rec of existing) {
        if (rec.entryIds.some((id) => entryIds.includes(id))) {
          store.delete(rec.id);
        }
      }
      store.put({ id: crypto.randomUUID(), handle, entryIds, fileName: handle.name });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Return the handle record for a given entry ID, or null if none. */
export async function getHandleForEntry(entryId: string): Promise<FileHandleRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const records: FileHandleRecord[] = req.result;
      resolve(records.find((r) => r.entryIds.includes(entryId)) ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Return all stored handle records (used to build the linkedFileNames map). */
export async function getAllLinkedFiles(): Promise<FileHandleRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Remove any handle records that include the specified entry IDs (called on delete). */
export async function removeHandlesForEntries(entryIds: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const records: FileHandleRecord[] = req.result;
      for (const rec of records) {
        if (rec.entryIds.some((id) => entryIds.includes(id))) {
          store.delete(rec.id);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** True when the browser supports the File System Access API. */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

/**
 * Write the entries that originated from a handle's file back to that file.
 * Requests write permission if needed (this must be called from a user-gesture
 * handler so the permission prompt is allowed to appear).
 * Returns true if the write succeeded.
 */
export async function writeEntriesToHandle(
  record: FileHandleRecord,
  allEntries: SavedUpdate[],
): Promise<boolean> {
  try {
    // queryPermission / requestPermission are not yet in all TypeScript DOM typings.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = record.handle as any;
    let perm: string = await h.queryPermission({ mode: 'readwrite' });
    if (perm === 'prompt') {
      perm = await h.requestPermission({ mode: 'readwrite' });
    }
    if (perm !== 'granted') return false;

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      updates: allEntries.filter((e) => record.entryIds.includes(e.id)),
    };
    const writable = await record.handle.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}
