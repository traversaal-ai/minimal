import React from 'react';
import { Link } from 'react-router-dom';

// Parses the minimal [label](url) link syntax out of block text and renders
// real, clickable links — internal app links (starting with /) use
// react-router's Link so navigation doesn't reload the page; anything else
// renders as a plain external anchor. Everything outside [..](..)  renders
// as plain text. No other markdown is supported on purpose — this is just
// enough to make example content (and any content a user writes) link to
// other pages.
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

export function renderRichText(text) {
  if (!text) return text;
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [, label, url] = match;
    if (url.startsWith('/')) {
      parts.push(
        <Link
          key={`link-${key++}`}
          to={url}
          onClick={(e) => e.stopPropagation()}
          className="text-accent underline hover:no-underline"
        >
          {label}
        </Link>
      );
    } else {
      parts.push(
        <a
          key={`link-${key++}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-accent underline hover:no-underline"
        >
          {label}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
