import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { Plus, Zap, Save, RefreshCw, Bookmark, FilePlus, Check, ChevronsUpDown, Trash2, TriangleAlert, Filter, ArrowUpDown, X, Settings } from 'lucide-react';
import StoryCard from './components/StoryCard';
import OutputPanel from './components/OutputPanel';
import HistoryPanel from './components/HistoryPanel';
import ImportModal from './components/ImportModal';
import VersionInfo from './components/VersionInfo';
import OutputSettingsPanel from './components/OutputSettingsPanel';
import NavPanel from './components/NavPanel';
import type { StoryEntry, SavedUpdate, StoryStatus, TaskLineageEntry, TaskListSettings, TaskListSortKey } from './types';
import { makeEmptyStory, formatOutputHTML, loadSavedUpdates, saveAsNew, silentSave, saveCheckpoint, deleteUpdate, renameUpdate, exportUpdates, exportSingleUpdate, hasUnsavedChanges, loadOutputSettings, saveOutputSettings, loadTaskListSettings, saveTaskListSettings, loadCollapsedTaskIds, saveCollapsedTaskIds, TASK_PRIORITY_LABELS, TASK_PRIORITY_SCORES } from './utils';
import { storeFileHandle, getHandleForEntry, getAllLinkedFiles, writeEntriesToHandle, removeHandlesForEntries, isFileSystemSaveSupported } from './fileHandleStore';
import type { OutputSettings } from './types';

const STATUS_LABELS: Record<StoryStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'done': 'Done',
  'blocked': 'Blocked',
};

const STATUS_SORT_ORDER: Record<StoryStatus, number> = {
  'in-progress': 0,
  blocked: 1,
  'not-started': 2,
  done: 3,
};

const SORT_OPTIONS: { value: TaskListSortKey; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'createdAt', label: 'Date Created' },
  { value: 'updatedAt', label: 'Date Modified' },
  { value: 'status', label: 'State' },
];

const FILTER_OPTIONS: { value: StoryStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All States' },
  { value: 'in-progress', label: STATUS_LABELS['in-progress'] },
  { value: 'blocked', label: STATUS_LABELS.blocked },
  { value: 'not-started', label: STATUS_LABELS['not-started'] },
  { value: 'done', label: STATUS_LABELS.done },
];

const PRIORITY_FILTER_OPTIONS: { value: TaskListSettings['filterPriority']; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'high', label: TASK_PRIORITY_LABELS.high },
  { value: 'medium', label: TASK_PRIORITY_LABELS.medium },
  { value: 'low', label: TASK_PRIORITY_LABELS.low },
  { value: 'none', label: 'Unassigned' },
];

const DATE_FILTER_OPTIONS: { value: TaskListSettings['filterDate']; label: string }[] = [
  { value: 'all', label: 'Any Date' },
  { value: 'created-today', label: 'Created Today' },
  { value: 'updated-today', label: 'Updated Today' },
  { value: 'created-week', label: 'Created Last 7 Days' },
  { value: 'updated-week', label: 'Updated Last 7 Days' },
];

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function isWithinLastWeek(iso: string): boolean {
  const time = new Date(iso).getTime();
  const now = Date.now();
  return Number.isFinite(time) && time >= now - 7 * 24 * 60 * 60 * 1000 && time <= now;
}

function matchesDateFilter(story: StoryEntry, filterDate: TaskListSettings['filterDate']): boolean {
  if (filterDate === 'all') return true;
  if (filterDate === 'created-today') return isToday(story.createdAt);
  if (filterDate === 'updated-today') return isToday(story.updatedAt ?? story.createdAt);
  if (filterDate === 'created-week') return isWithinLastWeek(story.createdAt);
  return isWithinLastWeek(story.updatedAt ?? story.createdAt);
}

