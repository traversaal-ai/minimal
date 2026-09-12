# Build record — Minimal

_What got built, in the order it happened, and how each piece was verified. Written the way Sprint Zero's own class write-up (`presenter/sample/build-record.html`) documents a run — this is that document for a build that kept going well past the initial one-shot generation._

## 1. The initial build (Sprint Zero run against Notion)

Scoped and built through the normal Sprint Zero pipeline: `docs/scope.md` → `docs/reference-brief.md` → `docs/prd.md` → `docs/decisions.md` → `docs/user-stories.md` → `docs/api-contract.md`, then a tech-lead build brief, backend and frontend engineers in parallel, then QA.

**Core loop (MVP level, `web-app` / `node-react` / `local`):** sign up, land in a workspace, create and nest pages, write text/heading/checklist blocks, invite a teammate by email, and have that teammate see and edit the same shared page tree.

**QA result at that point:** 23/23 API integration tests passed, 19/19 browser steps passed (full auth dance, core loop, expired-token handling). One real bug found and fixed during QA: the "Add block" button stayed disabled after the first block was added (a missing `setSubmitting(false)` on the success path).

## 2. Everything added after that, in order

Each of these was requested and built one at a time, in conversation, well past a typical Sprint Zero MVP. Full reasoning for each lives in `docs/decisions.md` under its own "Amendment" heading — this section is the short version, in the order it happened.

1. **"Continue as guest"** — a public, read-only view of the seeded demo workspace (`/demo`), no account needed.
2. **New-workspace example content** — every fresh signup now gets a starter page tree instead of a blank workspace (mirrors Notion's own "Getting Started" default).
3. **Color and a real home dashboard** — a deterministic color per top-level page, colored status pills in tables, and `/app` rebuilt as an actual dashboard instead of an empty state.
4. **A real, editable table block** — columns, rows, cells, all persisted (not a mock), plus richer example content (Customers, Learning, Q1 Focus) to give the new coloring something to work with.
5. **A mock form builder block** — cover, icon, editable fields, Preview/Share UI. At this point still fully mocked (no response storage).
6. **Notion-style row detail view** — click "Open" on a table row to see it as its own page: a big title, every other column as a labeled property, plus comments (at this point, local-device-only via `localStorage`).
7. **Grouped, collapsible home sections** — root pages get an optional `section` field; the dashboard groups them into named, collapsible sections instead of one flat grid.
8. **A monospace code/diagram block**, plus a two-page "AI Engineering Docs" example (RAG architecture, vector databases) to demonstrate it, and a code-block example added to the very first page every user sees.
9. **A ten-item batch, all in one pass:** page icons; drag-to-reorder blocks and drag-pages-between-sections; sidebar search; page templates (via a generic duplicate-page endpoint); a short page-activity log ("version history" as a change log, not snapshots); poll-based page presence ("who's viewing this page"); **real, server-side row comments** (replacing the local-only version from step 6); page locking (a narrower stand-in for full permissions); and **real form responses** (Preview's Submit and the Responses tab, wired to actual storage — the one part of the form block that stopped being a mock).
10. **Landing page copy pass** — repositioned from "a team wiki" to "inspired by Notion," with the framing corrected on request to not claim Minimal *is* Notion, and em dashes removed from the copy.
11. **Reorganized into `Minimal/`** — `server/`, `client/`, and the generated `docs/` were moved from the Sprint Zero project root into their own `Minimal/` folder (matching the `examples/ghost-lite` convention already used elsewhere in this repo), so the whole project is self-contained and can be run from one place.
12. **An Obsidian-style knowledge layer** — backlinks ("Linked mentions" on every page) and a graph view of the whole workspace, computed live from the internal links that already existed as plain substrings in block content. No new storage; verified live (hover-highlighting, click-to-navigate, and a real backlinks list all confirmed working in the browser).

## 3. What's real vs. what's a deliberate mock, as of now

| Area | Status |
|---|---|
| Accounts, workspace, invites, pages, blocks | Real |
| Tables (columns/rows/cells), row comments | Real |
| Form builder structure (fields, cover, title) | Real, but the builder UI itself is cosmetic |
| Form **responses** (Preview Submit + Responses tab) | Real |
| Page locking, activity log, presence | Real |
| Backlinks and the graph view | Real, computed live (no separate index) |
| Templates | Real (a template is just a page in a `Templates` section) |
| "Share form" link | Fake — copies a non-resolving URL, by design (no public unauthenticated form-hosting route exists) |

Every row above with a caveat is spelled out in full in `docs/decisions.md` — this table is a pointer, not a replacement for it.

## 4. How to verify any of this yourself

```bash
cd server && npm install && node seed.js && node index.js   # API on :3001
cd client && npm install && npm run dev                      # app on :5173
```

Log in as `amara@traversaal.ai` / `password123` (or `leo@traversaal.ai` / `password123`), or use `/demo` for the no-account read-only tour. `docs/api-contract.md` is the authoritative route-by-route reference if you want to hit the API directly instead.

## 5. Independent verification, 12 September 2026

The whole thing was re-run from a clean clone at `7594576` on Node v24.2.0. See
[`build-record.html`](build-record.html) for the illustrated version, with a screenshot of
every surface described above.

| Check | Result |
|---|---|
| API integration suite | 23/23 |
| Browser suite | 19/19, after the fix below |
| Endpoints with integration coverage | 10 of 31 |

Three things came out of that run:

1. **The browser suite was failing one step** ("text block renders after adding"). The app was
   fine: the block is stored, rendered, and survives a reload. The assertion was stale. It checked
   `<input>` values, and saved block content now renders as a text node in a `<div>`, with inputs
   used only while editing. That almost certainly changed when the knowledge layer made internal
   links render as clickable markup inside block content. Fixed by checking both.
2. **CORS was hardcoded** to `http://localhost:5173`, so running the client on any other port
   failed preflight with no server-side clue. Now `process.env.CLIENT_ORIGIN` with the same default.
3. **Test coverage stops at the original MVP.** The 23/23 is real and narrower than it looks: it
   covers auth, workspace, invites, pages and core blocks. Every endpoint added by the twelve
   amendments (tables, row comments, form responses, backlinks, the graph, presence, the activity
   log, templates, and the demo routes) has no automated coverage. Nothing was found broken by
   hand, but the green number does not speak for those areas.

Graph node labels also overlap where nodes sit close together. Cosmetic at sixteen pages, a
problem well before sixty.
