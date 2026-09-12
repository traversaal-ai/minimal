import React, { useState } from 'react';
import { createDefaultForm, serializeForm } from '../lib/formTemplate.js';

const TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'heading', label: 'Heading' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'bulleted_list', label: 'Bulleted list' },
  { value: 'table', label: 'Table' },
  { value: 'form', label: 'Form (mock)' },
  { value: 'code', label: 'Code / diagram' },
];

// A table needs no starting text — it comes with its own default columns
// and a blank row — so choosing it creates the block immediately instead of
// prompting for content first. A form is the same idea: it comes with a
// default title, cover, and two starter fields, generated client-side since
// its whole structure lives as JSON in `content` (see lib/formTemplate.js).
// 'code' also skips the prompt — a single-line <input> can't accept the
// newlines a diagram needs, so it's created with placeholder text and edited
// afterward in the block's own multi-line textarea (see Block.jsx).
const NO_PROMPT_TYPES = ['table', 'form', 'code'];

function defaultContentFor(type) {
  if (type === 'form') return serializeForm(createDefaultForm());
  if (type === 'code') return 'Paste a diagram or code snippet here.';
  return '';
}

export default function AddBlockControl({ onCreate }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [type, setType] = useState(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setPickerOpen(false);
    setType(null);
    setContent('');
    setError('');
    setSubmitting(false);
  };

  const chooseType = async (t) => {
    setPickerOpen(false);
    if (NO_PROMPT_TYPES.includes(t)) {
      setSubmitting(true);
      try {
        await onCreate(t, defaultContentFor(t));
        reset();
      } catch (err) {
        setError(err?.message || 'Could not add block.');
        setSubmitting(false);
      }
      return;
    }
    setType(t);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Content is required.');
      return;
    }
    setSubmitting(true);
    try {
      await onCreate(type, content.trim());
      reset();
    } catch (err) {
      setError(err?.message || 'Could not add block.');
      setSubmitting(false);
    }
  };

  if (type) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          data-testid="block-text-input"
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`New ${type} block`}
          className="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
        >
          Add
        </button>
        <button type="button" onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">
          Cancel
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </form>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        data-testid="add-block-button"
        onClick={() => setPickerOpen((v) => !v)}
        className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-accent hover:text-accent"
      >
        + Add block
      </button>
      {pickerOpen && (
        <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {TYPES.map((t) => (
            <button
              key={t.value}
              data-testid={`add-block-type-${t.value}`}
              onClick={() => chooseType(t.value)}
              className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
