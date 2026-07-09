import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface OutputPanelProps {
  htmlOutput: string;
}

export default function OutputPanel({ htmlOutput }: OutputPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!htmlOutput.trim()) return;
    const plainText = htmlOutput
      .replace(/<hr\s*\/?>/gi, '\n---\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    try {
      const htmlBlob = new Blob([htmlOutput], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
    } catch {
      // Fallback: plain text copy via a hidden element
      const ta = document.createElement('textarea');
      ta.value = plainText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasOutput = htmlOutput.trim().length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Preview</span>
          {/* {hasOutput && (
            <span className="text-xs text-gray-400"></span>
          )} */}
        </div>
        <button
          onClick={handleCopy}
          disabled={!hasOutput}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all
            ${hasOutput
              ? copied
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="p-5">
        {hasOutput ? (
          <div
            className="prose prose-sm max-w-none rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-800 leading-relaxed break-words
              [&_p]:my-1 [&_hr]:my-4 [&_hr]:border-gray-300 [&_b]:font-semibold [&_a]:text-indigo-600 [&_a:hover]:text-indigo-800 [&_a]:break-words"
            dangerouslySetInnerHTML={{ __html: htmlOutput }}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm text-gray-400">
            Your formatted status update will appear here after clicking Generate.
          </div>
        )}
      </div>
    </div>
  );
}
