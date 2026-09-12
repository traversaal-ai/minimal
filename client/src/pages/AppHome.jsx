import React, { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import * as api from '../api/client.js';
import { useSession } from '../auth/SessionProvider.jsx';
import { getPageColor } from '../lib/pageColor.js';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function PageCard({ page, childCount }) {
  const color = getPageColor(page.id);
  return (
    <Link
      to={`/app/pages/${page.id}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/nestpad-page-id', page.id)}
      className={`group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md ${color.ring} hover:ring-1`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${color.bg}`}>
        {page.icon || <span className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />}
      </div>
      <div>
        <p className="flex items-center gap-1.5 font-medium text-gray-900">
          <span className="truncate">{page.title || 'Untitled'}</span>
          {page.locked && <span className="flex-shrink-0 text-xs text-gray-300">🔒</span>}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          {childCount > 0 ? `${childCount} sub-page${childCount === 1 ? '' : 's'}` : 'No sub-pages yet'}
        </p>
      </div>
    </Link>
  );
}

// A collapsible group of page cards under a named section heading. `name`
// is null for the "unsectioned" group, which renders without a header or
// toggle — everything else is always groupable and collapsible, the same
// shape as a real Notion home page's toggle sections. Also a drop target:
// dragging a card here (from any section) moves that page into this one.
function Section({ name, pages, childCountFor, storageKey, onDropPage }) {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === null ? true : saved === '1';
    } catch (err) {
      return true;
    }
  });
  const [dragOver, setDragOver] = useState(false);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch (err) {
        // ignore — collapse state just won't persist
      }
      return next;
    });
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const pageId = e.dataTransfer.getData('text/nestpad-page-id');
        if (pageId) onDropPage(pageId, name);
      }}
      className={`rounded-xl transition ${dragOver ? 'bg-accent/5 ring-2 ring-accent/30' : ''}`}
    >
      {name && (
        <button
          data-testid="section-toggle"
          onClick={toggle}
          className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
          {name}
          <span className="font-normal text-gray-400">({pages.length})</span>
        </button>
      )}
      {open && (
        <div className="grid grid-cols-1 gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <PageCard key={page.id} page={page} childCount={childCountFor(page.id)} />
          ))}
          {pages.length === 0 && dragOver && (
            <div className="col-span-full rounded-lg border-2 border-dashed border-accent/30 py-6 text-center text-xs text-accent">
              Drop here to move into {name || 'Unsectioned'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppHome() {
  const { user, workspace } = useSession();
  const { pages, reloadPages } = useOutletContext();

  const rootPages = pages.filter((p) => !p.parent_page_id);
  const childCountFor = (id) => pages.filter((p) => p.parent_page_id === id).length;

  const unsectioned = rootPages.filter((p) => !p.section);
  const sectionNames = [...new Set(rootPages.map((p) => p.section).filter(Boolean))];

  const handleDropPage = async (pageId, sectionName) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page || (page.section || null) === (sectionName || null)) return;
    try {
      await api.updatePage(pageId, { title: page.title, section: sectionName });
      await reloadPages();
    } catch (err) {
      // ignore — page just stays where it was
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-10 py-12">
      <p className="text-sm font-medium text-gray-400">
        {greeting()}
        {user?.email ? `, ${user.email.split('@')[0]}` : ''}
      </p>
      <h1 className="mt-1 text-3xl font-semibold text-gray-900">{workspace?.name || 'Minimal'}</h1>
      <p className="mt-2 text-sm text-gray-500">
        {rootPages.length > 0
          ? 'Here’s everything in your workspace, grouped into sections. Click a section name to collapse it, or drag a card into another section.'
          : 'Nothing here yet — create your first page to get started.'}
      </p>

      <div className="mt-8 space-y-10">
        {unsectioned.length > 0 && (
          <Section
            name={null}
            pages={unsectioned}
            childCountFor={childCountFor}
            storageKey={`nestpad_section_open_${workspace?.id}_unsectioned`}
            onDropPage={handleDropPage}
          />
        )}
        {sectionNames.map((name) => (
          <Section
            key={name}
            name={name}
            pages={rootPages.filter((p) => p.section === name)}
            childCountFor={childCountFor}
            storageKey={`nestpad_section_open_${workspace?.id}_${name}`}
            onDropPage={handleDropPage}
          />
        ))}
      </div>
    </div>
  );
}
