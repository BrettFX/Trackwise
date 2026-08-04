import { useState, useEffect } from 'react';
import { FolderOpen, LayoutList, FileOutput } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'section-history', label: 'Saved Updates', icon: <FolderOpen className="w-4 h-4" /> },
  { id: 'section-tasks',   label: 'Tasks',         icon: <LayoutList className="w-4 h-4" /> },
  { id: 'section-output',  label: 'Output',        icon: <FileOutput className="w-4 h-4" /> },
];

export default function NavPanel() {
  const [activeId, setActiveId] = useState(NAV_ITEMS[0].id);

  useEffect(() => {
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
    <nav aria-label="Page sections" className="border-t border-gray-100">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 flex">
        {NAV_ITEMS.map((item) => {
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              title={item.label}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors
                after:absolute after:bottom-0 after:inset-x-2 after:h-0.5 after:rounded-full after:transition-all
                ${active
                  ? 'text-indigo-600 after:bg-indigo-600'
                  : 'text-gray-500 hover:text-gray-800 after:bg-transparent'
                }`}
            >
              {item.icon}
              <span className="hidden xs:inline sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
