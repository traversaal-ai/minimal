import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPageColor } from '../lib/pageColor.js';

function buildTree(pages) {
  const byParent = new Map();
  pages.forEach((p) => {
    const key = p.parent_page_id || 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(p);
  });
  return byParent;
}

function TreeNode({ page, byParent, activeId, depth, basePath }) {
  const children = byParent.get(page.id) || [];
  return (
    <div>
      <Link
        to={`${basePath}/${page.id}`}
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
          activeId === page.id
            ? 'bg-accent/10 font-medium text-accent'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {depth === 0 && (
          <span className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${getPageColor(page.id).dot}`} />
        )}
        {page.icon && <span className="flex-shrink-0">{page.icon}</span>}
        <span className="truncate">{page.title || 'Untitled'}</span>
        {page.locked && (
          <span className="ml-auto flex-shrink-0 text-xs text-gray-300" title="Locked">
            🔒
          </span>
        )}
      </Link>
      {children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              page={child}
              byParent={byParent}
              activeId={activeId}
              depth={depth + 1}
              basePath={basePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PageTree({ pages, basePath = '/app/pages' }) {
  const { id: activeId } = useParams();
  const byParent = buildTree(pages);
  const roots = byParent.get('root') || [];

  if (roots.length === 0) {
    return <p className="px-2 py-4 text-sm text-gray-400">No pages yet. Create your first one.</p>;
  }

  return (
    <div data-testid="page-tree" className="space-y-0.5">
      {roots.map((page) => (
        <TreeNode key={page.id} page={page} byParent={byParent} activeId={activeId} depth={0} basePath={basePath} />
      ))}
    </div>
  );
}
