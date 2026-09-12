import React, { useEffect, useState } from 'react';
import { EditableCell } from './TableBlock.jsx';
import * as api from '../api/client.js';

function iconForColumn(name) {
  const n = (name || '').toLowerCase();
  if (/date/.test(n)) return '📅';
  if (/owner|assignee|person|who/.test(n)) return '👤';
  if (/status/.test(n)) return '◔';
  if (/task ?#|^#$|number|no\.?$/.test(n)) return '#';
  return '≡';
}

function BigEditableTitle({ value, onSave, readOnly }) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      data-testid="row-detail-title-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
      }}
      readOnly={readOnly}
      placeholder="Untitled"
      className="w-full border-none bg-transparent text-2xl font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded"
    />
  );
}

// A table row, opened as its own page-like view — same idea as clicking a
// row's "OPEN" affordance in Notion: the row's first column becomes a big
// title, every other column renders as a labeled property, and there's a
// real, server-side comment thread underneath (see docs/decisions.md — this
// replaced an earlier localStorage-only version). Comments stay postable
// even when the page is locked — locking blocks editing content, not
// discussion.
export default function RowDetailModal({ table, row, onClose, onSaveCell, onAddColumn, locked }) {
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [draftComment, setDraftComment] = useState('');

  const titleColumn = table.columns[0];
  const otherColumns = table.columns.slice(1);

  useEffect(() => {
    let cancelled = false;
    api
      .getRowComments(row.id)
      .then((data) => {
        if (!cancelled) setComments(data.comments || []);
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row.id]);

  const submitComment = async (e) => {
    e.preventDefault();
    if (!draftComment.trim()) return;
    try {
      const comment = await api.postRowComment(row.id, draftComment.trim());
      setComments((prev) => [...prev, comment]);
      setDraftComment('');
    } catch (err) {
      // ignore — the draft stays in the input so the user can retry
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/30 py-10"
      onClick={onClose}
    >
      <div
        data-testid="row-detail-modal"
        className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          data-testid="row-detail-close"
          onClick={onClose}
          className="mb-4 text-sm text-gray-400 hover:text-gray-600"
        >
          ✕ Close
        </button>

        {titleColumn && (
          <BigEditableTitle
            value={row.cells[titleColumn.id] || ''}
            onSave={(v) => onSaveCell(row.id, titleColumn.id, v)}
            readOnly={locked}
          />
        )}

        <div className="mt-6 space-y-1">
          {otherColumns.map((column) => (
            <div key={column.id} className="flex items-start gap-3 rounded-md px-2 py-1 hover:bg-gray-50">
              <div className="flex w-32 flex-shrink-0 items-center gap-1.5 pt-2 text-sm text-gray-400">
                <span>{iconForColumn(column.name)}</span>
                <span className="truncate">{column.name}</span>
              </div>
              <div className="flex-1">
                <EditableCell
                  value={row.cells[column.id] || ''}
                  onSave={(v) => onSaveCell(row.id, column.id, v)}
                  readOnly={locked}
                />
              </div>
            </div>
          ))}
          {!locked && onAddColumn && (
            <button
              data-testid="row-detail-add-property"
              onClick={onAddColumn}
              className="ml-2 mt-2 text-sm text-gray-400 hover:text-accent"
            >
              + Add a property
            </button>
          )}
        </div>

        <div className="mt-8 border-t border-gray-100 pt-4">
          <p className="mb-3 text-sm font-medium text-gray-700">Comments</p>
          {loadingComments ? (
            <p className="mb-3 text-xs text-gray-400">Loading…</p>
          ) : (
            comments.length > 0 && (
              <div className="mb-3 space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2 text-sm">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-medium text-accent">
                      {(c.author_email || '?')[0].toUpperCase()}
                    </span>
                    <div>
                      <p className="text-gray-700">{c.text}</p>
                      <p className="text-xs text-gray-400">{c.author_email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
          <form onSubmit={submitComment} className="flex items-center gap-2">
            <input
              data-testid="row-comment-input"
              value={draftComment}
              onChange={(e) => setDraftComment(e.target.value)}
              placeholder="Add a comment…"
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="submit"
              data-testid="row-comment-submit"
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-dark"
            >
              Post
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
