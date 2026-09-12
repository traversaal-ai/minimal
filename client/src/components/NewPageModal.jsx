import React, { useState } from 'react';

// `showSection` is only passed true for a root-level "New page" — a
// sub-page inherits its place in the tree from its parent, so it has no
// section field of its own (see docs/decisions.md). `templates` (page
// objects whose section is "Templates") and `onUseTemplate` are also
// root-page-only — picking one skips the blank-page flow entirely.
export default function NewPageModal({
  onCreate,
  onClose,
  heading = 'New page',
  showSection = false,
  existingSections = [],
  templates = [],
  onUseTemplate,
}) {
  const [title, setTitle] = useState('');
  const [section, setSection] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setSubmitting(true);
    try {
      await onCreate(title.trim(), showSection ? section.trim() || null : undefined);
    } catch (err) {
      setError(err?.message || 'Could not create page.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center bg-black/30 pt-24">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{heading}</h2>
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            data-testid="page-title-input"
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Page title"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {showSection && (
            <div>
              <input
                data-testid="page-section-input"
                list="section-suggestions"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="Section (optional) — e.g. Projects & Roadmap"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <datalist id="section-suggestions">
                {existingSections.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-gray-400">
                Groups this page into a collapsible section on the home dashboard. Type a new name to
                start one, or leave blank.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create page'}
          </button>
        </form>

        {templates.length > 0 && onUseTemplate && (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="mb-2 text-xs font-medium text-gray-500">Or start from a template</p>
            <div className="space-y-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  data-testid="use-template-button"
                  onClick={() => onUseTemplate(t.id, t.title)}
                  className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-accent hover:text-accent"
                >
                  {t.icon && <span>{t.icon}</span>}
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
