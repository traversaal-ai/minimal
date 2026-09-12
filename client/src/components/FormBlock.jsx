import React, { useEffect, useState } from 'react';
import * as api from '../api/client.js';
import { FIELD_TYPES, COVER_GRADIENTS, parseForm, serializeForm, newField } from '../lib/formTemplate.js';

// In preview mode the field is a real, controlled input feeding the
// in-flight response; in builder mode it's just a static mock of what a
// respondent would see, matching the reference screenshot's "Respondent's
// answer" placeholders.
function FieldPreviewInput({ field, value, onChange, editable }) {
  if (field.type === 'textarea') {
    return (
      <textarea
        disabled={!editable}
        value={editable ? value || '' : ''}
        onChange={(e) => onChange && onChange(e.target.value)}
        rows={2}
        placeholder="Respondent's answer"
        className="w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 disabled:text-gray-400"
      />
    );
  }
  if (field.type === 'file') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-400">
        <span className="rounded border border-gray-300 px-1.5 py-0.5 text-xs">Upload</span>
        <span>Size limit: 100 MB. File limit: 10.</span>
      </div>
    );
  }
  return (
    <input
      disabled={!editable}
      value={editable ? value || '' : ''}
      onChange={(e) => onChange && onChange(e.target.value)}
      type={field.type === 'email' ? 'email' : 'text'}
      placeholder="Respondent's answer"
      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 disabled:text-gray-400"
    />
  );
}

