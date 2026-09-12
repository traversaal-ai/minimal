import React, { useState } from 'react';
import * as api from '../api/client.js';
import { getStatusStyle } from '../lib/pageColor.js';
import RowDetailModal from './RowDetailModal.jsx';

// A recognized status value (Done / In progress / Not started / Blocked)
// renders as a colored pill; anything else is a plain editable cell. Either
// way it's the same input — the pill is just styling, still directly
// editable, not a separate display/edit mode. Exported so RowDetailModal can
// reuse the exact same editing behavior for a row's properties.
export function EditableCell({ value, onSave, readOnly }) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const statusStyle = !focused && getStatusStyle(draft);

  return (
    <div className="px-2 py-1.5">
      <input
        data-testid="table-cell-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        readOnly={readOnly}
        onBlur={() => {
          setFocused(false);
          if (draft !== value) onSave(draft);
        }}
        className={
          statusStyle
            ? `w-auto rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 focus:outline-none ${statusStyle}`
            : 'w-full border-none bg-transparent text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded'
        }
        placeholder="Empty"
      />
    </div>
  );
}

// Renders and edits a 'table' block: editable column names, editable cells,
// add/remove rows and columns. No sorting, filtering, or column types —
// every cell is plain text, per docs/decisions.md.
export default function TableBlock({ block, onChange, onDelete, locked }) {
  const [table, setTable] = useState(block.table || { columns: [], rows: [] });
  const [busy, setBusy] = useState(false);
  const [openRowId, setOpenRowId] = useState(null);

  const refresh = (next) => {
    setTable(next);
    onChange({ ...block, table: next });
  };

  const addColumn = async () => {
    setBusy(true);
    try {
      const column = await api.createTableColumn(block.id, `Column ${table.columns.length + 1}`);
      const rows = table.rows.map((r) => ({ ...r, cells: { ...r.cells, [column.id]: '' } }));
      refresh({ columns: [...table.columns, column], rows });
    } finally {
      setBusy(false);
    }
  };

  const renameColumn = async (columnId, name) => {
    const updated = await api.updateTableColumn(columnId, name);
    refresh({
      ...table,
      columns: table.columns.map((c) => (c.id === columnId ? updated : c)),
    });
  };

  const deleteColumn = async (columnId) => {
    await api.deleteTableColumn(columnId);
    const rows = table.rows.map((r) => {
      const cells = { ...r.cells };
      delete cells[columnId];
      return { ...r, cells };
    });
    refresh({ columns: table.columns.filter((c) => c.id !== columnId), rows });
  };

  const addRow = async () => {
    setBusy(true);
    try {
      const row = await api.createTableRow(block.id);
      refresh({ ...table, rows: [...table.rows, row] });
    } finally {
      setBusy(false);
    }
  };

  const deleteRow = async (rowId) => {
    await api.deleteTableRow(rowId);
    refresh({ ...table, rows: table.rows.filter((r) => r.id !== rowId) });
  };

  const saveCell = async (rowId, columnId, value) => {
    await api.upsertTableCell(rowId, columnId, value);
    refresh({
      ...table,
      rows: table.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [columnId]: value } } : r)),
    });
  };

  return (
    <div data-testid="table-block" className="group overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {table.columns.map((column) => (
              <th key={column.id} className="border-r border-gray-200 p-0 last:border-r-0">
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    data-testid="table-column-name-input"
                    value={column.name}
                    onChange={(e) =>
                      setTable((t) => ({
                        ...t,
                        columns: t.columns.map((c) => (c.id === column.id ? { ...c, name: e.target.value } : c)),
                      }))
                    }
                    onBlur={(e) => renameColumn(column.id, e.target.value)}
                    readOnly={locked}
                    className="w-full border-none bg-transparent text-xs font-semibold uppercase tracking-wide text-gray-500 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded"
                  />
                  {!locked && (
                    <button
                      data-testid="delete-table-column"
                      onClick={() => deleteColumn(column.id)}
                      className="flex-shrink-0 text-xs text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                      title="Delete column"
                    >
                      ×
                    </button>
                  )}
                </div>
              </th>
            ))}
            {!locked && (
              <th className="w-8 p-1">
                <button
                  data-testid="add-table-column"
                  onClick={addColumn}
                  disabled={busy}
                  className="rounded px-1.5 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-accent"
                  title="Add column"
                >
                  +
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id} className="group/row border-b border-gray-100 last:border-b-0">
              {table.columns.map((column, i) => (
                <td key={column.id} className="relative border-r border-gray-100 p-0 last:border-r-0">
                  <EditableCell
                    value={row.cells[column.id] || ''}
                    onSave={(value) => saveCell(row.id, column.id, value)}
                    readOnly={locked}
                  />
                  {i === 0 && (
                    <button
                      data-testid="open-table-row"
                      onClick={() => setOpenRowId(row.id)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-500 opacity-0 shadow-sm transition group-hover/row:opacity-100 hover:border-accent hover:text-accent"
                    >
                      Open
                    </button>
                  )}
                </td>
              ))}
              <td className="p-1 text-center">
                {!locked && (
                  <button
                    data-testid="delete-table-row"
                    onClick={() => deleteRow(row.id)}
                    className="text-xs text-gray-300 opacity-0 transition group-hover/row:opacity-100 hover:text-red-500"
                    title="Delete row"
                  >
                    ×
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-gray-100 px-2 py-1.5">
        {!locked && (
          <button
            data-testid="add-table-row"
            onClick={addRow}
            disabled={busy}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-accent"
          >
            + New row
          </button>
        )}
        {!locked && (
          <button
            onClick={() => onDelete(block.id)}
            className="text-xs text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
          >
            Remove table
          </button>
        )}
      </div>

      {openRowId && table.rows.find((r) => r.id === openRowId) && (
        <RowDetailModal
          table={table}
          row={table.rows.find((r) => r.id === openRowId)}
          onClose={() => setOpenRowId(null)}
          onSaveCell={saveCell}
          onAddColumn={addColumn}
          locked={locked}
        />
      )}
    </div>
  );
}