function sortStoriesBy(stories: StoryEntry[], sortBy: TaskListSortKey, order: Map<string, number>): StoryEntry[] {
  return stories.toSorted((a, b) => {
    const manualDelta = (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
    if (sortBy === 'priority') {
      const priorityDelta = (b.priority ? TASK_PRIORITY_SCORES[b.priority] : 0) - (a.priority ? TASK_PRIORITY_SCORES[a.priority] : 0);
      return priorityDelta || manualDelta;
    }
    if (sortBy === 'status') {
      const statusDelta = STATUS_SORT_ORDER[a.status ?? 'not-started'] - STATUS_SORT_ORDER[b.status ?? 'not-started'];
      return statusDelta || manualDelta;
    }
    const aTime = new Date(a[sortBy] ?? a.createdAt).getTime();
    const bTime = new Date(b[sortBy] ?? b.createdAt).getTime();
    return sortBy === 'updatedAt' ? bTime - aTime || manualDelta : aTime - bTime || manualDelta;
  });
}

function hasTaskContent(story: StoryEntry): boolean {
  return Boolean(
    story.title.trim() ||
    story.ticketNumber.trim() ||
    story.jiraUrl.trim() ||
    story.yesterday.trim() ||
    story.today.trim() ||
    story.blockers.trim()
  );
}

function taskLineageKey(story: StoryEntry): string {
  return story.carryOver?.rootStoryId ?? story.id;
}

function makeCarryOverStory(story: StoryEntry, sourceUpdate: SavedUpdate, sequenceNumber: number): StoryEntry {
  const now = new Date().toISOString();
  return {
    ...story,
    id: crypto.randomUUID(),
    sequenceNumber,
    createdAt: now,
    updatedAt: now,
    carryOver: {
      sourceUpdateId: sourceUpdate.id,
      sourceUpdateName: sourceUpdate.name,
      sourceStoryId: story.id,
      rootStoryId: taskLineageKey(story),
      carriedOverAt: now,
      generation: (story.carryOver?.generation ?? 0) + 1,
    },
  };
}

function taskLineageFingerprint(entry: TaskLineageEntry): string {
  return JSON.stringify({
    title: entry.title.trim(),
    status: entry.status,
    today: entry.today.trim(),
    blockers: entry.blockers.trim(),
  });
}

function dedupeTaskLineage(entries: TaskLineageEntry[]): TaskLineageEntry[] {
  const sorted = entries.toSorted((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
  return sorted.reduce<TaskLineageEntry[]>((deduped, entry) => {
    const last = deduped[deduped.length - 1];
    if (last && taskLineageFingerprint(last) === taskLineageFingerprint(entry)) {
      deduped[deduped.length - 1] = entry.checkpoint ? last : entry;
      return deduped;
    }
    deduped.push(entry);
    return deduped;
  }, []);
}

function DropSlot({
  active, onDragOver, onDrop,
}: {
  active: boolean;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      className={`transition-all duration-150 ease-out ${active ? 'h-9 py-1' : 'h-0 py-0'}`}
      onDragEnter={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <div className={`h-full rounded-lg border-2 border-dashed bg-indigo-50/80 shadow-inner transition-all duration-150 ${active ? 'border-indigo-300 opacity-100 scale-100' : 'border-transparent opacity-0 scale-95'}`} />
    </div>
  );
}

function nextSequenceNumber(stories: StoryEntry[]): number {
  return Math.max(0, ...stories.map((story) => story.sequenceNumber ?? 0)) + 1;
}

function App() {
  const [stories, setStories] = useState<StoryEntry[]>([makeEmptyStory()]);
  const [htmlOutput, setHtmlOutput] = useState('');
  const [errors, setErrors] = useState<Record<string, Partial<Record<keyof StoryEntry, string>>>>({});
  const [history, setHistory] = useState<SavedUpdate[]>(() => loadSavedUpdates());
  const [currentUpdateId, setCurrentUpdateId] = useState<string | null>(null);
  const [outputSettings, setOutputSettings] = useState<OutputSettings>(() => loadOutputSettings());
  const [taskListSettings, setTaskListSettings] = useState<TaskListSettings>(() => loadTaskListSettings());

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

  useEffect(() => {
    queueMicrotask(() => {
      void refreshLinkedFileNames();
    });
  }, []);

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

  function handleTaskListSettingsChange(next: TaskListSettings) {
    setTaskListSettings(next);
    saveTaskListSettings(next);
  }

  function handleSortChange(sortBy: TaskListSortKey) {
    captureTaskLayout();
    setStories((prev) => {
      const order = new Map(prev.map((story, idx) => [story.id, idx]));
      const visibleIds = new Set(visibleStories.map((story) => story.id));
      const sortedVisibleIds = sortStoriesBy(
        prev.filter((story) => visibleIds.has(story.id)),
        sortBy,
        order
      ).map((story) => story.id);
      const reordered = reorderVisibleStories(prev, sortedVisibleIds);
      void persistStoryOrder(reordered);
      return reordered;
    });
    const next = { ...taskListSettings, sortBy };
    setTaskListSettings(next);
    saveTaskListSettings(next);
  }

  // Save-as-new modal
  const [saveNamePrompt, setSaveNamePrompt] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveNewToFile, setSaveNewToFile] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const afterSaveRef = useRef<(() => void) | null>(null);

  // Silent save feedback
  const [silentSavedFeedback, setSilentSavedFeedback] = useState(false);

  // Collapsed story cards
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => loadCollapsedTaskIds());
  const [draggingStoryId, setDraggingStoryId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const draggingStoryIdRef = useRef<string | null>(null);
  const filterMenuRef = useRef<HTMLDetailsElement>(null);
  const settingsMenuRef = useRef<HTMLDetailsElement>(null);
  const taskItemRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingLayoutRectsRef = useRef<Map<string, DOMRect> | null>(null);

  useEffect(() => {
    if (!filterMenuOpen && !settingsMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!filterMenuRef.current?.contains(event.target as Node)) {
        setFilterMenuOpen(false);
      }
      if (!settingsMenuRef.current?.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [filterMenuOpen, settingsMenuOpen]);

  const toggleCard = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveCollapsedTaskIds(next);
      return next;
    });
  }, []);

  const visibleStories = stories
    .filter((story) => taskListSettings.filterStatus === 'all' || (story.status ?? 'not-started') === taskListSettings.filterStatus)
    .filter((story) => {
      if (taskListSettings.filterPriority === 'all') return true;
      if (taskListSettings.filterPriority === 'none') return !story.priority;
      return story.priority === taskListSettings.filterPriority;
    })
    .filter((story) => matchesDateFilter(story, taskListSettings.filterDate));
  const filteredOutCount = stories.length - visibleStories.length;
  const filterActive = taskListSettings.filterStatus !== 'all' || taskListSettings.filterPriority !== 'all' || taskListSettings.filterDate !== 'all';
  const allCollapsed = visibleStories.length > 0 && visibleStories.every((s) => collapsedIds.has(s.id));
  const outputCountableStories = stories.filter(hasTaskContent);
  const outputShownCount = outputCountableStories.filter((s) => !outputSettings.excludeStatuses.includes(s.status ?? 'not-started')).length;
  const draggingVisibleIndex = draggingStoryId ? visibleStories.findIndex((story) => story.id === draggingStoryId) : -1;

  function captureTaskLayout() {
    pendingLayoutRectsRef.current = new Map(
      visibleStories
        .map((story) => {
          const node = taskItemRefs.current.get(story.id);
          return node ? ([story.id, node.getBoundingClientRect()] as const) : null;
        })
        .filter((entry): entry is readonly [string, DOMRect] => Boolean(entry))
    );
  }

  useLayoutEffect(() => {
    const previousRects = pendingLayoutRectsRef.current;
    if (!previousRects) return;
    pendingLayoutRectsRef.current = null;

    for (const story of visibleStories) {
      const node = taskItemRefs.current.get(story.id);
      const previous = previousRects.get(story.id);
      if (!node || !previous) continue;

      const next = node.getBoundingClientRect();
      const deltaX = Math.round(previous.left - next.left);
      const deltaY = Math.round(previous.top - next.top);
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue;

      node.style.willChange = 'transform';
      const animation = node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        {
          duration: 240,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        }
      );
      animation.addEventListener('finish', () => {
        node.style.transform = '';
        node.style.willChange = '';
      }, { once: true });
      animation.addEventListener('cancel', () => {
        node.style.transform = '';
        node.style.willChange = '';
      }, { once: true });
    }
  });

  function isValidDropIndex(index: number): boolean {
    return draggingVisibleIndex >= 0 && index !== draggingVisibleIndex && index !== draggingVisibleIndex + 1;
  }

  function setActiveDropIndex(index: number) {
    setDropIndex(isValidDropIndex(index) ? index : null);
  }

  function getTaskLineage(story: StoryEntry): TaskLineageEntry[] {
    const lineageKey = taskLineageKey(story);
    const entries: TaskLineageEntry[] = [];

    for (const update of history) {
      for (const candidate of update.stories) {
        if (taskLineageKey(candidate) === lineageKey) {
          entries.push({
            id: `${update.id}:${candidate.id}:current`,
            updateId: update.id,
            updateName: update.name,
            savedAt: update.updatedAt ?? update.createdAt,
            title: candidate.title,
            status: candidate.status ?? 'not-started',
            today: candidate.today,
            blockers: candidate.blockers,
            checkpoint: false,
          });
        }
      }
      for (const snap of update.changelog ?? []) {
        for (const candidate of snap.stories) {
          if (taskLineageKey(candidate) === lineageKey) {
            entries.push({
              id: `${update.id}:${snap.savedAt}:${candidate.id}`,
              updateId: update.id,
              updateName: update.name,
              savedAt: snap.savedAt,
              title: candidate.title,
              status: candidate.status ?? 'not-started',
              today: candidate.today,
              blockers: candidate.blockers,
              note: snap.note,
              checkpoint: true,
            });
          }
        }
      }
    }

    return dedupeTaskLineage(entries);
  }

  function toggleAll() {
    if (allCollapsed) {
      const next = new Set<string>();
      setCollapsedIds(next);
      saveCollapsedTaskIds(next);
    } else {
      const next = new Set(visibleStories.map((s) => s.id));
      setCollapsedIds(next);
      saveCollapsedTaskIds(next);
    }
  }

  // Checkpoint modal
  const [checkpointPrompt, setCheckpointPrompt] = useState(false);
  const [checkpointNote, setCheckpointNote] = useState('');
  const [checkpointStatus, setCheckpointStatus] = useState<'idle' | 'saved' | 'skipped'>('idle');

  const handleChange = useCallback((id: string, field: keyof StoryEntry, value: string) => {
    setStories((prev) => prev.map((s) => (
      s.id === id
        ? { ...s, [field]: field === 'priority' && value === '' ? undefined : value, updatedAt: new Date().toISOString() }
        : s
    )));
    setErrors((prev) => {
      const copy = { ...prev };
      if (copy[id]) delete copy[id][field];
      return copy;
    });
  }, []);

  async function persistStoryOrder(nextStories: StoryEntry[]) {
    if (!currentUpdateId) return;
    const updated = silentSave(currentUpdateId, saveName, nextStories);
    if (updated) {
      setHistory(loadSavedUpdates());
      await syncLinkedFile(currentUpdateId);
    }
  }

  function reorderVisibleStories(sourceStories: StoryEntry[], orderedVisibleIds: string[]): StoryEntry[] {
    const byId = new Map(sourceStories.map((story) => [story.id, story]));
    const visibleIds = new Set(orderedVisibleIds);
    const queue = orderedVisibleIds
      .map((id) => byId.get(id))
      .filter((story): story is StoryEntry => Boolean(story));

    return sourceStories.map((story) => {
      if (!visibleIds.has(story.id)) return story;
      return queue.shift() ?? story;
    });
  }

  function handleStoryDropAtIndex(targetIndex: number) {
    const activeDraggingStoryId = draggingStoryIdRef.current ?? draggingStoryId;
    if (!activeDraggingStoryId) {
      setDraggingStoryId(null);
      setDropIndex(null);
      return;
    }

    const orderedVisibleIds = visibleStories.map((story) => story.id);
    const fromIndex = orderedVisibleIds.indexOf(activeDraggingStoryId);
    if (fromIndex < 0 || targetIndex === fromIndex || targetIndex === fromIndex + 1) {
      setDraggingStoryId(null);
      setDropIndex(null);
      draggingStoryIdRef.current = null;
      return;
    }
    const adjustedTargetIndex = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
    if (adjustedTargetIndex === fromIndex) {
      setDraggingStoryId(null);
      setDropIndex(null);
      draggingStoryIdRef.current = null;
      return;
    }

    const [movedId] = orderedVisibleIds.splice(fromIndex, 1);
    orderedVisibleIds.splice(Math.max(0, Math.min(adjustedTargetIndex, orderedVisibleIds.length)), 0, movedId);

    captureTaskLayout();
    setStories((prev) => {
      const next = reorderVisibleStories(prev, orderedVisibleIds).map((story) => (
        story.id === activeDraggingStoryId ? { ...story, updatedAt: new Date().toISOString() } : story
      ));
      void persistStoryOrder(next);
      return next;
    });
    const nextSettings = { ...taskListSettings, sortBy: 'custom' as const };
    setTaskListSettings(nextSettings);
    saveTaskListSettings(nextSettings);
    setDraggingStoryId(null);
    setDropIndex(null);
    draggingStoryIdRef.current = null;
  }

  const handleRemove = useCallback((id: string) => {
    setStories((prev) => prev.filter((s) => s.id !== id));
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveCollapsedTaskIds(next);
      return next;
    });
  }, []);

  const addStory = () => {
    setStories((prev) => [...prev, makeEmptyStory(nextSequenceNumber(prev))]);
  };

  function handleCarryOverStories(sourceUpdate: SavedUpdate, selectedStories: StoryEntry[]) {
    setStories((prev) => {
      const existingLineages = new Set(prev.map(taskLineageKey));
      const copies: StoryEntry[] = [];
      let sequenceNumber = nextSequenceNumber(prev);

      for (const story of selectedStories) {
        const lineageKey = taskLineageKey(story);
        if (existingLineages.has(lineageKey)) continue;
        existingLineages.add(lineageKey);
        copies.push(makeCarryOverStory(story, sourceUpdate, sequenceNumber));
        sequenceNumber++;
      }

      if (copies.length === 0) return prev;
      if (prev.length === 1 && !hasTaskContent(prev[0])) return copies;
      return [...prev, ...copies];
    });
  }

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
    setSaveNewToFile(false);
    setSaveNamePrompt(true);
  }

  async function confirmSaveAsNew() {
    if (savingNew) return;
    setSavingNew(true);
    try {
      const saved = saveAsNew(saveName, stories);
      if (saveNewToFile) {
        const result = await exportSingleUpdate(saved.id);
        if (result?.handle) {
          await storeFileHandle(result.handle, result.entryIds);
          await refreshLinkedFileNames();
        }
      }
      setHistory(loadSavedUpdates());
      setCurrentUpdateId(saved.id);
      setSaveName(saved.name);
      setSaveNamePrompt(false);
      if (afterSaveRef.current) {
        const fn = afterSaveRef.current;
        afterSaveRef.current = null;
        fn();
      }
    } finally {
      setSavingNew(false);
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
  async function handleExport() {
    const result = await exportUpdates();
    if (result.handle && result.entryIds.length > 0) {
      await storeFileHandle(result.handle, result.entryIds);
      await refreshLinkedFileNames();
    }
  }

  async function handleExportEntry(id: string) {
    const result = await exportSingleUpdate(id);
    if (result?.handle && result.entryIds.length > 0) {
      await storeFileHandle(result.handle, result.entryIds);
      await refreshLinkedFileNames();
    }
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
    setCollapsedIds(new Set());
    saveCollapsedTaskIds(new Set());
  }

  const isEditing = currentUpdateId !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 px-3 pt-6 pb-24 sm:px-4 sm:pt-10 sm:pb-28 lg:py-10">
      <NavPanel />
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
              <p className="text-sm text-gray-500 mb-4">
                Give this update a name. Trackwise saves it in this browser; you can also link it to a JSON file.
              </p>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Name</label>
              <input
                autoFocus
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !savingNew && confirmSaveAsNew()}
                placeholder="e.g. Sprint 42 – Day 3"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {isFileSystemSaveSupported() ? (
                <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 mb-5 cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={saveNewToFile}
                    onChange={(e) => setSaveNewToFile(e.target.checked)}
                    className="mt-0.5 rounded accent-indigo-600 w-4 h-4 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-700">Save and link a JSON file</span>
                    <span className="block text-xs text-gray-400 mt-0.5">
                      Choose a file location now so future saves sync back to that file.
                    </span>
                  </span>
                </label>
              ) : (
                <p className="text-xs text-gray-400 mb-5">
                  File linking is not available in this browser. The update will be saved locally in this browser.
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setSaveNamePrompt(false)}
                  disabled={savingNew}
                  className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSaveAsNew}
                  disabled={savingNew}
                  className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingNew ? 'Saving...' : 'Save'}
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
        <div id="section-history">
        <HistoryPanel
          history={history}
          onLoad={handleLoad}
          onLoadSnapshot={handleLoadSnapshot}
          onDelete={requestDelete}
          onRename={handleRename}
          onExportEntry={handleExportEntry}
          onExport={handleExport}
          onImport={openImport}
          onCarryOverStories={handleCarryOverStories}
          currentUpdateId={currentUpdateId}
          linkedFileNames={linkedFileNames}
        />
        </div>

        {/* Current update badge */}
        <div id="section-tasks">
        {isEditing && (
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="text-xs text-gray-500">Editing:</span>
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full truncate max-w-xs">
              {saveName || 'Unnamed Update'}
            </span>
          </div>
        )}

        {/* Story cards */}
        <div className="mb-3 px-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {visibleStories.length} of {stories.length} {stories.length === 1 ? 'Item' : 'Items'} shown
              </span>
              {filteredOutCount > 0 && (
                <span className="text-xs text-gray-400">
                  {filteredOutCount} filtered out
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Sort tasks</span>
                <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <select
                  value={taskListSettings.sortBy === 'custom' ? '' : taskListSettings.sortBy}
                  onChange={(e) => handleSortChange(e.target.value as TaskListSortKey)}
                  className="h-9 rounded-lg border border-gray-200 bg-white pl-8 pr-8 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 appearance-none cursor-pointer"
                >
                  <option value="" disabled hidden>Sort Tasks</option>
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>Sort: {opt.label}</option>
                  ))}
                </select>
              </label>
              {taskListSettings.sortBy === 'custom' && (
                <span className="flex h-9 items-center rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700">
                  Custom order
                </span>
              )}
              <details
                ref={settingsMenuRef}
                open={settingsMenuOpen}
                onToggle={(e) => setSettingsMenuOpen(e.currentTarget.open)}
                className="relative"
              >
                <summary
                  className="flex h-9 cursor-pointer list-none items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-indigo-600 [&::-webkit-details-marker]:hidden"
                  title="Task list settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="sr-only">Task list settings</span>
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Display</span>
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <span className="text-xs font-semibold text-gray-600">Show task dates</span>
                      <input
                        type="checkbox"
                        checked={taskListSettings.showTaskDates}
                        onChange={(e) => handleTaskListSettingsChange({ ...taskListSettings, showTaskDates: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-gray-300 accent-indigo-600"
                      />
                    </label>
                  </div>
                </div>
              </details>
              <details
                ref={filterMenuRef}
                open={filterMenuOpen}
                onToggle={(e) => setFilterMenuOpen(e.currentTarget.open)}
                className="relative"
              >
                <summary className={`flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors [&::-webkit-details-marker]:hidden
                  ${filterActive
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filters
                  {filterActive && <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-indigo-600">On</span>}
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">State</span>
                      <select
                        value={taskListSettings.filterStatus}
                        onChange={(e) => handleTaskListSettingsChange({ ...taskListSettings, filterStatus: e.target.value as TaskListSettings['filterStatus'] })}
                        className="h-9 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      >
                        {FILTER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Priority</span>
                      <select
                        value={taskListSettings.filterPriority}
                        onChange={(e) => handleTaskListSettingsChange({ ...taskListSettings, filterPriority: e.target.value as TaskListSettings['filterPriority'] })}
                        className="h-9 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      >
                        {PRIORITY_FILTER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Date</span>
                      <select
                        value={taskListSettings.filterDate}
                        onChange={(e) => handleTaskListSettingsChange({ ...taskListSettings, filterDate: e.target.value as TaskListSettings['filterDate'] })}
                        className="h-9 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      >
                        {DATE_FILTER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </details>
              {filterActive && (
                <button
                  onClick={() => handleTaskListSettingsChange({ ...taskListSettings, filterStatus: 'all', filterPriority: 'all', filterDate: 'all' })}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
          {visibleStories.length > 1 && (
            <button
              onClick={toggleAll}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              {allCollapsed ? 'Expand All' : 'Collapse All'}
            </button>
          )}
        </div>
        <div className="flex flex-col mb-5">
          {visibleStories.map((story, idx) => (
            <div
              key={story.id}
              ref={(node) => {
                if (node) taskItemRefs.current.set(story.id, node);
                else taskItemRefs.current.delete(story.id);
              }}
            >
              <DropSlot
                active={draggingStoryId !== null && dropIndex === idx && isValidDropIndex(idx)}
                onDragOver={() => setActiveDropIndex(idx)}
                onDrop={() => handleStoryDropAtIndex(idx)}
              />
              <div className={idx < visibleStories.length - 1 ? 'mb-3' : ''}>
                <StoryCard
                  story={story}
                  index={idx}
                  total={stories.length}
                  collapsed={collapsedIds.has(story.id)}
                  onToggleCollapse={toggleCard}
                  errors={errors[story.id] ?? {}}
                  onChange={handleChange}
                  onRemove={handleRemove}
                  lineage={getTaskLineage(story)}
                  showDates={taskListSettings.showTaskDates}
                  draggable
                  dragging={draggingStoryId === story.id}
                  onDragStart={(id) => {
                    setDraggingStoryId(id);
                    draggingStoryIdRef.current = id;
                    setDropIndex(null);
                  }}
                  onDragEnd={() => {
                    setDraggingStoryId(null);
                    setDropIndex(null);
                    draggingStoryIdRef.current = null;
                  }}
                  onDragOverTarget={() => setActiveDropIndex(idx)}
                  onDrop={() => handleStoryDropAtIndex(idx)}
                />
              </div>
            </div>
          ))}
          {visibleStories.length > 0 && (
            <DropSlot
              active={draggingStoryId !== null && dropIndex === visibleStories.length && isValidDropIndex(visibleStories.length)}
              onDragOver={() => setActiveDropIndex(visibleStories.length)}
              onDrop={() => handleStoryDropAtIndex(visibleStories.length)}
            />
          )}
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
        </div>{/* end section-tasks */}
        <div id="section-output">
        <OutputSettingsPanel
          settings={outputSettings}
          onChange={handleOutputSettingsChange}
          filteredCount={outputShownCount}
          totalCount={outputCountableStories.length}
        />
        <OutputPanel htmlOutput={htmlOutput} />
        </div>{/* end section-output */}

        <p className="text-center text-xs text-gray-400 mt-6">Saved updates are stored locally in your browser unless linked to a JSON file.</p>
      </div>
    </div>
  );
}

export default App;
