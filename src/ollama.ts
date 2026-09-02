// Optional, opt-in abstractive rewrite of the (already deduped) extractive lineage
// summary via a locally-running Ollama instance. Desktop (Tauri) only — this never
// makes network calls in the browser dev build, and never talks to anything but the
// user's own machine (http://localhost:11434), so no data leaves the device.

const BASE_URL = 'http://localhost:11434';
export const DEFAULT_MODEL = 'qwen2.5:1.5b';
const MODEL_STORAGE_KEY = 'trackwise-ollama-model';

export interface OllamaStatus {
  available: boolean;
  models: string[];
}

export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function loadSelectedModel(): string {
  try {
    return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function saveSelectedModel(model: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, model.trim() || DEFAULT_MODEL);
  } catch {
    // localStorage unavailable — selection just won't persist across sessions.
  }
}

// Rough parameter count (in billions) parsed from an Ollama model tag, e.g.
// "llama3.2:3b" -> 3, "qwen3.5:latest" -> Infinity (unknown, assume large/slow).
function paramSizeOf(model: string): number {
  const match = model.match(/(\d+(?:\.\d+)?)\s*b(?:illion)?\b/i);
  return match ? parseFloat(match[1]) : Infinity;
}

// Model families preferred by default, in priority order — qwen has produced the
// most reliable rewrites in testing, so it's tried before falling back to raw size.
const PREFERRED_FAMILIES = ['qwen'];

/** Picks a sensible default installed model — prefers qwen, then the smallest (fastest) model. */
export function pickDefaultModel(models: string[]): string {
  if (models.length === 0) return DEFAULT_MODEL;
  if (models.includes(DEFAULT_MODEL)) return DEFAULT_MODEL;

  for (const family of PREFERRED_FAMILIES) {
    const matches = models.filter((m) => m.toLowerCase().includes(family));
    if (matches.length > 0) return matches.sort((a, b) => paramSizeOf(a) - paramSizeOf(b))[0];
  }

  return [...models].sort((a, b) => paramSizeOf(a) - paramSizeOf(b))[0];
}

async function fetchStatus(): Promise<OllamaStatus> {
  if (!isTauriApp()) return { available: false, models: [] };
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const res = await tauriFetch(`${BASE_URL}/api/tags`, { method: 'GET' });
    if (!res.ok) return { available: false, models: [] };
    const data = (await res.json()) as { models?: { name: string }[] };
    return { available: true, models: (data.models ?? []).map((m) => m.name) };
  } catch {
    return { available: false, models: [] };
  }
}

let statusPromise: Promise<OllamaStatus> | null = null;

/** Cached Ollama reachability/model-list check — avoids hitting the local server once per story card. */
export function getOllamaStatus(forceRefresh = false): Promise<OllamaStatus> {
  if (!statusPromise || forceRefresh) statusPromise = fetchStatus();
  return statusPromise;
}

const SYSTEM_PROMPT = `You are rewriting a software engineer's status-update log into a short, polished narrative for a status report.
Rules:
- Do not invent, assume, or add any fact, name, number, or claim that is not present in the input.
- Preserve exact technical details verbatim: ticket numbers, tool/service names, acronyms, error codes, and people's names.
- Do not add opinions, caveats, or next steps that are not already present in the input.
- The input may contain duplicate or near-duplicate entries describing the same update (e.g. the same work restated after only a status change). Mention each distinct point only once — do not repeat it just because it appears more than once in the input.
- Write in past tense, as 2-4 flowing sentences.
- Return only the rewritten paragraph — no preamble, labels, or quotation marks.`;

/** Sends the extractive summary to a local Ollama model for an abstractive rewrite pass. */
export async function generateAbstractiveSummary(extractiveSummary: string, model: string, signal?: AbortSignal): Promise<string> {
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
  const res = await tauriFetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      system: SYSTEM_PROMPT,
      prompt: extractiveSummary,
      stream: false,
      // Keep the model resident between calls (avoids a multi-second reload on
      // every click) and cap output length — a few sentences never needs more.
      keep_alive: '10m',
      // Reasoning models (e.g. qwen3.5, deepseek-r1) burn the whole token budget on
      // hidden "thinking" and return an empty response if this isn't disabled.
      think: false,
      options: { temperature: 0.2, num_predict: 220 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama request failed (HTTP ${res.status}). Is "${model}" pulled?`);
  const data = (await res.json()) as { response?: string };
  const text = (data.response ?? '').trim();
  if (!text) throw new Error('Ollama returned an empty response.');
  return text;
}
