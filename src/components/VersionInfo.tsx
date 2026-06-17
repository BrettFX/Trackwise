import { useState, useEffect } from 'react';

interface VersionData {
  version: string;
  buildDate: string;
}

export default function VersionInfo() {
  const [data, setData] = useState<VersionData | null>(null);

  useEffect(() => {
    // import.meta.env.BASE_URL handles both dev ('/') and GitHub Pages ('/Trackwise/')
    fetch(`${import.meta.env.BASE_URL}version.json`)
      .then((r) => r.json())
      .then((d: VersionData) => setData(d))
      .catch(() => setData({ version: '1.0.0', buildDate: '—' }));
  }, []);

  if (!data) return null;

  return (
    <span className="text-gray-400 text-xs tabular-nums">
      {data.buildDate} v.{data.version}
    </span>
  );
}
