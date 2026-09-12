# API contract

_Sprint Zero build (Minimal). Stack: node-react. Data layer: local. Level: MVP._

This file is law. The backend implements exactly these routes and shapes; the frontend consumes exactly these routes and shapes; QA tests against them. The two engineers never talk to each other, so nothing here is negotiable at build time. If not listed, it is not returned.

Base URL: `http://localhost:3001`. All request/response bodies are JSON. All timestamps are ISO 8601 UTC strings.

## Auth

Bearer JWT in `Authorization: Bearer <token>` on every route below marked 🔒. Token is a JWT signed with HS256, secret from `process.env.JWT_SECRET` (defaults to `"nestpad-dev-secret"` if unset — fine for local, never used in a real deployment), payload `{ sub: <user id>, email: <email> }`, expiry 7 days.

### `POST /auth/signup`
Body: `{ "email": string, "password": string }` (password min 8 chars, email trimmed + lowercased before storage/lookup).

- 201 → `{ "access_token": string, "user": { "id": string, "email": string, "created_at": string }, "workspace": { "id": string, "name": string } }`
  - If a pending invite exists for this email in `workspace_invites`, the user joins that workspace (the invite row is deleted). Otherwise a new workspace named `"<email-local-part>'s Workspace"` is created and the user becomes its first member.
- 409 `{ "error": "email_taken", "message": "An account with that email already exists." }`
- 400 `{ "error": "validation_error", "message": "<specific reason>" }` — empty email, invalid email format, or password under 8 chars.

### `POST /auth/login`
Body: `{ "email": string, "password": string }`.

- 200 → `{ "access_token": string, "user": {...}, "workspace": { "id": string, "name": string } }`. If a pending invite for this email exists at login time, the user is attached to that workspace first (same rule as signup), then this response reflects the (possibly new) workspace.
- 401 `{ "error": "invalid_credentials", "message": "Invalid email or password." }`
- 400 `{ "error": "validation_error", "message": "Email and password are required." }`

### `GET /auth/me` 🔒
- 200 → `{ "user": {...}, "workspace": { "id": string, "name": string } }`
- 401 `{ "error": "unauthorized", "message": "Missing or invalid token." }`

## Workspace

### `POST /workspace/invite` 🔒
Body: `{ "email": string }`.

- 201 → `{ "invited": true, "already_member": false }` if the email had no account and no existing invite — a pending invite row is created.
- 200 → `{ "invited": true, "already_member": true }` if the email belongs to an existing user — that user is added to the caller's workspace immediately (a `workspace_members` row is created if not already present).
- 200 → `{ "invited": true, "already_member": false }` if the email already had a pending invite to this workspace (idempotent, no duplicate row).
- 400 `{ "error": "validation_error", "message": "Please enter a valid email address." }`

### `GET /workspace/members` 🔒
- 200 → `{ "members": [ { "id": string, "email": string }, ... ] }` — every user in the caller's workspace.

## Pages

A page belongs to the caller's workspace. `parent_page_id` is `null` for a root page. `section` is a free-text label, meaningful only on a root page, used to group root pages into named, collapsible sections on the home dashboard; `null` means "unsectioned." There is no separate "sections" resource — a section exists only as long as at least one page uses its name. `icon` is an optional free-text string (typically one emoji) shown next to the page's title; `null` means no icon set. `locked` (boolean) restricts editing to the page's creator — see "Page locking" below.

### `GET /pages` 🔒
Returns every page in the caller's workspace, flat (client builds the tree from `parent_page_id`).

- 200 → `{ "pages": [ { "id": string, "workspace_id": string, "parent_page_id": string|null, "title": string, "section": string|null, "icon": string|null, "locked": boolean, "created_by": string, "created_at": string, "updated_at": string }, ... ] }`

### `POST /pages` 🔒
Body: `{ "title": string, "parent_page_id": string|null, "section"?: string|null, "icon"?: string|null }`. `section` and `icon` are optional; omit (or send `null`) for neither. A newly created page always starts `locked: false`.

