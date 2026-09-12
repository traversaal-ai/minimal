const API_BASE = 'http://localhost:3001';
const TOKEN_KEY = 'nestpad_access_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw { error: 'network_error', message: 'Could not reach the server. Is it running?' };
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = null;
    }
  }

  if (!res.ok) {
    throw data || { error: 'unknown_error', message: 'Something went wrong.' };
  }

  return data;
}

// Auth
export const signup = (email, password) =>
  request('/auth/signup', { method: 'POST', body: { email, password } });

export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: { email, password } });

export const getMe = () => request('/auth/me', { auth: true });

// Workspace
export const inviteTeammate = (email) =>
  request('/workspace/invite', { method: 'POST', body: { email }, auth: true });

export const getMembers = () => request('/workspace/members', { auth: true });

// Pages
export const getPages = () => request('/pages', { auth: true });

export const createPage = (title, parent_page_id = null, section = null, icon = null) =>
  request('/pages', { method: 'POST', body: { title, parent_page_id, section, icon }, auth: true });

export const getPage = (id) => request(`/pages/${id}`, { auth: true });

// `fields` is `{ title, section?, icon?, locked? }` — section/icon/locked are
// only touched when the key is present at all (send null/'' to clear
// section/icon back to unset; omit the key entirely to leave it untouched).
export const updatePage = (id, fields) =>
  request(`/pages/${id}`, { method: 'PUT', body: fields, auth: true });

export const deletePage = (id) =>
  request(`/pages/${id}`, { method: 'DELETE', auth: true });

// Duplicates a page's blocks into a new root page — the mechanism behind
// "save as template" (pass section: 'Templates') and "use a template" (pass
// a fresh title, no section).
export const duplicatePage = (id, fields = {}) =>
  request(`/pages/${id}/duplicate`, { method: 'POST', body: fields, auth: true });

// Page activity ("version history" as a short edit log)
export const getPageActivity = (id) => request(`/pages/${id}/activity`, { auth: true });

// Page presence ("who's viewing this page")
export const sendPresenceHeartbeat = (id) =>
  request(`/pages/${id}/presence`, { method: 'PUT', auth: true });

export const getPagePresence = (id) => request(`/pages/${id}/presence`, { auth: true });

// Blocks
export const createBlock = (pageId, type, content, position) =>
  request(`/pages/${pageId}/blocks`, {
    method: 'POST',
    body: { type, content, position },
    auth: true,
  });

export const updateBlock = (id, fields) =>
  request(`/blocks/${id}`, { method: 'PUT', body: fields, auth: true });

export const deleteBlock = (id) =>
  request(`/blocks/${id}`, { method: 'DELETE', auth: true });

// Guest demo (public, read-only, no auth)
export const getDemoPages = () => request('/demo/pages');

export const getDemoPage = (id) => request(`/demo/pages/${id}`);

// Tables (nested under a 'table' block)
export const createTableColumn = (blockId, name) =>
  request(`/tables/${blockId}/columns`, { method: 'POST', body: { name }, auth: true });

export const updateTableColumn = (id, name) =>
  request(`/tables/columns/${id}`, { method: 'PUT', body: { name }, auth: true });

export const deleteTableColumn = (id) =>
  request(`/tables/columns/${id}`, { method: 'DELETE', auth: true });

export const createTableRow = (blockId) =>
  request(`/tables/${blockId}/rows`, { method: 'POST', auth: true });

export const deleteTableRow = (id) =>
  request(`/tables/rows/${id}`, { method: 'DELETE', auth: true });

export const upsertTableCell = (rowId, columnId, value) =>
  request('/tables/cells', {
    method: 'PUT',
    body: { row_id: rowId, column_id: columnId, value },
    auth: true,
  });

// Row comments (real, server-side)
export const getRowComments = (rowId) => request(`/tables/rows/${rowId}/comments`, { auth: true });

export const postRowComment = (rowId, text) =>
  request(`/tables/rows/${rowId}/comments`, { method: 'POST', body: { text }, auth: true });

// Form responses (real submissions — see docs/decisions.md)
export const submitFormResponse = (blockId, data) =>
  request(`/forms/${blockId}/responses`, { method: 'POST', body: { data }, auth: true });

export const getFormResponses = (blockId) => request(`/forms/${blockId}/responses`, { auth: true });

// Knowledge graph (Obsidian-style backlinks + graph view — see docs/decisions.md)
export const getWorkspaceGraph = () => request('/workspace/graph', { auth: true });

export const getBacklinks = (id) => request(`/pages/${id}/backlinks`, { auth: true });
