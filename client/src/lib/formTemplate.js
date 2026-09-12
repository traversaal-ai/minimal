// A 'form' block's entire structure lives as JSON text in the block's
// `content` field — the server never parses it (see docs/decisions.md). This
// file is the only place that shape is defined, and the only place that
// parses/serializes it, so FormBlock and AddBlockControl agree on it.

export const FIELD_TYPES = [
  { value: 'text', label: 'Short answer' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone number' },
  { value: 'url', label: 'Link' },
  { value: 'textarea', label: 'Long answer' },
  { value: 'file', label: 'File upload' },
];

// Literal, complete class strings — Tailwind's JIT scans the source file for
// these exact strings, so they must never be built by concatenation.
export const COVER_GRADIENTS = [
  'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400',
  'bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400',
  'bg-gradient-to-r from-rose-500 via-red-500 to-orange-500',
  'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500',
  'bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500',
];

let fieldCounter = 0;
function fieldId() {
  fieldCounter += 1;
  return `f${Date.now()}${fieldCounter}`;
}

export function createDefaultForm() {
  return {
    icon: '📝',
    cover: { type: 'gradient', value: COVER_GRADIENTS[0] },
    title: 'Untitled form',
    description: 'Tell people what this form is for.',
    isPublic: true,
    fields: [
      { id: fieldId(), label: 'Full name', type: 'text', required: true },
      { id: fieldId(), label: 'Email', type: 'email', required: true },
    ],
  };
}

export function newField() {
  return { id: fieldId(), label: 'Question', type: 'text', required: false };
}

export function parseForm(content) {
  if (!content) return createDefaultForm();
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.fields)) {
      return createDefaultForm();
    }
    return parsed;
  } catch (err) {
    return createDefaultForm();
  }
}

export function serializeForm(form) {
  return JSON.stringify(form);
}
