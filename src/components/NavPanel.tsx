import { useState, useEffect } from 'react';
import { FolderOpen, LayoutList, FileOutput } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'section-history', label: 'Saved Updates', icon: <FolderOpen  className="w-4 h-4" /> },
  { id: 'section-tasks', label: 'Tasks',  icon: <LayoutList className="w-4 h-4" /> },
  { id: 'section-output',  label: 'Output',   icon: <FileOutput className="w-4 h-4" /> },
];

export default function NavPanel() {
  const [activeId, setActiveId] = useState(NAV_ITEMS[0].id);

  useEffect(() => {
    // Track intersection ratio per section; the section with the highest visible
    // area wins and becomes the active nav item.
    const ratios: Record<string, number> = Object.fromEntries(NAV_ITEMS.map((n) => [n.id, 0]));

    function pickActive() {
      let best = NAV_ITEMS[0].id;
      let bestRatio = -1;
      for (const [id, ratio] of Object.entries(ratios)) {
        if (ratio > bestRatio) { bestRatio = ratio; best = id; }
      }
      setActiveId(best);
    }

    const observers: IntersectionObserver[] = [];
    const thresholds = Array.from({ length: 21 }, (_, i) => i * 0.05);

    for (const item of NAV_ITEMS) {
      const el = document.getElementById(item.id);
      if (!el) continue;
      const obs = new IntersectionObserver(
        (entries) => {
          for (const e of entries) ratios[item.id] = e.intersectionRatio;
          pickActive();
        },
        { threshold: thresholds },
      );
      obs.observe(el);
      observers.push(obs);
    }

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav
      aria-label="Page sections"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-lg shadow-slate-200/70 backdrop-blur-sm lg:inset-x-auto lg:left-4 lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2 lg:flex-col lg:items-stretch lg:justify-start lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
    >
      {NAV_ITEMS.map((item) => {
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            title={item.label}
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border lg:min-h-0 lg:flex-none lg:justify-start
              ${active
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                : 'bg-white/90 backdrop-blur-sm text-gray-500 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm'
              }`}
          >
            {item.icon}
            <span className="sr-only sm:not-sr-only lg:sr-only xl:not-sr-only">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
