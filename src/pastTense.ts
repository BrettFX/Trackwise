import nlp from 'compromise';
import { isFuzzyDuplicate, isPrefixContainment, tokenizeWords } from './fuzzyMatch';

const CONTRACTION_MAP: Record<string, string> = {
  "what's":  'what was',
  "that's":  'that was',
  "it's":    'it was',
  "there's": 'there was',
  "here's":  'here was',
  "who's":   'who was',
  "isn't":   'was not',
  "aren't":  'were not',
  "I'm":     'I was',
  "we're":   'we were',
  "they're": 'they were',
  "you're":  'you were',
};

// Words that, when following "and/but/or", indicate a noun phrase rather than a verb clause.
const STOP_WORDS = new Set([
  'a','an','the','this','that','these','those',
  'its','their','his','her','our','your','my',
  'by','in','on','at','for','of','to','from','with','without',
  'both','all','some','any','no','not','so','yet','nor',
  'either','neither','only','just','even','also','too',
  'very','more','most','such',
]);

// Tech/domain nouns that look like verbs to compromise but shouldn't be converted
// when they appear as clause openers after "and/but/or".
const DOMAIN_NOUNS = new Set([
  'prod', 'dev', 'staging', 'qa', 'uat', 'sit',
  'main', 'master', 'trunk', 'head',
  'api', 'ui', 'ux', 'db', 'ci', 'cd',
  'frontend', 'backend', 'fullstack',
  'local', 'remote', 'repo', 'pr', 'mr', 'branch',
  'none', 'n/a', 'na', 'tbd', 'wip',
]);

function expandContractions(text: string): string {
  let out = text;
  for (const [contr, expansion] of Object.entries(CONTRACTION_MAP)) {
    const escaped = contr.replace("'", "[''']");
    out = out.replace(new RegExp(escaped, 'gi'), expansion);
  }
  return out;
}

// Abbreviations whose internal periods should never be treated as sentence
// boundaries (e.g. "e.g." or "etc." mid-sentence).
const ABBREVIATIONS = ['e.g.', 'i.e.', 'etc.', 'vs.', 'approx.', 'no.', 'jr.', 'sr.', 'mr.', 'mrs.', 'ms.', 'dr.', 'inc.', 'ltd.'];
const PERIOD_PLACEHOLDER = '\u0000';

function protectAbbreviations(text: string): string {
  let out = text;
  for (const abbr of ABBREVIATIONS) {
    const escaped = abbr.replace(/\./g, '\\.');
    out = out.replace(new RegExp(escaped, 'gi'), (m) => m.replace(/\./g, PERIOD_PLACEHOLDER));
  }
  return out;
}

// Splits text into individual sentences without breaking on abbreviation periods.
function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const protectedText = protectAbbreviations(trimmed);
  const parts = protectedText.match(/[^.!?]+[.!?]*/g) ?? [protectedText];
  return parts
    .map((s) => s.replace(new RegExp(PERIOD_PLACEHOLDER, 'g'), '.').trim())
    .filter(Boolean);
}

// Converts a single verb (or short phrasal verb) to past tense via compromise.
// Wraps in "I <verb>" to give compromise a subject for reliable conjugation.
function verbToPast(verb: string): string {
  const doc = nlp('I ' + verb.toLowerCase());
  doc.verbs().toPastTense();
  return doc.text().replace(/^I /, '');
}

// Converts the opening verb phrase of a clause to past tense.
// Only touches the first word (+optional particle like "into", "up", "out").
function convertClauseOpener(clause: string): string {
  const trimmed = clause.trim();
  if (!trimmed) return trimmed;

  const PARTICLES = 'into|out|up|down|on|off|in|away|over|through|around|back|forward|along|about|across|after|against|by|for|from|with|without';
  const m = trimmed.match(new RegExp(`^([A-Za-z]+)((?:\\s+(?:${PARTICLES}))?)`));
  if (!m) return trimmed;

  const firstWord = m[1];
  const particle  = m[2] ?? '';

  // Use compromise to verify the first word is a verb in this context.
  // Also skip known domain nouns that compromise misidentifies as verbs.
  if (DOMAIN_NOUNS.has(firstWord.toLowerCase())) return trimmed;
  const probe = nlp('I ' + firstWord.toLowerCase() + ' it');
  if (probe.verbs().length === 0) return trimmed;

  const verbPhrase = firstWord + particle;
  const converted  = verbToPast(verbPhrase);

  return converted.charAt(0).toUpperCase() + converted.slice(1) + trimmed.slice(verbPhrase.length);
}

