import { useState, useCallback } from 'react';
import { Plus, Zap, Save, RefreshCw } from 'lucide-react';
import StoryCard from './components/StoryCard';
import OutputPanel from './components/OutputPanel';
import HistoryPanel from './components/HistoryPanel';
import type { StoryEntry, SavedUpdate } from './types';
import { makeEmptyStory, formatOutputHTML, loadSavedUpdates, saveUpdate, deleteUpdate } from './utils';

function App() {
  const [stories, setStories] = useState<StoryEntry[]>([makeEmptyStory()]);
  const [htmlOutput, setHtmlOutput] = useState('');
  const [errors, setErrors] = useState<Record<string, Partial<Record<keyof StoryEntry, string>>>>({});
  const [history, setHistory] = useState<SavedUpdate[]>(() => loadSavedUpdates());
  const [currentUpdateId, setCurrentUpdateId] = useState<string | null>(null);
  const [saveNamePrompt, setSaveNamePrompt] = useState(false);
  const [saveName, setSaveName] = useState('');

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
  }, []);

  const addStory = () => setStories((prev) => [...prev, makeEmptyStory()]);

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
    setHtmlOutput(formatOutputHTML(stories));
  }

  function openSavePrompt() {
    if (!validate()) return;
    setSaveName(saveName || (stories[0]?.title ? `${stories[0].title} – ${new Date().toLocaleDateString()}` : ''));
    setSaveNamePrompt(true);
  }

  function confirmSave() {
    const name = saveName.trim() || `Update – ${new Date().toLocaleString()}`;
    const id = currentUpdateId ?? crypto.randomUUID();
    const update: SavedUpdate = { id, name, createdAt: new Date().toISOString(), stories };
    saveUpdate(update);
    setHistory(loadSavedUpdates());
    setCurrentUpdateId(id);
    setSaveNamePrompt(false);
    setSaveName('');
  }

  function handleLoad(update: SavedUpdate) {
    setStories(update.stories.map((s) => ({ ...s })));
    setCurrentUpdateId(update.id);
    setSaveName(update.name);
    setHtmlOutput('');
    setErrors({});
  }

  function handleDelete(id: string) {
    deleteUpdate(id);
    setHistory(loadSavedUpdates());
    if (currentUpdateId === id) { setCurrentUpdateId(null); setSaveName(''); }
  }

  function handleClear() {
    if (!confirm('Clear all stories and start fresh?')) return;
    setStories([makeEmptyStory()]);
    setHtmlOutput('');
    setErrors({});
    setCurrentUpdateId(null);
    setSaveName('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
            <Zap className="w-3.5 h-3.5" /> YTB Status Formatter
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Daily Status Update</h1>
          <p className="text-gray-500 mt-1 text-sm">Fill in your stories and generate a Teams-ready YTB update.</p>
        </div>

        {saveNamePrompt && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Save Update</h2>
              <p className="text-sm text-gray-500 mb-4">Give this update a name so you can load it later.</p>
              <input
                autoFocus
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
                placeholder="e.g. Sprint 42 – Day 3"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setSaveNamePrompt(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={confirmSave} className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        <HistoryPanel history={history} onLoad={handleLoad} onDelete={handleDelete} />

        <div className="flex flex-col gap-5 mb-5">
          {stories.map((story, idx) => (
            <StoryCard
              key={story.id}
              story={story}
              index={idx}
              total={stories.length}
              errors={errors[story.id] ?? {}}
              onChange={handleChange}
              onRemove={handleRemove}
            />
          ))}
        </div>

        <button
          onClick={addStory}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-500 text-sm font-semibold hover:border-indigo-400 hover:bg-indigo-50 transition-colors mb-6"
        >
          <Plus className="w-4 h-4" /> Add Story
        </button>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Zap className="w-4 h-4" /> Generate Output
          </button>
          <button
            onClick={openSavePrompt}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            {currentUpdateId ? 'Update Saved' : 'Save Update'}
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-500 text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm ml-auto"
          >
            <RefreshCw className="w-4 h-4" /> Clear
          </button>
        </div>

        <OutputPanel htmlOutput={htmlOutput} />

        <p className="text-center text-xs text-gray-400 mt-6">Saved updates are stored locally in your browser.</p>
      </div>
    </div>
  );
}

export default App;