function ResponsesList({ blockId, fields }) {
  const [responses, setResponses] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getFormResponses(blockId).then((data) => {
      if (!cancelled) setResponses(data.responses || []);
    });
    return () => {
      cancelled = true;
    };
  }, [blockId]);

  if (responses === null) {
    return <p className="px-6 py-16 text-center text-sm text-gray-400">Loading…</p>;
  }

  if (responses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <span className="text-3xl">📭</span>
        <p className="text-sm font-medium text-gray-700">No responses yet</p>
        <p className="max-w-xs text-xs text-gray-400">
          Responses submitted through Preview show up here — real submissions, not a mock.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-96 divide-y divide-gray-100 overflow-y-auto px-6 py-4">
      {responses.map((r) => (
        <div key={r.id} className="py-3">
          <p className="mb-1 text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</p>
          <dl className="space-y-1">
            {fields.map((f) => (
              <div key={f.id} className="flex gap-2 text-sm">
                <dt className="w-40 flex-shrink-0 text-gray-400">{f.label}</dt>
                <dd className="text-gray-800">{r.data[f.id] || <span className="text-gray-300">—</span>}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

// Form builder: a cover, an icon, editable fields, a Preview mode, and a
// Share button. Building (structure) is mocked as JSON in the block's own
// content; Preview's Submit and the Responses tab are real, wired to
// server-side response storage — see docs/decisions.md for exactly which
// half is real.
export default function FormBlock({ block, onChange, onDelete, locked }) {
  const [form, setForm] = useState(() => parseForm(block.content));
  const [tab, setTab] = useState('builder'); // 'builder' | 'responses'
  const [previewing, setPreviewing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [responseDraft, setResponseDraft] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const persist = async (next) => {
    setForm(next);
    try {
      const updated = await api.updateBlock(block.id, { content: serializeForm(next) });
      onChange(updated);
    } catch (err) {
      // keep the optimistic local state either way — a mock form isn't worth
      // blocking the UI over a failed save
    }
  };

  const updateForm = (patch) => persist({ ...form, ...patch });

  const updateField = (id, patch) =>
    updateForm({ fields: form.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });

  const addField = () => updateForm({ fields: [...form.fields, newField()] });

  const removeField = (id) => updateForm({ fields: form.fields.filter((f) => f.id !== id) });

  const handleShare = async () => {
    const url = `https://nestpad.local/f/${block.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      // clipboard may be unavailable (e.g. no permission) — still show the
      // confirmation, the link itself is fake in this mock anyway
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleSubmitResponse = async () => {
    setSubmitting(true);
    try {
      await api.submitFormResponse(block.id, responseDraft);
      setSubmitted(true);
      setResponseDraft({});
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      window.alert(err?.message || 'Could not submit the response.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="form-block" className="group overflow-hidden rounded-lg border border-gray-200">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            data-testid="form-tab-builder"
            onClick={() => {
              setTab('builder');
              setPreviewing(false);
            }}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              tab === 'builder' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Form builder
          </button>
          <button
            data-testid="form-tab-responses"
            onClick={() => setTab('responses')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              tab === 'responses' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Responses
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="form-preview-button"
            onClick={() => setPreviewing((v) => !v)}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-gray-400"
          >
            {previewing ? '✕ Exit preview' : '◎ Preview'}
          </button>
          <button
            data-testid="form-share-button"
            onClick={handleShare}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-dark"
          >
            {shareCopied ? 'Link copied!' : 'Share form'}
          </button>
          {!locked && (
            <button
              onClick={() => onDelete(block.id)}
              className="text-xs text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {tab === 'responses' ? (
        <ResponsesList blockId={block.id} fields={form.fields} />
      ) : (
        <div>
          {/* Cover */}
          <div className="relative">
            <div
              className={`h-28 w-full ${
                form.cover?.type === 'gradient' ? form.cover.value : ''
              } bg-cover bg-center`}
              style={form.cover?.type === 'url' ? { backgroundImage: `url(${form.cover.value})` } : undefined}
            />
            {!previewing && !locked && (
              <button
                data-testid="form-change-cover-button"
                onClick={() => setShowCoverPicker((v) => !v)}
                className="absolute bottom-2 right-2 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-gray-700 shadow hover:bg-white"
              >
                Change cover
              </button>
            )}
            {showCoverPicker && (
              <div className="absolute bottom-10 right-2 flex gap-1 rounded-lg bg-white p-2 shadow-lg ring-1 ring-gray-200">
                {COVER_GRADIENTS.map((g) => (
                  <button
                    key={g}
                    onClick={() => {
                      updateForm({ cover: { type: 'gradient', value: g } });
                      setShowCoverPicker(false);
                    }}
                    className={`h-6 w-6 rounded-full ${g}`}
                    title="Use this cover"
                  />
                ))}
                <button
                  onClick={() => {
                    const url = window.prompt('Paste an image URL for the cover:');
                    if (url) updateForm({ cover: { type: 'url', value: url } });
                    setShowCoverPicker(false);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-300 text-xs text-gray-400 hover:border-accent hover:text-accent"
                  title="Use an image URL instead"
                >
                  +
                </button>
              </div>
            )}
          </div>

          <div className="px-6 pb-6">
            <div className="-mt-6 mb-2 flex h-12 w-12 items-center justify-center rounded-xl border-4 border-white bg-white text-2xl shadow">
              {previewing || locked ? (
                form.icon
              ) : (
                <input
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  onBlur={(e) => updateForm({ icon: e.target.value || '📝' })}
                  maxLength={2}
                  className="h-full w-full border-none bg-transparent text-center text-2xl focus:outline-none"
                />
              )}
            </div>

            {previewing || locked ? (
              <h2 className="text-xl font-semibold text-gray-900">{form.title}</h2>
            ) : (
              <input
                data-testid="form-title-input"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                onBlur={(e) => updateForm({ title: e.target.value || 'Untitled form' })}
                className="w-full border-none bg-transparent text-xl font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded"
              />
            )}

            {previewing || locked ? (
              <p className="mt-1 text-sm text-gray-600">{form.description}</p>
            ) : (
              <textarea
                data-testid="form-description-input"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                onBlur={(e) => updateForm({ description: e.target.value })}
                rows={2}
                className="mt-1 w-full resize-none border-none bg-transparent text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded"
              />
            )}

            {!previewing && !locked && (
              <div className="mt-4 flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span>
                  This form is {form.isPublic ? 'public. Anyone with the link can submit a response.' : 'private.'}
                </span>
                <button
                  onClick={() => updateForm({ isPublic: !form.isPublic })}
                  className="font-medium text-amber-900 underline hover:no-underline"
                >
                  Change
                </button>
              </div>
            )}

            <div className="mt-6 space-y-5">
              {form.fields.map((field) => (
                <div key={field.id} className="group/field">
                  {previewing ? (
                    <label className="mb-1.5 block text-sm font-medium text-gray-900">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </label>
                  ) : locked ? (
                    <p className="mb-1.5 text-sm font-medium text-gray-900">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </p>
                  ) : (
                    <div className="mb-1.5 flex items-center gap-2">
                      <input
                        data-testid="form-field-label-input"
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                        className="flex-1 border-none bg-transparent text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded"
                      />
                      <select
                        data-testid="form-field-type-select"
                        value={field.type}
                        onChange={(e) => updateField(field.id, { type: e.target.value })}
                        className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-500"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-400">
                        <input
                          type="checkbox"
                          checked={!!field.required}
                          onChange={(e) => updateField(field.id, { required: e.target.checked })}
                          className="accent-accent"
                        />
                        Required
                      </label>
                      <button
                        data-testid="form-remove-field-button"
                        onClick={() => removeField(field.id)}
                        className="text-xs text-gray-300 opacity-0 transition group-hover/field:opacity-100 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <FieldPreviewInput
                    field={field}
                    editable={previewing}
                    value={responseDraft[field.id]}
                    onChange={(v) => setResponseDraft((d) => ({ ...d, [field.id]: v }))}
                  />
                </div>
              ))}
            </div>

            {previewing ? (
              <button
                data-testid="form-submit-button"
                onClick={handleSubmitResponse}
                disabled={submitting}
                className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
              >
                {submitted ? 'Submitted!' : submitting ? 'Submitting…' : 'Submit'}
              </button>
            ) : (
              !locked && (
                <button
                  data-testid="form-add-field-button"
                  onClick={addField}
                  className="mx-auto mt-6 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:border-accent hover:text-accent"
                >
                  +
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
