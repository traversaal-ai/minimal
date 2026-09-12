// db.js — SQLite connection + schema setup for Nestpad.
// Schema is created on every startup with CREATE TABLE IF NOT EXISTS, so this
// is safe to run repeatedly (server start, seed script, tests).

const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY (workspace_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS workspace_invites (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    email TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    parent_page_id TEXT REFERENCES pages(id),
    title TEXT NOT NULL,
    section TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL REFERENCES pages(id),
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    checked INTEGER,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- A "table" block's structure. One block of type 'table' owns a set of
  -- columns and rows; a cell is the (row, column) intersection. Simple text
  -- values only — no column types, formulas, filters, or sorts.
  CREATE TABLE IF NOT EXISTS table_columns (
    id TEXT PRIMARY KEY,
    block_id TEXT NOT NULL REFERENCES blocks(id),
    name TEXT NOT NULL,
    position INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS table_rows (
    id TEXT PRIMARY KEY,
    block_id TEXT NOT NULL REFERENCES blocks(id),
    position INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS table_cells (
    id TEXT PRIMARY KEY,
    row_id TEXT NOT NULL REFERENCES table_rows(id),
    column_id TEXT NOT NULL REFERENCES table_columns(id),
    value TEXT NOT NULL DEFAULT '',
    UNIQUE(row_id, column_id)
  );

  -- Real, server-side comments on a table row (replaces the earlier
  -- localStorage-only version — see docs/decisions.md). Shared across
  -- everyone in the workspace, same as everything else here.
  CREATE TABLE IF NOT EXISTS row_comments (
    id TEXT PRIMARY KEY,
    row_id TEXT NOT NULL REFERENCES table_rows(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- A short, human-readable log of page/block changes — "version history" in
  -- the sense of "who changed what, when," not full content snapshots or
  -- revert-to-previous. See docs/decisions.md.
  CREATE TABLE IF NOT EXISTS page_activity (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL REFERENCES pages(id),
    actor_id TEXT NOT NULL REFERENCES users(id),
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- A lightweight "who's here" signal: the client sends a heartbeat while a
  -- page is open; a row older than ~30s is treated as no longer present.
  -- One row per (page, user) — a new heartbeat just updates updated_at.
  CREATE TABLE IF NOT EXISTS page_presence (
    page_id TEXT NOT NULL REFERENCES pages(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (page_id, user_id)
  );

  -- A submitted response to a 'form' block. 'data' is a JSON object keyed by
  -- field id, mirroring the field ids in the block's own content JSON.
  CREATE TABLE IF NOT EXISTS form_responses (
    id TEXT PRIMARY KEY,
    block_id TEXT NOT NULL REFERENCES blocks(id),
    submitted_by TEXT REFERENCES users(id),
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Migrations for databases created before these columns existed.
// CREATE TABLE IF NOT EXISTS doesn't add columns to an existing table, so a
// plain ALTER TABLE (guarded — it errors if the column is already there) is
// the only way to pick them up without wiping the file.
for (const stmt of [
  `ALTER TABLE pages ADD COLUMN section TEXT`,
  `ALTER TABLE pages ADD COLUMN icon TEXT`,
  `ALTER TABLE pages ADD COLUMN locked INTEGER NOT NULL DEFAULT 0`,
]) {
  try {
    db.exec(stmt);
  } catch (err) {
    // already has the column — fine.
  }
}

module.exports = db;
