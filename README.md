# Minimal

Notion meets Obsidian: a self-hosted, simplified Notion — nested pages, a shared team workspace, a handful of block types (text, heading, checklist, bulleted list, table, mock form builder, and monospace code/diagram blocks) — plus an Obsidian-style knowledge layer on top (backlinks and a whole-workspace graph view). Originally scaffolded with [Sprint Zero](https://github.com/hamzafarooq/multi-agent-course/tree/main/Full_Stack_Projects/Sprint_Zero), scoped against Notion as the reference product, then extended well past the initial build.

Everything here is a real, working build — not a mock — except where explicitly noted (the `form` block's builder/share UI, and a few narrower cuts documented in `docs/decisions.md`).

## Quick start

```bash
cd server && npm install && node seed.js && node index.js   # API on :3001
```

In a second terminal:

```bash
cd client && npm install && npm run dev                      # app on :5173
```

Open `http://localhost:5173` and log in with a seed account (printed by `node seed.js`):

- `amara@traversaal.ai` / `password123`
- `leo@traversaal.ai` / `password123`

Or click **Continue as guest** on the landing page for a read-only tour with no account.

## What's built

- Real accounts, a shared workspace, nested pages, and an invite flow (email-based, no token — see `docs/decisions.md`)
- Blocks: text, heading, checklist, bulleted list, table (with a Notion-style "Open" row-detail view, comments, and colored status pills), a mock form builder (Preview/Submit and Responses are real; the rest is UI-only), and monospace code/diagram blocks
- A dashboard home page with named, collapsible, drag-and-drop sections
- Page icons, page locking (creator-only edit), a short activity log, and lightweight live presence ("who's viewing this page")
- Templates (save any page as one, start a new page from one)
- An Obsidian-style knowledge layer: backlinks ("Linked mentions") on every page, and a whole-workspace graph view
- A public, read-only guest demo (`/demo`) mirroring the real seeded workspace

## Where things are

```
.
├── server/        Express + SQLite API (see server/README.md)
├── client/        React + Vite frontend
└── docs/          The full spec set this was built against, plus a running
                   log of everything added after the initial build:
                   scope.md, reference-brief.md, prd.md, decisions.md,
                   user-stories.md, api-contract.md, build-record.md
```

`docs/build-record.md` (or [`docs/build-record.html`](docs/build-record.html) for a styled version) is the fastest way to see everything that's been built, in the order it happened. `docs/decisions.md` is the most useful single file for understanding *why* things are the way they are — every deliberate scope cut and every later addition (tables, forms, sections, locking, presence, templates, the graph, etc.) is logged there with its reasoning. `docs/api-contract.md` is the authoritative route-by-route reference.

## A note on scope

This was built incrementally, in conversation, well past a typical Sprint Zero MVP — most of what's in `docs/decisions.md`'s "Amendment" entries was added after the initial build, one requested feature at a time. It's a good illustration of Sprint Zero's own file layout and agent conventions holding up under real, iterative extension, not just a single one-shot generation.