/**
 * Converts a present-tense task status update to past tense.
 * Handles sentence-opening imperatives, coordinated verb clauses,
 * and common present-tense contractions.
 */
export function convertToPastTense(text: string): string {
  let processed = expandContractions(text);

  const sentences = splitSentences(processed);

  return sentences.map((sentence) => {
    const trimmed = sentence.trim();
    if (!trimmed) return '';

    // Split on "and/but/or" only when the word that follows is not a stop word
    // (heuristic: stop words signal a noun phrase, not a new verb clause).
    const clauseRegex = /( (?:and|but|or) )([a-z])/g;
    const parts: string[]  = [];
    const conjs: string[]  = [];
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = clauseRegex.exec(trimmed)) !== null) {
      const afterConj = trimmed.slice(match.index + match[1].length);
      const nextWord  = afterConj.match(/^([a-z]+)/)?.[1] ?? '';
      if (!STOP_WORDS.has(nextWord) && !DOMAIN_NOUNS.has(nextWord)) {
        parts.push(trimmed.slice(last, match.index));
        conjs.push(match[1].trim());
        last = match.index + match[1].length;
      }
    }
    parts.push(trimmed.slice(last));

    const converted = parts.map((part, i) => {
      const out = convertClauseOpener(part);
      return i === 0 ? out : out.charAt(0).toLowerCase() + out.slice(1);
    });

    return converted.reduce((acc, part, i) =>
      i === 0 ? part : `${acc} ${conjs[i - 1]} ${part}`, '');
  }).join(' ');
}

// Strip trailing punctuation for reliable key comparison.
function normalizeKey(text: string): string {
  return text.trim().toLowerCase().replace(/[.!?,;]+$/, '');
}

const BARE_NONE_RE = /^(none|nothing|nil|n\/a|na|-{1,3}|n\.a\.)$/;
const NONE_WITH_STATUS_RE = /^(?:none|nothing|nil|n\/a|na|-+)\s*\(([^)]+)\)/;

// True for placeholder values with no actionable content — bare ("none") or
// status-qualified ("none (Done)"). Shared so "next step" selection never
// surfaces a placeholder verbatim (e.g. "Next steps are to none (Done)").
function isPlaceholderKey(key: string): boolean {
  return BARE_NONE_RE.test(key) || NONE_WITH_STATUS_RE.test(key);
}

// Classifies and processes a single sentence.
// Returns the past-tense sentence to include in the summary, or null to skip.
// `isComplete` controls whether a "none (Done)" placeholder is rendered as a
// closing sentence — for an in-progress task it's just noise and is dropped.
function processSentence(sentence: string, isComplete: boolean): string | null {
  const key = normalizeKey(sentence);
  if (!key) return null;

  // "None/nothing/nil/N/A/— (Status)" pattern — detect the status in the parens.
  const noneWithStatus = key.match(NONE_WITH_STATUS_RE);
  if (noneWithStatus) {
    const status = noneWithStatus[1].replace(/[\s_-]+/g, ' ').trim();
    if (isComplete && /^(done|complet\w*|finish\w*|resolv\w*)$/.test(status)) {
      return 'Completed work for this task';
    }
    return null; // skip in-progress / blocked / not-started status-only entries
  }

  // Bare empty indicators with no status context.
  if (BARE_NONE_RE.test(key)) return null;

  // Normal update text — convert to past tense.
  return convertToPastTense(sentence.trim());
}

