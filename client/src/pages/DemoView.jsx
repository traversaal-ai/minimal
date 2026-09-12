import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '../api/client.js';
import PageTree from '../components/PageTree.jsx';
import { renderRichText } from '../lib/richText.jsx';
import { getStatusStyle } from '../lib/pageColor.js';
import { parseForm } from '../lib/formTemplate.js';

function ReadOnlyForm({ content }) {
  const form = parseForm(content);
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div
        className={`h-20 w-full ${form.cover?.type === 'gradient' ? form.cover.value : ''} bg-cover bg-center`}
        style={form.cover?.type === 'url' ? { backgroundImage: `url(${form.cover.value})` } : undefined}
      />
      <div className="px-5 pb-5">
        <div className="-mt-5 mb-2 flex h-10 w-10 items-center justify-center rounded-xl border-4 border-white bg-white text-xl shadow">
          {form.icon}
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{form.title}</h3>
        <p className="mt-1 text-sm text-gray-600">{form.description}</p>
        <div className="mt-4 space-y-4">
          {form.fields.map((field) => (
            <div key={field.id}>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea disabled rows={2} placeholder="Respondent's answer" className="w-full resize-none rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400" />
              ) : field.type === 'file' ? (
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400">Upload</div>
              ) : (
                <input disabled placeholder="Respondent's answer" className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Mock form — viewing as a guest, submissions aren't collected.
        </p>
      </div>
    </div>
  );
}

function ReadOnlyCellValue({ value }) {
  const style = getStatusStyle(value);
  if (style) {
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${style}`}>{value}</span>;
  }
  return value || '';
}

// A read-only version of the row-detail view: same properties layout, no
// editing, no comments (a guest has no identity to attribute a comment to).
function ReadOnlyRowDetail({ table, row, onClose }) {
  const titleColumn = table.columns[0];
  const otherColumns = table.columns.slice(1);
  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/30 py-10" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="mb-4 text-sm text-gray-400 hover:text-gray-600">
          ✕ Close
        </button>
        {titleColumn && <h2 className="text-2xl font-semibold text-gray-900">{row.cells[titleColumn.id] || 'Untitled'}</h2>}
        <div className="mt-6 space-y-1">
          {otherColumns.map((column) => (
            <div key={column.id} className="flex items-start gap-3 rounded-md px-2 py-1.5">
              <div className="w-32 flex-shrink-0 text-sm text-gray-400">{column.name}</div>
              <div className="flex-1 text-sm text-gray-700">
                <ReadOnlyCellValue value={row.cells[column.id]} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-400">
          Viewing as a guest — sign up to comment and edit.
        </p>
      </div>
    </div>
  );
}

function ReadOnlyTable({ table }) {
  const [openRowId, setOpenRowId] = useState(null);
  const openRow = table.rows.find((r) => r.id === openRowId);
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {table.columns.map((column) => (
              <th
                key={column.id}
                className="border-r border-gray-200 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 last:border-r-0"
              >
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id} className="group/row border-b border-gray-100 last:border-b-0">
              {table.columns.map((column, i) => (
                <td key={column.id} className="relative border-r border-gray-100 px-2 py-1.5 text-sm text-gray-700 last:border-r-0">
                  <ReadOnlyCellValue value={row.cells[column.id]} />
                  {i === 0 && (
                    <button
                      onClick={() => setOpenRowId(row.id)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-500 opacity-0 shadow-sm transition group-hover/row:opacity-100 hover:border-accent hover:text-accent"
                    >
                      Open
                    </button>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {openRow && <ReadOnlyRowDetail table={table} row={openRow} onClose={() => setOpenRowId(null)} />}
    </div>
  );
}

function ReadOnlyBlock({ block }) {
  if (block.type === 'heading') {
    return <h2 className="text-2xl font-semibold text-gray-900">{renderRichText(block.content)}</h2>;
  }
  if (block.type === 'bulleted_list') {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-gray-400">•</span>
        <span className="text-sm text-gray-700">{renderRichText(block.content)}</span>
      </div>
    );
  }
  if (block.type === 'checklist') {
    return (
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={!!block.checked} disabled className="h-4 w-4 flex-shrink-0 accent-accent" />
        <span className={`text-sm ${block.checked ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {renderRichText(block.content)}
        </span>
      </div>
    );
  }
  if (block.type === 'table' && block.table) {
    return <ReadOnlyTable table={block.table} />;
  }
  if (block.type === 'form') {
    return <ReadOnlyForm content={block.content} />;
  }
  if (block.type === 'code') {
    return <pre className="w-full overflow-x-auto whitespace-pre rounded-md bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800">{block.content}</pre>;
  }
  return <p className="text-sm text-gray-700">{renderRichText(block.content)}</p>;
}

function GuestBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3">
      <p className="text-sm text-amber-800">
        You're viewing a read-only demo. Sign up to create and edit your own workspace.
      </p>
      <Link
        to="/signup"
        className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:bg-accent-dark"
      >
        Get started free
      </Link>
    </div>
  );
}

export default function DemoView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [workspaceName, setWorkspaceName] = useState('Minimal demo');
  const [page, setPage] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPages = useCallback(async () => {
    try {
      const data = await api.getDemoPages();
      setPages(data.pages || []);
      if (data.workspace?.name) setWorkspaceName(data.workspace.name);
      return data.pages || [];
    } catch (err) {
      setError(err?.message || 'Could not load the demo workspace.');
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPages().then((loadedPages) => {
      if (cancelled) return;
      if (!id && loadedPages.length > 0) {
        const root = loadedPages.find((p) => !p.parent_page_id) || loadedPages[0];
        navigate(`/demo/pages/${root.id}`, { replace: true });
      } else {
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, loadPages, navigate]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getDemoPage(id)
      .then((data) => {
        if (cancelled) return;
        setPage(data.page);
        setBlocks(data.blocks || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Could not load this page.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const parent = page && page.parent_page_id ? pages.find((p) => p.id === page.parent_page_id) : null;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <GuestBanner />
      <div className="flex flex-1">
        <aside className="flex w-72 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
            <span className="text-base font-semibold text-gray-900">{workspaceName}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <PageTree pages={pages} basePath="/demo/pages" />
          </div>
          <div className="border-t border-gray-100 px-3 py-3">
            <Link to="/" className="text-xs font-medium text-gray-500 hover:text-gray-900">
              ← Back to Minimal
            </Link>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-10 text-sm text-gray-400">Loading…</div>
          ) : error || !page ? (
            <div className="p-10 text-sm text-red-600">{error || 'Page not found.'}</div>
          ) : (
            <div className="mx-auto max-w-3xl px-10 py-12">
              {parent && (
                <Link
                  to={`/demo/pages/${parent.id}`}
                  className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-accent"
                >
                  ← {parent.title || 'Untitled'}
                </Link>
              )}
              <h1 className="mb-8 text-3xl font-semibold text-gray-900">{page.title || 'Untitled'}</h1>
              <div className="space-y-3">
                {blocks.map((block) => (
                  <ReadOnlyBlock key={block.id} block={block} />
                ))}
                {blocks.length === 0 && <p className="text-sm text-gray-400">No content on this page yet.</p>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
