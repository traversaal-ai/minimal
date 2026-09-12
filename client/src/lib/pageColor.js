// Deterministic accent colors for top-level pages — same idea as Notion's
// page icons: each root page gets a stable color derived from its id, purely
// client-side (no schema change) so the sidebar and dashboard don't read as
// one flat monochrome list.
// `hex` mirrors each Tailwind `dot` color's actual value — needed anywhere a
// Tailwind class can't be used (e.g. an SVG `fill` attribute, where a class
// built by string concatenation at runtime is invisible to Tailwind's static
// scanner and would never get its CSS generated).
const PALETTE = [
  { dot: 'bg-rose-400', text: 'text-rose-600', bg: 'bg-rose-50', ring: 'ring-rose-100', hex: '#fb7185' },
  { dot: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100', hex: '#fbbf24' },
  { dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100', hex: '#34d399' },
  { dot: 'bg-sky-400', text: 'text-sky-600', bg: 'bg-sky-50', ring: 'ring-sky-100', hex: '#38bdf8' },
  { dot: 'bg-violet-400', text: 'text-violet-600', bg: 'bg-violet-50', ring: 'ring-violet-100', hex: '#a78bfa' },
  { dot: 'bg-pink-400', text: 'text-pink-600', bg: 'bg-pink-50', ring: 'ring-pink-100', hex: '#f472b6' },
  { dot: 'bg-teal-400', text: 'text-teal-600', bg: 'bg-teal-50', ring: 'ring-teal-100', hex: '#2dd4bf' },
  { dot: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-100', hex: '#fb923c' },
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getPageColor(id) {
  if (!id) return PALETTE[0];
  return PALETTE[hash(id) % PALETTE.length];
}

// Status-cell coloring for tables — matched on the cell's own text, not the
// column name, so it works regardless of what the column is called.
const STATUS_STYLES = {
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'in progress': 'bg-amber-50 text-amber-700 ring-amber-200',
  'not started': 'bg-gray-100 text-gray-500 ring-gray-200',
  blocked: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export function getStatusStyle(value) {
  if (!value) return null;
  return STATUS_STYLES[value.trim().toLowerCase()] || null;
}
