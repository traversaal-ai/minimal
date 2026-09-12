import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import * as api from '../api/client.js';
import { useSession } from '../auth/SessionProvider.jsx';
import Block from '../components/Block.jsx';
import TableBlock from '../components/TableBlock.jsx';
import FormBlock from '../components/FormBlock.jsx';
import AddBlockControl from '../components/AddBlockControl.jsx';
import NewPageModal from '../components/NewPageModal.jsx';

const PRESENCE_INTERVAL_MS = 10_000;

function PresenceBadges({ viewers }) {
  if (!viewers.length) return null;
  return (
    <div className="flex items-center gap-1.5" data-testid="presence-badges">
      {viewers.map((email) => (
        <span
          key={email}
          title={`${email} is viewing this page`}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs font-medium text-accent ring-2 ring-white"
        >
          {email[0].toUpperCase()}
        </span>
      ))}
      <span className="text-xs text-gray-400">
        {viewers.length === 1 ? `${viewers[0]} is viewing` : `${viewers.length} others viewing`}
      </span>
    </div>
  );
}

function ActivityPanel({ pageId, open, onClose }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api
      .getPageActivity(pageId)
      .then((data) => {
        if (!cancelled) setActivity(data.activity || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, open]);

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full z-10 mt-1 w-80 rounded-lg border border-gray-200 bg-white p-3 shadow-lg" data-testid="activity-panel">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Recent activity</p>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : activity.length === 0 ? (
        <p className="text-xs text-gray-400">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {activity.map((a) => (
            <li key={a.id} className="text-xs text-gray-600">
              <span className="font-medium text-gray-800">{a.actor_email.split('@')[0]}</span> — {a.summary}
              <div className="text-gray-400">{new Date(a.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Obsidian-style "Linked mentions" — every other page whose content links
// here. Recomputed whenever the page changes; a link is detected purely by
// this page's id appearing in another page's block content (see
// docs/decisions.md), so it updates as soon as someone adds or removes a
// [label](/app/pages/<id>) link anywhere in the workspace.
function BacklinksPanel({ pageId }) {
  const [backlinks, setBacklinks] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getBacklinks(pageId).then((data) => {
      if (!cancelled) setBacklinks(data.backlinks || []);
    });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  if (!backlinks || backlinks.length === 0) return null;

  return (
    <div className="mt-10 border-t border-gray-100 pt-6" data-testid="backlinks-panel">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        Linked mentions ({backlinks.length})
      </p>
      <ul className="space-y-1">
        {backlinks.map((p) => (
          <li key={p.id}>
            <Link to={`/app/pages/${p.id}`} className="text-sm text-accent hover:underline">
              {p.title || 'Untitled'}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { pages, reloadPages } = useOutletContext();

  const [page, setPage] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [title, setTitle] = useState('');
  const [section, setSection] = useState('');
  const [icon, setIcon] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSubpageModal, setShowSubpageModal] = useState(false);
  const [error, setError] = useState('');
  const [viewers, setViewers] = useState([]);
  const [showActivity, setShowActivity] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getPage(id);
      setPage(data.page);
      setBlocks(data.blocks || []);
      setTitle(data.page.title);
      setSection(data.page.section || '');
      setIcon(data.page.icon || '');
    } catch (err) {
      setError(err?.message || 'Could not load page.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Presence: heartbeat + poll while this page is open.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      api.sendPresenceHeartbeat(id).catch(() => {});
      api
        .getPagePresence(id)
        .then((data) => {
          if (!cancelled) setViewers(data.viewers || []);
        })
        .catch(() => {});
    };
    tick();
    const interval = setInterval(tick, PRESENCE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  const canEdit = !page || !page.locked || page.created_by === user?.id;
  const isOwner = page && page.created_by === user?.id;

  const saveTitle = async () => {
    if (!page || !canEdit) return;
    if (!title.trim()) {
      setTitle(page.title);
      return;
    }
    if (title === page.title) return;
    try {
      const updated = await api.updatePage(page.id, { title: title.trim() });
      setPage(updated);
      reloadPages();
    } catch (err) {
      setTitle(page.title);
    }
  };

  const saveSection = async () => {
    if (!page || !canEdit) return;
    const next = section.trim() || null;
    if (next === (page.section || null)) return;
    try {
      const updated = await api.updatePage(page.id, { title: page.title, section: next });
      setPage(updated);
      setSection(updated.section || '');
      reloadPages();
    } catch (err) {
      setSection(page.section || '');
    }
  };

  const saveIcon = async () => {
    if (!page || !canEdit) return;
    const next = icon.trim() || null;
    if (next === (page.icon || null)) return;
    try {
      const updated = await api.updatePage(page.id, { title: page.title, icon: next });
      setPage(updated);
      setIcon(updated.icon || '');
      reloadPages();
    } catch (err) {
      setIcon(page.icon || '');
    }
  };

  const toggleLock = async () => {
    if (!page || !isOwner) return;
    try {
      const updated = await api.updatePage(page.id, { title: page.title, locked: !page.locked });
      setPage(updated);
      reloadPages();
    } catch (err) {
      window.alert(err?.message || 'Could not change lock state.');
    }
  };

  const saveAsTemplate = async () => {
    if (!page) return;
    const name = window.prompt('Save as a template named:', `${page.title} (template)`);
    if (!name) return;
    try {
      await api.duplicatePage(page.id, { title: name, section: 'Templates' });
      await reloadPages();
      window.alert(`Saved to the "Templates" section as "${name}".`);
    } catch (err) {
      window.alert(err?.message || 'Could not save as template.');
    }
  };

  const handleAddBlock = async (type, content) => {
    const position = blocks.length;
    const block = await api.createBlock(page.id, type, content || '', position);
    setBlocks((prev) => [...prev, block]);
  };

  const handleBlockChange = (updated) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleBlockDelete = async (blockId) => {
    try {
      await api.deleteBlock(blockId);
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    } catch (err) {
      // ignore
    }
  };

  // Drag-to-reorder: HTML5 DnD on each block row. On drop, reorders the
  // local array and persists every block's new position — cheap at the
  // scale a single page's block list actually reaches.
  const handleDragStart = (index) => () => setDraggingIndex(index);
  const handleDragOver = (index) => (e) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === index) return;
  };
  const handleDrop = (index) => async (e) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === index || !canEdit) {
      setDraggingIndex(null);
      return;
    }
    const reordered = [...blocks];
    const [moved] = reordered.splice(draggingIndex, 1);
    reordered.splice(index, 0, moved);
    setBlocks(reordered);
    setDraggingIndex(null);
    await Promise.all(
      reordered.map((b, i) =>
        b.position === i ? Promise.resolve() : api.updateBlock(b.id, { position: i }).catch(() => {})
      )
    );
  };

  const handleCreateSubpage = async (subTitle) => {
    const child = await api.createPage(subTitle, page.id);
    await reloadPages();
    setShowSubpageModal(false);
    navigate(`/app/pages/${child.id}`);
  };

  const handleDeletePage = async () => {
    if (!window.confirm('Delete this page and all its sub-pages?')) return;
    try {
      await api.deletePage(page.id);
      await reloadPages();
      navigate('/app');
    } catch (err) {
      window.alert(err?.message || 'Could not delete page.');
    }
  };

  const parent = page && page.parent_page_id ? pages.find((p) => p.id === page.parent_page_id) : null;

  if (loading) {
    return <div className="p-10 text-sm text-gray-400">Loading…</div>;
  }

  if (error || !page) {
    return <div className="p-10 text-sm text-red-600">{error || 'Page not found.'}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-10 py-12">
      {parent && (
        <Link
          to={`/app/pages/${parent.id}`}
          data-testid="parent-page-link"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-accent"
        >
          ← {parent.title || 'Untitled'}
        </Link>
      )}

      <div className="mb-2 flex items-center justify-between">
        <PresenceBadges viewers={viewers} />
        <div className="relative flex items-center gap-2">
          <button
            data-testid="activity-button"
            onClick={() => setShowActivity((v) => !v)}
            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-gray-300"
          >
            History
          </button>
          <ActivityPanel pageId={page.id} open={showActivity} onClose={() => setShowActivity(false)} />
          {!page.parent_page_id && (
            <button
              data-testid="save-as-template-button"
              onClick={saveAsTemplate}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-gray-300"
            >
              Save as template
            </button>
          )}
          {isOwner && (
            <button
              data-testid="lock-page-button"
              onClick={toggleLock}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                page.locked ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {page.locked ? '🔒 Locked' : '🔓 Unlocked'}
            </button>
          )}
        </div>
      </div>

      {page.locked && !isOwner && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="locked-banner">
          This page is locked — only its creator can edit it. You can still view it and comment.
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex w-full flex-1 items-center gap-2">
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              onBlur={saveIcon}
              disabled={!canEdit}
              maxLength={2}
              placeholder="＋"
              className="w-9 flex-shrink-0 border-none bg-transparent text-center text-2xl focus:outline-none focus:ring-1 focus:ring-accent/40 rounded disabled:opacity-50"
            />
            <input
              data-testid="page-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              disabled={!canEdit}
              className="w-full flex-1 border-none bg-transparent text-3xl font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded disabled:opacity-70"
              placeholder="Untitled"
            />
          </div>
          {canEdit && (
            <button
              data-testid="delete-page-button"
              onClick={handleDeletePage}
              className="flex-shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:border-red-300 hover:text-red-600"
            >
              Delete
            </button>
          )}
        </div>
        {!page.parent_page_id && (
          <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
            <span>Section:</span>
            <input
              data-testid="page-section-input"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              onBlur={saveSection}
              disabled={!canEdit}
              placeholder="Unsectioned"
              className="rounded border-none bg-transparent px-1 py-0.5 text-sm text-gray-500 focus:outline-none focus:ring-1 focus:ring-accent/40 disabled:opacity-70"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div
            key={block.id}
            draggable={canEdit}
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver(index)}
            onDrop={handleDrop(index)}
            className={canEdit ? 'cursor-grab active:cursor-grabbing' : undefined}
          >
            {block.type === 'table' ? (
              <TableBlock block={block} onChange={handleBlockChange} onDelete={handleBlockDelete} locked={!canEdit} />
            ) : block.type === 'form' ? (
              <FormBlock block={block} onChange={handleBlockChange} onDelete={handleBlockDelete} locked={!canEdit} />
            ) : (
              <Block block={block} onChange={handleBlockChange} onDelete={handleBlockDelete} locked={!canEdit} />
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-6 flex items-center gap-3">
          <AddBlockControl onCreate={handleAddBlock} />
          <button
            data-testid="new-subpage-button"
            onClick={() => setShowSubpageModal(true)}
            className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-accent hover:text-accent"
          >
            + New sub-page
          </button>
        </div>
      )}

      {showSubpageModal && (
        <NewPageModal
          heading="New sub-page"
          onCreate={handleCreateSubpage}
          onClose={() => setShowSubpageModal(false)}
        />
      )}

      <BacklinksPanel pageId={page.id} />
    </div>
  );
}