function buildIntroParagraph(sentences: string[]): string {
  if (sentences.length < 2) return sentences[0] ?? '';

  // Strip trailing periods before joining so punctuation doesn't double up.
  const parts = sentences.map((s, i) => {
    const stripped = s.replace(/\.$/, '').trim();
    return i === 0 ? stripped : stripped.charAt(0).toLowerCase() + stripped.slice(1);
  });

  // With many entries, a comma-joined list becomes unwieldy — use semicolons instead.
  if (parts.length > 4) {
    return `${parts.join('; ')}.`;
  }

  const body =
    parts.length === 2
      ? `${parts[0]} and ${parts[1]}`
      : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;

  return `${body.charAt(0).toUpperCase() + body.slice(1)}.`;
}

function formatNextStep(text: string): string {
  const stripped = text.trim().replace(/[.!?]+$/, '');
  const lower = stripped.charAt(0).toLowerCase() + stripped.slice(1);
  return `Next steps are to ${lower}.`;
}

/**
 * Builds a consolidated past-tense summary from lineage entries.
 * Both "yesterday" and "today" fields are included; entries are sorted
 * oldest-first, split into individual sentences, and deduplicated so that
 * repeated or reworded restatements of the same update collapse into one.
 * A sentence that's fully restated at the start of a later, longer sentence
 * (e.g. someone kept re-typing the same opening clause before appending new
 * work each checkpoint) is dropped in favor of the longer version.
 * Placeholder values ("None", "None (Done)" → smart replacement, etc.) are
 * handled by processSentence().
 *
 * When isComplete is false, the most recent non-placeholder today entry is
 * excluded from past-tense conversion and appended as "Next steps are to …"
 */
export function buildLineageSummary(
  todayEntries: { savedAt: string; yesterday: string; today: string }[],
  isComplete = true,
): string {
  const sorted = [...todayEntries].sort(
    (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime(),
  );

  // Identify the last entry with a real today value (for next-steps handling).
  // A truly blank value is skipped over (the field may just be unfilled), but an
  // explicit placeholder ("none", "none (Done)") means there is no next step —
  // search stops there rather than resurrecting older, already-completed text.
  let nextStepText: string | null = null;
  let nextStepIdx = -1;
  if (!isComplete) {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const raw = sorted[i].today.trim();
      const key = normalizeKey(raw);
      if (!key) continue;
      if (isPlaceholderKey(key)) break;
      nextStepText = raw;
      nextStepIdx = i;
      break;
    }
  }

  // Build the full pool of candidate sentences in chronological order. The
  // next-step entry's "today" sentences are still tracked (so later restatements
  // of it are recognized as redundant) but flagged out of the final output.
  const candidates = sorted.flatMap((e, idx) => [
    ...splitSentences(e.yesterday).map((raw) => ({ raw, excluded: false })),
    ...splitSentences(e.today).map((raw) => ({ raw, excluded: !isComplete && idx === nextStepIdx })),
  ]);

  // Dedup pass: drop exact/fuzzy repeats, and collapse prefix-containment pairs
  // (an older, shorter sentence that's fully restated at the start of a newer,
  // longer one) down to just the longer, more complete version.
  const kept: { raw: string; excluded: boolean }[] = [];
  for (const candidate of candidates) {
    const key = normalizeKey(candidate.raw);
    if (!key) continue;
    const tokens = tokenizeWords(key);

    let redundant = false;
    for (let i = kept.length - 1; i >= 0; i--) {
      const existingKey = normalizeKey(kept[i].raw);
      if (isFuzzyDuplicate(existingKey, key)) { redundant = true; break; }
      const existingTokens = tokenizeWords(existingKey);
      if (isPrefixContainment(existingTokens, tokens)) { kept.splice(i, 1); continue; }
      if (isPrefixContainment(tokens, existingTokens)) { redundant = true; break; }
    }
    if (!redundant) kept.push(candidate);
  }

  const sentences = kept
    .filter((c) => !c.excluded)
    .map((c) => processSentence(c.raw, isComplete))
    .filter((s): s is string => Boolean(s));

  const summary = buildIntroParagraph(sentences);

  if (!isComplete && nextStepText) {
    const nextStep = formatNextStep(nextStepText);
    return summary ? `${summary} ${nextStep}` : nextStep;
  }

  return summary;
}
