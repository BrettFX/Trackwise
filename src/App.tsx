import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Zap, Save, RefreshCw, Bookmark, FilePlus, Check, ChevronsUpDown, Trash2, TriangleAlert } from 'lucide-react';
import StoryCard from './components/StoryCard';
import OutputPanel from './components/OutputPanel';
import HistoryPanel from './components/HistoryPanel';
import ImportModal from './components/ImportModal';
import VersionInfo from './components/VersionInfo';
import OutputSettingsPanel from './components/OutputSettingsPanel';
import type { StoryEntry, SavedUpdate } from './types';
import { makeEmptyStory, formatOutputHTML, loadSavedUpdates, saveAsNew, silentSave, saveCheckpoint, deleteUpdate, renameUpdate, exportUpdates, exportSingleUpdate, hasUnsavedChanges, loadOutputSettings, saveOutputSettings } from './utils';
import { storeFileHandle, getHandleForEntry, getAllLinkedFiles, writeEntriesToHandle, removeHandlesForEntries } from './fileHandleStore';
import type { OutputSettings } from './types';

function App() {
  const [stories, setStories] = useState<StoryEntry[]>([makeEmptyStory()]);
  const [htmlOutput, setHtmlOutput] = useState('');
  const [errors, setErrors] = useState<Record<string, Partial<Record<keyof StoryEntry, string>>>>({});
  const [history, setHistory] = useState<SavedUpdate[]>(() => loadSavedUpdates());
  const [currentUpdateId, setCurrentUpdateId] = useState<string | null>(null);
  const [outputSettings, setOutputSettings] = useState<OutputSettings>(() => loadOutputSettings());

  // ── Linked file handles (File System Access API) ─────────────────────
  // Maps entry ID → file name for entries that were imported from a file.
  const [linkedFileNames, setLinkedFileNames] = useState<Record<string, string>>({});

  async function refreshLinkedFileNames() {
    try {
      const records = await getAllLinkedFiles();
      const map: Record<string, string> = {};
      for (const rec of records) {
        for (const id of rec.entryIds) map[id] = rec.fileName;
      }
      setLinkedFileNames(map);
    } catch { /* IndexedDB unavailable */ }
  }

  useEffect(() => { refreshLinkedFileNames(); }, []);

  /** Write the current storage snapshot back to the linked file for this entry.
   *  Must be called from a user-gesture handler so permission prompts are allowed. */
  async function syncLinkedFile(entryId: string) {
    try {
      const record = await getHandleForEntry(entryId);
      if (!record) return;
      await writeEntriesToHandle(record, loadSavedUpdates());
    } catch { /* silent — never disrupt the save flow */ }
  }

  function handleOutputSettingsChange(next: OutputSettings) {
    setOutputSettings(next);
    saveOutputSettings(next);
    // Regenerate output immediately so the preview reflects the new settings
    if (htmlOutput) setHtmlOutput(formatOutputHTML(stories, next));
  }

  // Save-as-new modal
  const [saveNamePrompt, setSaveNamePrompt] = useState(false);
  const [saveName, setSaveName] = useState('');
  const afterSaveRef = useRef<(() => void) | null>(null);

  // Silent save feedback
  const [silentSavedFeedback, setSilentSavedFeedback] = useState(false);

  // Collapsed story cards
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCard = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const allCollapsed = stories.length > 0 && stories.every((s) => collapsedIds.has(s.id));

  function toggleAll() {
    if (allCollapsed) {
      setCollapsedIds(new Set());
    } else {
      setCollapsedIds(new Set(stories.map((s) => s.id)));
    }
  }

  // Checkpoint modal
  const [checkpointPrompt, setCheckpointPrompt] = useState(false);
  const [checkpointNote, setCheckpointNote] = useState('');
  const [checkpointStatus, setCheckpointStatus] = useState<'idle' | 'saved' | 'skipped'>('idle');

  const handleChange = useCallback((id: string, field: keyof StoryEntry, value: string) => {
    setStories((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    setErrors((prev) => {
      const copy = { ...prev };
      if (copy[id]) delete copy[id][field];
      return copy;
    });
  }, []);

  const handleRemove = useCallback((id: string) => {
    setStories((prev) => prev.filter((s) => s.id !== id));
    setCollapsedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const addStory = () => {
    const story = makeEmptyStory();
    setStories((prev) => [...prev, story]);
  };

  function validate(): boolean {
    const newErrors: typeof errors = {};
    let valid = true;
    for (const story of stories) {
      const storyErrors: Partial<Record<keyof StoryEntry, string>> = {};
      if (!story.title.trim()) { storyErrors.title = 'Story title is required.'; valid = false; }
      if (!story.today.trim()) { storyErrors.today = 'Today field is required.'; valid = false; }
      if (Object.keys(storyErrors).length) newErrors[story.id] = storyErrors;
    }
    setErrors(newErrors);
    return valid;
  }

  function handleGenerate() {
    if (!validate()) return;
    setHtmlOutput(formatOutputHTML(stories, outputSettings));
  }

  // ── Silent save (no changelog, no modal) ────────────────────────────
  async function handleSilentSave() {
    if (!currentUpdateId) {
      // No entry loaded yet — open the name modal to save as new
      openSaveAsNewPrompt();
      return;
    }
    const updated = silentSave(currentUpdateId, saveName, stories);
    if (updated) {
      setHistory(loadSavedUpdates());
      setSilentSavedFeedback(true);
      setTimeout(() => setSilentSavedFeedback(false), 2000);
      await syncLinkedFile(currentUpdateId);
    }
  }

  // ── Save as new ──────────────────────────────────────────────────────
  function openSaveAsNewPrompt() {
    setSaveName(stories[0]?.title ? `${stories[0].title} – ${new Date().toLocaleDateString()}` : '');
    setSaveNamePrompt(true);
  }

  function confirmSaveAsNew() {
    const saved = saveAsNew(saveName, stories);
    setHistory(loadSavedUpdates());
    setCurrentUpdateId(saved.id);
    setSaveName(saved.name);
    setSaveNamePrompt(false);
    if (afterSaveRef.current) {
      const fn = afterSaveRef.current;
      afterSaveRef.current = null;
      fn();
    }
  }

  // ── Checkpoint ───────────────────────────────────────────────────────
  function openCheckpointPrompt() {
    if (!validate()) return;
    setCheckpointNote('');
    setCheckpointStatus('idle');
    setCheckpointPrompt(true);
  }

  function confirmCheckpoint() {
    if (!currentUpdateId) return;
    const result = saveCheckpoint(currentUpdateId, checkpointNote, stories);
    setHistory(loadSavedUpdates());
    if (result.saved) {
      syncLinkedFile(currentUpdateId);
      setCheckpointStatus('saved');
      setTimeout(() => {
        setCheckpointPrompt(false);
        setCheckpointStatus('idle');
        setCheckpointNote('');
      }, 1400);
    } else {
      setCheckpointStatus('skipped');
    }
  }

  // ── Load / delete ────────────────────────────────────────────────────
  function handleLoad(update: SavedUpdate) {
    // Always resolve the latest version from storage to pick up any renames
    const fresh = loadSavedUpdates().find((u) => u.id === update.id) ?? update;
    const loaded = fresh.stories.map((s) => ({ ...s }));
    setStories(loaded);
    setCurrentUpdateId(fresh.id);
    setSaveName(fresh.name);
    setHtmlOutput(formatOutputHTML(loaded, outputSettings));
    setErrors({});
  }

  function handleLoadSnapshot(parentUpdate: SavedUpdate, snapshotStories: StoryEntry[]) {
    // Resolve fresh parent so the name reflects any renames made after the snapshot was captured
    const freshParent = loadSavedUpdates().find((u) => u.id === parentUpdate.id) ?? parentUpdate;
    const loaded = snapshotStories.map((s) => ({ ...s }));
    setStories(loaded);
    setCurrentUpdateId(freshParent.id);
    setSaveName(freshParent.name);
    setHtmlOutput(formatOutputHTML(loaded, outputSettings));
    setErrors({});
  }

  function handleDelete(id: string) {
    deleteUpdate(id);
    setHistory(loadSavedUpdates());
    if (currentUpdateId === id) { setCurrentUpdateId(null); setSaveName(''); }
    removeHandlesForEntries([id]).then(() => refreshLinkedFileNames());
  }

  function handleRename(id: string, newName: string) {
    renameUpdate(id, newName);
    setHistory(loadSavedUpdates());
    if (currentUpdateId === id) setSaveName(newName);
  }

  // ── Delete confirmation ──────────────────────────────────────────────
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function requestDelete(id: string) {
    setPendingDeleteId(id);
  }

  function confirmDelete() {
    if (!pendingDeleteId) return;
    handleDelete(pendingDeleteId);
    setPendingDeleteId(null);
  }

  // ── Export / Import ──────────────────────────────────────────────────
  function handleExport() {
    exportUpdates();
  }

  function handleExportEntry(id: string) {
    exportSingleUpdate(id);
  }

  const [importOpen, setImportOpen] = useState(false);
  const [unsavedWarning, setUnsavedWarning] = useState(false);

  function openImport() {
    if (hasUnsavedChanges(currentUpdateId, stories)) {
      setUnsavedWarning(true);
    } else {
      setImportOpen(true);
    }
  }

  function handleImportDone(importedUpdates: import('./types').SavedUpdate[], fileHandle?: FileSystemFileHandle) {
    setHistory(loadSavedUpdates());
    setImportOpen(false);
    if (fileHandle && importedUpdates.length > 0) {
      const entryIds = importedUpdates.map((u) => u.id);
      storeFileHandle(fileHandle, entryIds).then(() => refreshLinkedFileNames());
    }
    // Auto-load the most recently created imported update
    if (importedUpdates.length > 0) {
      const newest = importedUpdates.reduce((a, b) =>
        new Date(a.createdAt) >= new Date(b.createdAt) ? a : b
      );
      handleLoad(newest);
    }
  }

  function handleClear() {
    if (!confirm('Clear all stories and start fresh?')) return;
    setStories([makeEmptyStory()]);
    setHtmlOutput('');
    setErrors({});
    setCurrentUpdateId(null);
    setSaveName('');
  }

  const isEditing = currentUpdateId !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-6 sm:py-10 px-3 sm:px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
            <Zap className="w-3.5 h-3.5" /> Trackwise
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Daily Status Update</h1>
          <p className="text-gray-500 mt-1 text-sm">Fill in your stories and generate a Teams-ready YTB update.</p>
          <div className="mt-2">
            <VersionInfo />
          </div>
        </div>

        {/* Save-as-new modal */}
        {saveNamePrompt && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Save as New</h2>
              <p className="text-sm text-gray-500 mb-4">Give this update a name so you can load it later.</p>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Name</label>
              <input
                autoFocus
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmSaveAsNew()}
                placeholder="e.g. Sprint 42 – Day 3"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setSaveNamePrompt(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={confirmSaveAsNew} className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Checkpoint modal */}
        {checkpointPrompt && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
              {checkpointStatus === 'saved' ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-base font-semibold text-gray-800">Checkpoint saved!</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Bookmark className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-lg font-bold text-gray-900">Save Checkpoint</h2>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Mark the current state as a milestone. Only saved if content has changed since the last checkpoint.
                  </p>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Note <span className="text-gray-400 font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    autoFocus
                    value={checkpointNote}
                    onChange={(e) => { setCheckpointNote(e.target.value); setCheckpointStatus('idle'); }}
                    placeholder="e.g. End of sprint day 2 — waiting on AWS response"
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  {checkpointStatus === 'skipped' && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-3">
                      <span className="text-amber-500 text-sm mt-0.5">⚠</span>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        No meaningful changes detected since the last checkpoint. Edit your stories before checkpointing.
                      </p>
                    </div>
                  )}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => { setCheckpointPrompt(false); setCheckpointStatus('idle'); }}
                      className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmCheckpoint}
                      className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      <Bookmark className="w-3.5 h-3.5" /> Save Checkpoint
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {pendingDeleteId !== null && (() => {
          const target = history.find((u) => u.id === pendingDeleteId);
          return (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900">Delete Update</h2>
                </div>
                <p className="text-sm text-gray-600 mb-5">
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-gray-800">&ldquo;{target?.name ?? 'this update'}&rdquo;</span>?
                  This will also remove its entire revision history and cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setPendingDeleteId(null)}
                    className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Unsaved changes warning */}
        {unsavedWarning && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <TriangleAlert className="w-4 h-4 text-amber-500" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Unsaved Changes</h2>
              </div>
              <p className="text-sm text-gray-600 mb-5">
                You have unsaved changes that will be replaced when you load imported updates. Would you like to save your work first?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setUnsavedWarning(false); afterSaveRef.current = () => setImportOpen(true); openSaveAsNewPrompt(); }}
                  className="w-full flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" /> Save First
                </button>
                <button
                  onClick={() => { setUnsavedWarning(false); setImportOpen(true); }}
                  className="w-full text-sm px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Continue Without Saving
                </button>
                <button
                  onClick={() => setUnsavedWarning(false)}
                  className="w-full text-sm px-4 py-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import modal */}
        {importOpen && (
          <ImportModal onClose={() => setImportOpen(false)} onImported={handleImportDone} />
        )}

        {/* History */}
        <HistoryPanel
          history={history}
          onLoad={handleLoad}
          onLoadSnapshot={handleLoadSnapshot}
          onDelete={requestDelete}
          onRename={handleRename}
          onExportEntry={handleExportEntry}
          onExport={handleExport}
          onImport={openImport}
          linkedFileNames={linkedFileNames}
        />

        {/* Current update badge */}
        {isEditing && (
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="text-xs text-gray-500">Editing:</span>
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full truncate max-w-xs">
              {saveName || 'Unnamed Update'}
            </span>
          </div>
        )}

        {/* Story cards */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {stories.length} {stories.length === 1 ? 'Item' : 'Items'}
          </span>
          {stories.length > 1 && (
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              {allCollapsed ? 'Expand All' : 'Collapse All'}
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 mb-5">
          {stories.map((story, idx) => (
            <StoryCard
              key={story.id}
              story={story}
              index={idx}
              total={stories.length}
              collapsed={collapsedIds.has(story.id)}
              onToggleCollapse={toggleCard}
              errors={errors[story.id] ?? {}}
              onChange={handleChange}
              onRemove={handleRemove}
            />
          ))}
        </div>

        {/* Add story */}
        <button
          onClick={addStory}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-500 text-sm font-semibold hover:border-indigo-400 hover:bg-indigo-50 transition-colors mb-6"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>

        {/* Action bar */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Zap className="w-4 h-4" />
            <span>Generate Output</span>
          </button>

          {/* Save — silent sync when editing, opens name modal when new */}
          <button
            onClick={handleSilentSave}
            className={`flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg transition-all shadow-sm border
              ${silentSavedFeedback
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            {silentSavedFeedback ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {silentSavedFeedback ? 'Saved!' : 'Save'}
          </button>

          {/* Checkpoint — only shown when editing an existing entry */}
          {isEditing && (
            <button
              onClick={openCheckpointPrompt}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Bookmark className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Checkpoint</span>
            </button>
          )}

          {/* Save as New — only shown when editing */}
          {isEditing && (
            <button
              onClick={openSaveAsNewPrompt}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <FilePlus className="w-4 h-4" />
              <span className="hidden sm:inline">Save as New</span>
            </button>
          )}

          <button
            onClick={handleClear}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-500 text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm ml-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>

        {/* Output */}
        <OutputSettingsPanel
          settings={outputSettings}
          onChange={handleOutputSettingsChange}
          filteredCount={stories.filter((s) => !outputSettings.excludeStatuses.includes(s.status ?? 'not-started')).length}
          totalCount={stories.length}
        />
        <OutputPanel htmlOutput={htmlOutput} />

        <p className="text-center text-xs text-gray-400 mt-6">Saved updates are stored locally in your browser.</p>
      </div>
    </div>
  );
}

export default App;
