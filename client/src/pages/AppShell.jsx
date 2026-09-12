import React, { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import * as api from '../api/client.js';
import { useSession } from '../auth/SessionProvider.jsx';
import PageTree from '../components/PageTree.jsx';
import InvitePanel from '../components/InvitePanel.jsx';
import NewPageModal from '../components/NewPageModal.jsx';
import { getPageColor } from '../lib/pageColor.js';

function SearchResults({ pages, query }) {
  const q = query.trim().toLowerCase();
  const matches = pages.filter((p) => (p.title || '').toLowerCase().includes(q));

  if (matches.length === 0) {
    return <p className="px-2 py-4 text-sm text-gray-400">No pages match "{query}".</p>;
  }

  return (
    <div data-testid="search-results" className="space-y-0.5">
      {matches.map((p) => (
        <Link
          key={p.id}
          to={`/app/pages/${p.id}`}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          {!p.parent_page_id && (
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${getPageColor(p.id).dot}`} />
          )}
          {p.icon && <span>{p.icon}</span>}
          <span className="truncate">{p.title || 'Untitled'}</span>
        </Link>
      ))}
    </div>
  );
}

export default function AppShell() {
  const { user, workspace, logout } = useSession();
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  const [search, setSearch] = useState('');

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPages();
      setPages(data.pages || []);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const handleCreateRootPage = async (title, section) => {
    const page = await api.createPage(title, null, section || null);
    await loadPages();
    setShowNewPage(false);
    navigate(`/app/pages/${page.id}`);
  };

  const handleUseTemplate = async (templateId, templateTitle) => {
    const title = window.prompt('Name this page:', templateTitle) || templateTitle;
    const page = await api.duplicatePage(templateId, { title });
    await loadPages();
    setShowNewPage(false);
    navigate(`/app/pages/${page.id}`);
  };

  const existingSections = [...new Set(pages.map((p) => p.section).filter(Boolean))];
  const templates = pages.filter((p) => !p.parent_page_id && p.section === 'Templates');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-72 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
          <span className="text-base font-semibold text-gray-900">{workspace?.name || 'Minimal'}</span>
        </div>

        <div className="space-y-2 px-3 pt-3">
          <button
            data-testid="new-page-button"
            onClick={() => setShowNewPage(true)}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-accent hover:text-accent"
          >
            + New page
          </button>
          <input
            data-testid="sidebar-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages…"
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <p className="px-2 text-sm text-gray-400">Loading…</p>
          ) : search.trim() ? (
            <SearchResults pages={pages} query={search} />
          ) : (
            <PageTree pages={pages} />
          )}
        </div>

        <div className="space-y-2 border-t border-gray-100 px-3 py-3">
          <Link
            to="/app/graph"
            data-testid="graph-nav-link"
            className="block w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-accent hover:text-accent"
          >
            🕸 Graph view
          </Link>
          <button
            onClick={() => setShowInvite(true)}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-left text-sm text-gray-600 hover:border-accent hover:text-accent"
          >
            Invite teammate
          </button>
          <div className="flex items-center justify-between px-1">
            <span className="truncate text-xs text-gray-400">{user?.email}</span>
            <button
              data-testid="logout-button"
              onClick={handleLogout}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet context={{ pages, reloadPages: loadPages }} />
      </main>

      {showInvite && <InvitePanel onClose={() => setShowInvite(false)} />}
      {showNewPage && (
        <NewPageModal
          onCreate={handleCreateRootPage}
          onClose={() => setShowNewPage(false)}
          heading="New page"
          showSection
          existingSections={existingSections}
          templates={templates}
          onUseTemplate={handleUseTemplate}
        />
      )}
    </div>
  );
}
