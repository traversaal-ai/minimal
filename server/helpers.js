// helpers.js — shared serialization + validation helpers.
// Keeps index.js focused on routing; nothing here touches the network layer.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isValidEmail(email) {
  return EMAIL_RE.test(email);
}

// Row -> API shape. Never includes password_hash.
function serializeUser(row) {
  return { id: row.id, email: row.email, created_at: row.created_at };
}

function serializeWorkspace(row) {
  return { id: row.id, name: row.name };
}

function serializePage(row) {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    parent_page_id: row.parent_page_id,
    title: row.title,
    section: row.section || null,
    icon: row.icon || null,
    locked: !!row.locked,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeBlock(row) {
  return {
    id: row.id,
    page_id: row.page_id,
    type: row.type,
    content: row.content,
    checked: row.checked === null || row.checked === undefined ? null : !!row.checked,
    position: row.position,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeTableColumn(row) {
  return { id: row.id, block_id: row.block_id, name: row.name, position: row.position };
}

function serializeTableRow(row, cells) {
  // cells: array of { column_id, value } rows for this row_id
  const cellMap = {};
  cells.forEach((c) => {
    cellMap[c.column_id] = c.value;
  });
  return { id: row.id, block_id: row.block_id, position: row.position, cells: cellMap };
}

function serializeRowComment(row, authorEmail) {
  return { id: row.id, row_id: row.row_id, author_email: authorEmail, text: row.text, created_at: row.created_at };
}

function serializeActivity(row, actorEmail) {
  return { id: row.id, page_id: row.page_id, actor_email: actorEmail, summary: row.summary, created_at: row.created_at };
}

function serializeFormResponse(row) {
  let data = {};
  try {
    data = JSON.parse(row.data);
  } catch (err) {
    data = {};
  }
  return { id: row.id, block_id: row.block_id, data, created_at: row.created_at };
}

function errorBody(error, message) {
  return { error, message };
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  serializeUser,
  serializeWorkspace,
  serializePage,
  serializeBlock,
  serializeTableColumn,
  serializeTableRow,
  serializeRowComment,
  serializeActivity,
  serializeFormResponse,
  errorBody,
};
