import React, { useState } from 'react';
import * as api from '../api/client.js';
import { renderRichText } from '../lib/richText.jsx';

// Text-like blocks (text, heading, bulleted_list) render as clickable rich
// text — [label](url) becomes a real link — until clicked, then swap to a
// plain textarea for editing so a link's raw syntax is what gets edited.
// When `readOnly`, clicking never enters edit mode (a locked page — see
// docs/decisions.md — still lets everyone in the workspace view it).
function RichTextField({ value, onSave, className, placeholder, multiline, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = () => {
    if (readOnly) return;
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    const Field = multiline ? 'textarea' : 'input';
    return (
      <Field
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (!multiline && e.key === 'Enter') e.currentTarget.blur();
        }}
        rows={multiline ? 2 : undefined}
        className={`${className} w-full resize-none border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/40 rounded`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div onClick={startEditing} className={`${className} w-full ${readOnly ? '' : 'cursor-text'}`}>
      {value ? renderRichText(value) : <span className="text-gray-300">{placeholder}</span>}
    </div>
  );
}

// A 'code' block preserves whitespace and renders monospace — for ASCII
// diagrams, snippets, or anything where a proportional font would misalign
// the content. Click-to-edit like RichTextField, but no link parsing (raw
// text in, raw text out) and sized to the content's own line count.
function CodeField({ value, onSave, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = () => {
    if (readOnly) return;
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  const rows = Math.max(3, (editing ? draft : value).split('\n').length);

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={rows}
        spellCheck={false}
        className="w-full resize-none rounded-md border-none bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800 focus:outline-none focus:ring-1 focus:ring-accent/40"
      />
    );
  }

  return (
    <pre
      onClick={startEditing}
      className={`w-full overflow-x-auto whitespace-pre rounded-md bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800 ${readOnly ? '' : 'cursor-text'}`}
    >
      {value || <span className="text-gray-300">Paste a diagram or code snippet</span>}
    </pre>
  );
}

export default function Block({ block, onChange, onDelete, locked }) {
  const [saving, setSaving] = useState(false);

  const saveContent = async (newContent) => {
    setSaving(true);
    try {
      const updated = await api.updateBlock(block.id, { content: newContent });
      onChange(updated);
    } finally {
      setSaving(false);
    }
  };

  const toggleChecked = async () => {
    if (locked) return;
    try {
      const updated = await api.updateBlock(block.id, { checked: !block.checked });
      onChange(updated);
    } catch (err) {
      // ignore
    }
  };

  const RemoveButton = () =>
    locked ? null : (
      <button
        onClick={() => onDelete(block.id)}
        className="text-xs text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
      >
        Remove
      </button>
    );

  if (block.type === 'heading') {
    return (
      <div className="group flex items-start gap-2">
        <RichTextField
          value={block.content}
          onSave={saveContent}
          className="text-2xl font-semibold text-gray-900"
          placeholder="Heading"
          readOnly={locked}
        />
        <div className="mt-2">
          <RemoveButton />
        </div>
      </div>
    );
  }

  if (block.type === 'bulleted_list') {
    return (
      <div className="group flex items-start gap-2">
        <span className="mt-0.5 text-gray-400">•</span>
        <RichTextField
          value={block.content}
          onSave={saveContent}
          className="text-sm text-gray-700"
          placeholder="List item"
          readOnly={locked}
        />
        <RemoveButton />
      </div>
    );
  }

  if (block.type === 'code') {
    return (
      <div className="group flex items-start gap-2">
        <CodeField value={block.content} onSave={saveContent} readOnly={locked} />
        <div className="mt-2">
          <RemoveButton />
        </div>
      </div>
    );
  }

  if (block.type === 'checklist') {
    return (
      <div className="group flex items-center gap-2">
        <input
          type="checkbox"
          data-testid="checklist-item-checkbox"
          checked={!!block.checked}
          onChange={toggleChecked}
          disabled={locked}
          className="h-4 w-4 flex-shrink-0 accent-accent"
        />
        <RichTextField
          value={block.content}
          onSave={saveContent}
          className={`text-sm ${block.checked ? 'text-gray-400 line-through' : 'text-gray-800'}`}
          placeholder="Checklist item"
          readOnly={locked}
        />
        <RemoveButton />
      </div>
    );
  }

  // text
  return (
    <div className="group flex items-start gap-2">
      <RichTextField
        value={block.content}
        onSave={saveContent}
        className="text-sm text-gray-700"
        placeholder="Text"
        multiline
        readOnly={locked}
      />
      <RemoveButton />
    </div>
  );
}
