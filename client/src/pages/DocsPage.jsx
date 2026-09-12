import React from 'react';

// The build record is a complete, standalone HTML document with its own styles,
// served from public/docs/index.html. Framing it keeps the clean /docs URL:
// the SPA fallback answers /docs before any static file would, so linking
// straight at the file would mean showing /docs/index.html in the address bar.
export default function DocsPage() {
  return (
    <iframe
      src="/docs/index.html"
      title="Minimal build record"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0 }}
    />
  );
}