- 201 → the created page object (same shape as above).
- 400 `{ "error": "validation_error", "message": "Title is required." }`
- 404 `{ "error": "not_found", "message": "Parent page not found." }` if `parent_page_id` is set but doesn't exist in the caller's workspace.

### `POST /pages/:id/duplicate` 🔒
Body: `{ "title"?: string, "section"?: string|null }` — both optional; `title` defaults to the source page's title, `section` defaults to `null` (unsectioned) unless given. Deep-copies the page's own blocks (including full table structure — columns, rows, cells) into a **new root page** (`parent_page_id: null`); does **not** copy sub-pages. This is the whole "template" mechanism (see `docs/decisions.md`): "save as template" is a duplicate into a `"Templates"` section, "use a template" is a duplicate out of it, with a fresh title.

- 201 → the new page object.
- 403/404 as above (source page not in caller's workspace / not found).

### `GET /pages/:id` 🔒
- 200 → `{ "page": {...page object...}, "blocks": [ {...block object...}, ... ] }` (blocks sorted by `position` ascending).
- 403 `{ "error": "forbidden" }` if the page belongs to a different workspace.
- 404 `{ "error": "not_found" }` if the page id doesn't exist.

### `PUT /pages/:id` 🔒
Body: `{ "title": string, "section"?: string|null, "icon"?: string|null, "locked"?: boolean }`. Renames the page; `section`/`icon`/`locked` are only touched when their key is present in the body at all (omit to leave untouched, send `null`/`""` to clear `section`/`icon` back to unset).

- 200 → the updated page object.
- 403 `{ "error": "forbidden", "message": "Only the page's creator can lock or unlock it." }` if `locked` is present and the caller isn't `created_by`.
- 403 `{ "error": "forbidden", "message": "This page is locked to edits by its owner." }` if the page is currently locked and the caller isn't its creator (checked before any other field is applied).
- 400/404 as above.

### `DELETE /pages/:id` 🔒
Deletes the page, its blocks, and cascades to delete all descendant pages (and their blocks) recursively.

- 204 no body.
- 403 (locked-page forbidden, same as `PUT`, above) /403/404 as above.

## Page locking

Added after the initial build (see `docs/decisions.md`) as a narrower alternative to real per-page permissions: a page's creator can lock it, after which **every mutating call scoped to that page** — `PUT`/`DELETE /pages/:id`, `POST /pages/:id/blocks`, `PUT`/`DELETE /blocks/:id`, and every `/tables/...` column/row/cell route for a block on that page — returns `403 { "error": "forbidden", "message": "This page is locked to edits by its owner." }` for anyone except the creator. Viewing (`GET`) is never affected. Only the creator can toggle `locked` itself (see `PUT /pages/:id` above).

## Page activity (a short edit log — not full version history)

Added after the initial build. Every page create, rename, lock/unlock, block add, and block remove appends one row; this is a human-readable "who changed what, when" log, **not** content snapshots — there is no restore/revert endpoint. See `docs/decisions.md`.

### `GET /pages/:id/activity` 🔒
- 200 → `{ "activity": [ { "id": string, "page_id": string, "actor_email": string, "summary": string, "created_at": string }, ... ] }` — the 5 most recent entries for this page, newest first.
- 403/404 as above.

## Page presence ("who's viewing this page")

A lightweight, poll-based presence signal — not a websocket. The client sends a heartbeat every ~10s while a page is open; a heartbeat older than 30 seconds is treated as "no longer viewing."

### `PUT /pages/:id/presence` 🔒
No body. Upserts a heartbeat for the caller on this page.
- 204 no body.
- 403/404 as above.

### `GET /pages/:id/presence` 🔒
- 200 → `{ "viewers": [ "<email>", ... ] }` — every other workspace member whose heartbeat on this page is within the last 30 seconds (the caller is never included in their own list).
- 403/404 as above.

## Blocks

A block belongs to a page. `type` is one of `"text" | "heading" | "checklist" | "bulleted_list" | "table" | "form" | "code"` (the last four added after the initial build — see `docs/decisions.md`). `code` is a plain preformatted-text block (content stored and returned verbatim, whitespace/newlines intact) rendered monospace — for ASCII diagrams and snippets where a proportional font would misalign the content. It has no special server behavior; it's just another string in `content`, exactly like `text`. `checked` is only meaningful (boolean) for `checklist`; `null` for other types. A `table` block carries no inline `content` (always `""`); its structure is columns/rows/cells, described below. A `form` block carries its entire structure (title, cover, description, fields) as an opaque JSON string in `content` — the server stores and returns it as plain text and never parses or validates it, exactly like `text` content; the shape is defined and owned entirely by the frontend (`client/src/lib/formTemplate.js`). **The form block is mostly a mock, with one real exception**: the builder UI, `Share form`, and the fake share link are cosmetic, but `Preview`'s Submit button and the `Responses` tab are wired to real storage — see "Form responses" below.

### `POST /pages/:id/blocks` 🔒
Body: `{ "type": "text"|"heading"|"checklist"|"bulleted_list"|"table"|"form"|"code", "content": string, "position": number }`. `content` is required (non-empty) for every type except `table`, where it's ignored and stored as `""`.

- 201 → `{ "id": string, "page_id": string, "type": string, "content": string, "checked": boolean|null, "position": number, "created_at": string, "updated_at": string, "table"?: { "columns": [...], "rows": [...] } }`. `checked` defaults to `false` when `type` is `"checklist"`, else `null`. When `type` is `"table"`, the block is created with 3 default columns ("Name", "Status", "Notes") and one blank row, and the response includes the `table` key (see shape below).
- 400 `{ "error": "validation_error", "message": "<reason>" }` — invalid `type`, or empty `content` on create (any type except `table`).
- 403/404 as above (page not in caller's workspace / not found).

`GET /pages/:id` (above) embeds the same `table` key on every block of type `table` in its `blocks` array.

## Tables (nested under a `table` block)

No filters, sorts, views, or column types — every cell is a plain string. Added after the initial build; see `docs/decisions.md` for why.

**Table shape** (as embedded on a block, or returned by these routes):
```json
{
  "columns": [ { "id": string, "block_id": string, "name": string, "position": number }, ... ],
  "rows": [ { "id": string, "block_id": string, "position": number, "cells": { "<column_id>": "<value>", ... } }, ... ]
}
```

### `POST /tables/:blockId/columns` 🔒
Body: `{ "name": string }`. Appends a column at the end; every existing row gets a blank cell for it.
- 201 → the created column object.
- 400 `{ "error": "validation_error", "message": "name is required." }`
- 400 `{ "error": "validation_error", "message": "Block is not a table." }` if the block isn't type `table`.
- 403/404 if the block isn't in the caller's workspace / doesn't exist.

### `PUT /tables/columns/:id` 🔒
Body: `{ "name": string }`. Renames a column.
- 200 → the updated column object. 400/403/404 as above.

### `DELETE /tables/columns/:id` 🔒
Deletes the column and every cell in it.
- 204 no body. 403/404 as above.

### `POST /tables/:blockId/rows` 🔒
Appends a row (with a blank cell per existing column) at the end. No body.
- 201 → the created row object (`cells` is `{}` if there are no columns yet).
- 400/403/404 as above.

### `DELETE /tables/rows/:id` 🔒
Deletes the row and its cells.
- 204 no body. 403/404 as above.

### `PUT /tables/cells` 🔒
Body: `{ "row_id": string, "column_id": string, "value": string }`. Upserts one cell — creates it if the (row, column) pair has no cell yet, else updates it.
- 200 → `{ "row_id": string, "column_id": string, "value": string }`
- 400 `{ "error": "validation_error", "message": "row_id, column_id, and value are required." }`
- 404 `{ "error": "not_found", "message": "Column not found on this table." }` if the column doesn't belong to the row's table.
- 403/404 as above (row not in caller's workspace / not found).

### `PUT /blocks/:id` 🔒
Body: any of `{ "content"?: string, "checked"?: boolean, "position"?: number }` — partial update, at least one field required.

- 200 → the updated block object.
- 400 `{ "error": "validation_error", "message": "checked can only be set on a checklist block." }` if `checked` is sent for a non-checklist block.
- 403/404 as above.

### `DELETE /blocks/:id` 🔒
- 204 no body.
- 403/404 as above.

## Row comments (nested under a `table` row)

Real, server-side, shared across the workspace — this replaced an earlier localStorage-only version (see `docs/decisions.md`). Subject to page locking like everything else scoped to a page.

### `GET /tables/rows/:id/comments` 🔒
- 200 → `{ "comments": [ { "id": string, "row_id": string, "author_email": string, "text": string, "created_at": string }, ... ] }`, oldest first.
- 403/404 as above (row not in caller's workspace / not found).

### `POST /tables/rows/:id/comments` 🔒
Body: `{ "text": string }` (non-empty).
- 201 → the created comment object (same shape as above), `author_email` is the caller's.
- 400 `{ "error": "validation_error", "message": "text is required." }`
- 403/404 as above.

## Form responses (nested under a `form` block)

Real submissions — the one part of the mock form block (see the `Blocks` section above) that's actually wired up. `Preview`'s Submit button posts here; the `Responses` tab reads from here.

### `POST /forms/:blockId/responses` 🔒
Body: `{ "data": { "<field id>": "<value>", ... } }` — keys are the field `id`s from the form's own JSON content; the server stores whatever object it's given without validating it against the field list.
- 201 → `{ "id": string, "block_id": string, "data": {...}, "created_at": string }`
- 400 `{ "error": "validation_error", "message": "data must be an object." }`
- 400 `{ "error": "validation_error", "message": "Block is not a form." }`
- 403/404 as above.

### `GET /forms/:blockId/responses` 🔒
- 200 → `{ "responses": [ {...response object...}, ... ] }`, newest first.
- 403/404 as above.

## Knowledge graph (backlinks and a graph view)

Obsidian-style bidirectional links, added after the initial build (see `docs/decisions.md`). A "link" from page A to page B is detected purely by page B's raw id appearing anywhere in one of page A's blocks' `content` — the same string an internal `[label](/app/pages/<id>)` link (see the rich-text convention under Blocks) already embeds. No new storage, no separate links table.

### `GET /workspace/graph` 🔒
- 200 → `{ "nodes": [ { "id": string, "title": string }, ... ], "edges": [ { "source": string, "target": string }, ... ] }` — every page in the caller's workspace as a node, one edge per (source page, target page) pair where the source's content contains the target's id. Edges are deduplicated per pair; a page linking to the same page twice from different blocks still produces one edge.

### `GET /pages/:id/backlinks` 🔒
- 200 → `{ "backlinks": [ { "id": string, "title": string }, ... ] }` — every other page in the caller's workspace whose block content contains this page's id.
- 403/404 as above.

## Guest demo (public, read-only)

Added after the initial build for a "Continue as guest" flow: an unauthenticated, read-only view of the seeded demo workspace ("Traversaal Team Wiki"). No 🔒, no writes — these two routes never require a token and never accept a body.

### `GET /demo/pages`
- 200 → `{ "workspace": { "id": string, "name": string }, "pages": [ {...page object...}, ... ] }` — every page in the seeded demo workspace, flat.
- 404 `{ "error": "not_found", "message": "No demo workspace is seeded yet." }` if the seed hasn't run.

### `GET /demo/pages/:id`
- 200 → `{ "page": {...}, "blocks": [...] }` (same shape as `GET /pages/:id`, table blocks included with their `table` key), scoped to the demo workspace only.
- 404 if the seed hasn't run, or the page doesn't exist, or the page exists but isn't in the demo workspace.

## Conventions

- Every error body has the shape `{ "error": "<snake_case_code>", "message": "<human sentence>" }`.
- Unknown routes → 404 `{ "error": "not_found" }`.
- Malformed JSON body → 400 `{ "error": "validation_error", "message": "Malformed request body." }`.
- No endpoint ever returns a `password_hash` field, on any object, under any circumstance.
